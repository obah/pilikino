use anyhow::{anyhow, Context, Result};
use starknet::core::types::Felt;
use std::{env, net::SocketAddr, path::PathBuf};

#[derive(Debug, Clone)]
pub struct RelayerConfig {
    pub rpc_url: String,
    pub private_key: String,
    pub account_address: Felt,
    pub pool_address: Felt,
    pub bind_addr: SocketAddr,
    pub relayer_public_input_index: Option<usize>,
    pub fee_public_input_index: Option<usize>,
    pub batch_size: usize,
    pub batch_max_wait_secs: u64,
    pub retry_max_attempts: u32,
    pub retry_base_delay_ms: u64,
    pub mempool_path: PathBuf,
}

impl RelayerConfig {
    pub fn from_env() -> Result<Self> {
        let rpc_url = require_env("RELAYER_RPC_URL")?;
        let private_key = require_env("RELAYER_PRIVATE_KEY")?;
        let account_address = parse_felt_env("RELAYER_ACCOUNT_ADDRESS")?;

        let pool_raw = env::var("PILIKINO_POOL_ADDRESS")
            .or_else(|_| env::var("FAN_POOL_ADDRESS"))
            .context("missing required env var PILIKINO_POOL_ADDRESS")?;
        let pool_address = parse_felt(&pool_raw)
            .with_context(|| "failed to parse PILIKINO_POOL_ADDRESS as felt")?;

        let bind_addr = parse_env("RELAYER_BIND_ADDR", "0.0.0.0:8787")?;
        let relayer_public_input_index = parse_optional_env("RELAYER_PUBLIC_INPUT_RELAYER_INDEX")?;
        let fee_public_input_index = parse_optional_env("RELAYER_PUBLIC_INPUT_FEE_INDEX")?;
        let batch_size = parse_env("RELAYER_BATCH_SIZE", "10")?;
        let batch_max_wait_secs = parse_env("RELAYER_BATCH_MAX_WAIT_SECS", "15")?;
        let retry_max_attempts = parse_env("RELAYER_RETRY_MAX_ATTEMPTS", "5")?;
        let retry_base_delay_ms = parse_env("RELAYER_RETRY_BASE_DELAY_MS", "500")?;

        let mempool_path = PathBuf::from(
            env::var("RELAYER_MEMPOOL_PATH")
                .unwrap_or_else(|_| "./data/mempool.json".to_string()),
        );

        if batch_size == 0 {
            return Err(anyhow!("RELAYER_BATCH_SIZE must be > 0"));
        }
        if retry_max_attempts == 0 {
            return Err(anyhow!("RELAYER_RETRY_MAX_ATTEMPTS must be > 0"));
        }

        Ok(Self {
            rpc_url,
            private_key,
            account_address,
            pool_address,
            bind_addr,
            relayer_public_input_index,
            fee_public_input_index,
            batch_size,
            batch_max_wait_secs,
            retry_max_attempts,
            retry_base_delay_ms,
            mempool_path,
        })
    }
}

fn require_env(key: &str) -> Result<String> {
    env::var(key).with_context(|| format!("missing required env var {key}"))
}

fn parse_felt_env(key: &str) -> Result<Felt> {
    let raw = require_env(key)?;
    parse_felt(&raw).with_context(|| format!("failed to parse {key} as felt"))
}

fn parse_felt(value: &str) -> Result<Felt> {
    if value.starts_with("0x") || value.starts_with("0X") {
        Felt::from_hex(value).map_err(|error| anyhow!("invalid hex felt {value}: {error}"))
    } else {
        Felt::from_dec_str(value)
            .map_err(|error| anyhow!("invalid decimal felt {value}: {error}"))
    }
}

fn parse_env<T>(key: &str, default: &str) -> Result<T>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    let raw = env::var(key).unwrap_or_else(|_| default.to_string());
    raw.parse::<T>()
        .map_err(|error| anyhow!("failed to parse {key}: {error}"))
}

fn parse_optional_env<T>(key: &str) -> Result<Option<T>>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    match env::var(key) {
        Ok(raw) if !raw.trim().is_empty() => raw
            .parse::<T>()
            .map(Some)
            .map_err(|error| anyhow!("failed to parse {key}: {error}")),
        Ok(_) => Ok(None),
        Err(env::VarError::NotPresent) => Ok(None),
        Err(error) => Err(anyhow!("failed to read {key}: {error}")),
    }
}
