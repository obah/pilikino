use crate::{
    config::RelayerConfig,
    models::{FeeEstimate, PendingRelayItem, RelayOperation},
};
use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use starknet::{
    accounts::{Account, ExecutionEncoding, SingleOwnerAccount},
    core::{
        types::{Call, Felt},
        utils::get_selector_from_name,
    },
    providers::{
        jsonrpc::{HttpTransport, JsonRpcClient},
        Provider, Url,
    },
    signers::{LocalWallet, SigningKey},
};
use std::{sync::Arc, time::Duration};
use tokio::time::sleep;
use tracing::{debug, warn};

type RpcClient = JsonRpcClient<HttpTransport>;
type StarkAccount = SingleOwnerAccount<RpcClient, LocalWallet>;

pub struct ChainService {
    config: Arc<RelayerConfig>,
    account: StarkAccount,
    relayer_address: Felt,
}

#[async_trait]
pub trait ChainClient: Send + Sync {
    fn relayer_address(&self) -> Felt;
    async fn estimate_single_request_fee(&self, item: &PendingRelayItem) -> Result<FeeEstimate>;
    async fn submit_item(&self, item: &PendingRelayItem) -> Result<Felt>;
}

impl ChainService {
    pub async fn new(config: Arc<RelayerConfig>) -> Result<Self> {
        let rpc_url = Url::parse(&config.rpc_url).context("failed to parse RELAYER_RPC_URL")?;
        let provider = JsonRpcClient::new(HttpTransport::new(rpc_url));
        let chain_id = provider.chain_id().await.context("failed to fetch chain id")?;

        let private_key = parse_felt(&config.private_key)
            .context("failed to parse RELAYER_PRIVATE_KEY as stark key felt")?;
        let signer = LocalWallet::from_signing_key(SigningKey::from_secret_scalar(private_key));

        let account = SingleOwnerAccount::new(
            provider,
            signer,
            config.account_address,
            chain_id,
            ExecutionEncoding::New,
        );

        let relayer_address = config.account_address;

        Ok(Self {
            config,
            account,
            relayer_address,
        })
    }

    pub fn relayer_address(&self) -> Felt {
        self.relayer_address
    }

    pub async fn estimate_single_request_fee(
        &self,
        item: &PendingRelayItem,
    ) -> Result<FeeEstimate> {
        let call = self.build_call(item).context("invalid relay metadata")?;
        let fee = self
            .account
            .execute_v3(vec![call])
            .estimate_fee()
            .await
            .context("failed to estimate Starknet invoke fee")?;

        let min_required_fee_wei = fee.overall_fee.saturating_mul(110).saturating_div(100);

        Ok(FeeEstimate {
            gas_estimate: fee.overall_fee,
            gas_price: fee.l1_gas_price,
            min_required_fee_wei,
        })
    }

    pub async fn submit_item(&self, item: &PendingRelayItem) -> Result<Felt> {
        let operation = item.operation().context("invalid relay metadata")?;

        for attempt in 1..=self.config.retry_max_attempts {
            let call = self
                .build_call_from_operation(item, &operation)
                .context("failed to build Starknet call")?;

            match self.account.execute_v3(vec![call]).send().await {
                Ok(result) => {
                    debug!(
                        tx_hash = %format!("{:#x}", result.transaction_hash),
                        "submitted relay transaction to Starknet"
                    );
                    return Ok(result.transaction_hash);
                }
                Err(error) => {
                    if attempt < self.config.retry_max_attempts && self.is_retryable_error(&error) {
                        warn!(attempt, error = %error, "retryable Starknet RPC error while sending relay tx");
                        self.backoff(attempt).await;
                        continue;
                    }

                    return Err(anyhow!(error).context("failed to send relay transaction"));
                }
            }
        }

        Err(anyhow!(
            "relay transaction exhausted all {} attempts",
            self.config.retry_max_attempts
        ))
    }

    fn build_call(&self, item: &PendingRelayItem) -> Result<Call> {
        let operation = item.operation().context("invalid relay metadata")?;
        self.build_call_from_operation(item, &operation)
    }

    fn build_call_from_operation(&self, item: &PendingRelayItem, operation: &RelayOperation) -> Result<Call> {
        match operation {
            RelayOperation::Withdraw(op) => {
                let selector = get_selector_from_name("withdraw")?;

                let mut calldata = Vec::with_capacity(16 + item.proof_calldata.len());
                calldata.push(op.token);
                push_u256(&mut calldata, op.amount);
                calldata.push(op.recipient);
                push_u256(&mut calldata, op.nullifier_hash);
                calldata.push(Felt::from(item.proof_calldata.len() as u64));
                calldata.extend_from_slice(&item.proof_calldata);
                push_u256(&mut calldata, op.root_hash);
                push_u256(&mut calldata, op.calldata_hash);
                push_u256(&mut calldata, op.new_commitment);

                Ok(Call {
                    to: self.config.pool_address,
                    selector,
                    calldata,
                })
            }
            RelayOperation::ExecuteAction(op) => {
                let selector = get_selector_from_name("execute_action")?;

                let mut calldata =
                    Vec::with_capacity(19 + op.action_calldata.len() + item.proof_calldata.len());
                calldata.push(op.token);
                push_u256(&mut calldata, op.amount);
                calldata.push(op.target);
                calldata.push(op.selector);
                calldata.push(Felt::from(op.action_calldata.len() as u64));
                calldata.extend_from_slice(&op.action_calldata);
                push_u256(&mut calldata, op.action_id);
                push_u256(&mut calldata, op.nullifier_hash);
                calldata.push(Felt::from(item.proof_calldata.len() as u64));
                calldata.extend_from_slice(&item.proof_calldata);
                push_u256(&mut calldata, op.root_hash);
                push_u256(&mut calldata, op.new_commitment);

                Ok(Call {
                    to: self.config.pool_address,
                    selector,
                    calldata,
                })
            }
        }
    }

    async fn backoff(&self, attempt: u32) {
        let multiplier = 2u64.saturating_pow(attempt.saturating_sub(1));
        let delay_ms = self.config.retry_base_delay_ms.saturating_mul(multiplier);
        sleep(Duration::from_millis(delay_ms)).await;
    }

    fn is_retryable_error<E: std::fmt::Display>(&self, error: &E) -> bool {
        let text = error.to_string().to_ascii_lowercase();
        text.contains("timeout")
            || text.contains("temporarily unavailable")
            || text.contains("connection reset")
            || text.contains("429")
            || text.contains("rate limit")
            || text.contains("503")
            || text.contains("nonce")
            || text.contains("already known")
    }
}

#[async_trait]
impl ChainClient for ChainService {
    fn relayer_address(&self) -> Felt {
        ChainService::relayer_address(self)
    }

    async fn estimate_single_request_fee(&self, item: &PendingRelayItem) -> Result<FeeEstimate> {
        ChainService::estimate_single_request_fee(self, item).await
    }

    async fn submit_item(&self, item: &PendingRelayItem) -> Result<Felt> {
        ChainService::submit_item(self, item).await
    }
}

fn parse_felt(value: &str) -> Result<Felt> {
    if value.starts_with("0x") || value.starts_with("0X") {
        Felt::from_hex(value).map_err(|error| anyhow!("invalid hex felt: {error}"))
    } else {
        Felt::from_dec_str(value).map_err(|error| anyhow!("invalid decimal felt: {error}"))
    }
}

fn push_u256(calldata: &mut Vec<Felt>, value: crate::models::U256Word) {
    let limbs = value.to_calldata();
    calldata.push(limbs[0]);
    calldata.push(limbs[1]);
}
