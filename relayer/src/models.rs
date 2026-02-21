use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha3::{Digest, Keccak256};
use starknet::core::types::Felt;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct U256Word {
    pub low: u128,
    pub high: u128,
}

impl U256Word {
    pub const fn zero() -> Self {
        Self { low: 0, high: 0 }
    }

    pub fn from_be_bytes(bytes: [u8; 32]) -> Self {
        let mut high_bytes = [0u8; 16];
        let mut low_bytes = [0u8; 16];
        high_bytes.copy_from_slice(&bytes[..16]);
        low_bytes.copy_from_slice(&bytes[16..]);

        Self {
            low: u128::from_be_bytes(low_bytes),
            high: u128::from_be_bytes(high_bytes),
        }
    }

    pub fn to_be_bytes(self) -> [u8; 32] {
        let mut out = [0u8; 32];
        out[..16].copy_from_slice(&self.high.to_be_bytes());
        out[16..].copy_from_slice(&self.low.to_be_bytes());
        out
    }

    pub fn to_hex_32(self) -> String {
        format!("0x{:032x}{:032x}", self.high, self.low)
    }

    pub fn as_u128(self) -> Option<u128> {
        (self.high == 0).then_some(self.low)
    }

    pub fn to_calldata(self) -> [Felt; 2] {
        [Felt::from(self.low), Felt::from(self.high)]
    }

    fn shr8(self) -> Self {
        let mut limbs = [
            (self.low & 0xffff_ffff_ffff_ffff) as u64,
            (self.low >> 64) as u64,
            (self.high & 0xffff_ffff_ffff_ffff) as u64,
            (self.high >> 64) as u64,
        ];

        let mut carry = 0u64;
        for i in (0..4).rev() {
            let new_carry = limbs[i] & 0xff;
            limbs[i] = (limbs[i] >> 8) | (carry << 56);
            carry = new_carry;
        }

        let low = (limbs[1] as u128) << 64 | (limbs[0] as u128);
        let high = (limbs[3] as u128) << 64 | (limbs[2] as u128);

        Self { low, high }
    }

    fn from_decimal(raw: &str) -> Result<Self> {
        if raw.is_empty() {
            return Err(anyhow!("empty decimal string"));
        }

        let mut limbs = [0u64; 4];

        for (idx, ch) in raw.chars().enumerate() {
            let digit = ch
                .to_digit(10)
                .ok_or_else(|| anyhow!("invalid decimal digit at index {idx}"))?
                as u64;

            let mut carry = digit as u128;
            for limb in &mut limbs {
                let value = (*limb as u128) * 10 + carry;
                *limb = value as u64;
                carry = value >> 64;
            }

            if carry != 0 {
                return Err(anyhow!("decimal value exceeds u256"));
            }
        }

        let low = (limbs[1] as u128) << 64 | (limbs[0] as u128);
        let high = (limbs[3] as u128) << 64 | (limbs[2] as u128);
        Ok(Self { low, high })
    }

    fn from_hex(input: &str) -> Result<Self> {
        let normalized = input.trim_start_matches("0x").trim_start_matches("0X");
        if normalized.len() > 64 {
            return Err(anyhow!("hex u256 is too long"));
        }
        if normalized.is_empty() {
            return Ok(Self::zero());
        }

        let padded = format!("{:0>64}", normalized);
        let decoded = hex::decode(&padded).context("invalid hex u256")?;

        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        Ok(Self::from_be_bytes(bytes))
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayRequest {
    #[serde(default)]
    pub proof: Option<Value>,
    #[serde(default)]
    pub proof_calldata: Option<Vec<Value>>,
    #[serde(default)]
    pub public_inputs: Vec<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct PendingRelayItem {
    pub id: Uuid,
    pub proof_calldata: Vec<Felt>,
    pub public_inputs: Vec<U256Word>,
    pub relayer_fee_wei: Option<u128>,
    pub received_at: DateTime<Utc>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredPendingRelayItem {
    pub id: Uuid,
    pub proof_calldata: Vec<String>,
    pub public_inputs: Vec<String>,
    #[serde(default)]
    pub relayer_fee_wei: Option<String>,
    pub received_at: DateTime<Utc>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct WithdrawOperation {
    pub token: Felt,
    pub recipient: Felt,
    pub amount: U256Word,
    pub nullifier_hash: U256Word,
    pub root_hash: U256Word,
    pub new_commitment: U256Word,
    pub calldata_hash: U256Word,
}

#[derive(Debug, Clone)]
pub struct ExecuteActionOperation {
    pub token: Felt,
    pub amount: U256Word,
    pub target: Felt,
    pub selector: Felt,
    pub action_calldata: Vec<Felt>,
    pub action_id: U256Word,
    pub nullifier_hash: U256Word,
    pub root_hash: U256Word,
    pub new_commitment: U256Word,
}

#[derive(Debug, Clone)]
pub enum RelayOperation {
    Withdraw(WithdrawOperation),
    ExecuteAction(ExecuteActionOperation),
}

#[derive(Debug, Serialize)]
pub struct RelayQueuedResponse {
    pub request_id: Uuid,
    pub queue_len: usize,
    pub gas_estimate: String,
    pub min_required_fee_wei: String,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub queue_len: usize,
}

#[derive(Debug, Clone)]
pub enum RelayRequestStatus {
    Queued,
    Submitted { tx_hash: Felt },
}

impl RelayRequestStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            RelayRequestStatus::Queued => "queued",
            RelayRequestStatus::Submitted { .. } => "submitted",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RelayStatusResponse {
    pub request_id: Uuid,
    pub status: &'static str,
    pub tx_hash: Option<String>,
}

impl RelayRequest {
    pub fn into_pending(
        self,
        fee_public_input_index: Option<usize>,
        now: DateTime<Utc>,
    ) -> Result<PendingRelayItem> {
        let proof_calldata = self.parse_proof_calldata()?;

        let mut public_inputs = Vec::with_capacity(self.public_inputs.len());
        for (index, word) in self.public_inputs.iter().enumerate() {
            let parsed = parse_u256_word(word)
                .with_context(|| format!("invalid public_inputs[{index}]"))?;
            public_inputs.push(parsed);
        }

        let relayer_fee_wei = if let Some(index) = fee_public_input_index {
            let fee_word = public_inputs.get(index).ok_or_else(|| {
                anyhow!(
                    "public_inputs missing fee index {}, len={}",
                    index,
                    public_inputs.len()
                )
            })?;

            Some(
                fee_word
                    .as_u128()
                    .ok_or_else(|| anyhow!("fee public input does not fit in u128"))?,
            )
        } else {
            None
        };

        Ok(PendingRelayItem {
            id: Uuid::new_v4(),
            proof_calldata,
            public_inputs,
            relayer_fee_wei,
            received_at: now,
            metadata: self.metadata,
        })
    }

    fn parse_proof_calldata(&self) -> Result<Vec<Felt>> {
        if let Some(values) = &self.proof_calldata {
            return parse_felt_values(values);
        }

        let proof = self
            .proof
            .as_ref()
            .ok_or_else(|| anyhow!("missing proof or proof_calldata field"))?;

        parse_proof_payload(proof)
    }
}

impl From<&PendingRelayItem> for StoredPendingRelayItem {
    fn from(value: &PendingRelayItem) -> Self {
        Self {
            id: value.id,
            proof_calldata: value
                .proof_calldata
                .iter()
                .map(|felt| felt.to_string())
                .collect(),
            public_inputs: value.public_inputs.iter().map(|word| word.to_hex_32()).collect(),
            relayer_fee_wei: value.relayer_fee_wei.map(|fee| fee.to_string()),
            received_at: value.received_at,
            metadata: value.metadata.clone(),
        }
    }
}

impl TryFrom<StoredPendingRelayItem> for PendingRelayItem {
    type Error = anyhow::Error;

    fn try_from(value: StoredPendingRelayItem) -> Result<Self> {
        let mut proof_calldata = Vec::with_capacity(value.proof_calldata.len());
        for (index, felt_raw) in value.proof_calldata.iter().enumerate() {
            proof_calldata.push(
                parse_felt(felt_raw)
                    .with_context(|| format!("invalid stored proof_calldata[{index}]"))?,
            );
        }

        let mut public_inputs = Vec::with_capacity(value.public_inputs.len());
        for (index, word_raw) in value.public_inputs.iter().enumerate() {
            public_inputs.push(
                parse_u256_word(word_raw)
                    .with_context(|| format!("invalid stored public_inputs[{index}]"))?,
            );
        }

        let relayer_fee_wei = value
            .relayer_fee_wei
            .map(|raw| {
                raw.parse::<u128>()
                    .context("invalid stored relayer_fee_wei")
            })
            .transpose()?;

        Ok(Self {
            id: value.id,
            proof_calldata,
            public_inputs,
            relayer_fee_wei,
            received_at: value.received_at,
            metadata: value.metadata,
        })
    }
}

impl PendingRelayItem {
    pub fn operation(&self) -> Result<RelayOperation> {
        let metadata = self
            .metadata
            .as_ref()
            .ok_or_else(|| anyhow!("missing relay metadata"))?;

        let operation = get_required_value(metadata, &["operation"])?
            .as_str()
            .ok_or_else(|| anyhow!("metadata.operation must be a string"))?;

        match operation {
            "withdraw" | "withdrawal" => {
                let token = parse_felt_from_metadata(metadata, &["token"])?;
                let recipient = parse_felt_from_metadata(metadata, &["recipient"])?;
                let amount = parse_u256_from_metadata(metadata, &["amount"])?;
                let nullifier_hash = parse_u256_from_metadata(metadata, &["nullifierHash", "nullifier_hash"])?;
                let root_hash = parse_u256_from_metadata(metadata, &["rootHash", "root_hash"])?;
                let new_commitment = parse_u256_from_metadata(metadata, &["newCommitment", "new_commitment"])?;
                let calldata_hash = get_optional_value(metadata, &["calldataHash", "calldata_hash"])
                    .map(parse_u256_from_value)
                    .transpose()?
                    .unwrap_or_else(U256Word::zero);

                Ok(RelayOperation::Withdraw(WithdrawOperation {
                    token,
                    recipient,
                    amount,
                    nullifier_hash,
                    root_hash,
                    new_commitment,
                    calldata_hash,
                }))
            }
            "execute_action" | "executeAction" => {
                let token = parse_felt_from_metadata(metadata, &["token"])?;
                let amount = parse_u256_from_metadata(metadata, &["amount"])?;
                let target = parse_felt_from_metadata(metadata, &["target"])?;
                let selector = parse_felt_from_metadata(metadata, &["selector"])?;
                let action_id = parse_u256_from_metadata(metadata, &["actionId", "action_id"])?;
                let nullifier_hash =
                    parse_u256_from_metadata(metadata, &["nullifierHash", "nullifier_hash"])?;
                let root_hash = parse_u256_from_metadata(metadata, &["rootHash", "root_hash"])?;
                let new_commitment =
                    parse_u256_from_metadata(metadata, &["newCommitment", "new_commitment"])?;

                let calldata_value = get_required_value(metadata, &["actionCalldata", "action_calldata"])?;
                let action_calldata = parse_action_calldata(calldata_value)?;

                Ok(RelayOperation::ExecuteAction(ExecuteActionOperation {
                    token,
                    amount,
                    target,
                    selector,
                    action_calldata,
                    action_id,
                    nullifier_hash,
                    root_hash,
                    new_commitment,
                }))
            }
            other => Err(anyhow!("unsupported metadata.operation: {other}")),
        }
    }

    pub fn validate_public_inputs_against_operation(&self, operation: &RelayOperation) -> Result<()> {
        if self.public_inputs.is_empty() {
            return Ok(());
        }

        if self.public_inputs.len() < 6 {
            return Err(anyhow!(
                "public_inputs must contain at least 6 elements when provided"
            ));
        }

        let inputs = &self.public_inputs;

        match operation {
            RelayOperation::Withdraw(op) => {
                ensure_public_input_eq(inputs, 0, op.root_hash, "root hash")?;
                ensure_public_input_eq(inputs, 1, op.nullifier_hash, "nullifier hash")?;
                ensure_public_input_eq(inputs, 2, felt_to_u256_word(op.recipient), "recipient")?;
                ensure_public_input_eq(inputs, 3, op.calldata_hash, "calldata hash")?;
                ensure_public_input_eq(inputs, 4, op.amount, "amount")?;
                ensure_public_input_eq(inputs, 5, op.new_commitment, "new commitment")?;
            }
            RelayOperation::ExecuteAction(op) => {
                let data_hash = compute_action_calldata_hash(op.action_id, op.selector, &op.action_calldata);
                ensure_public_input_eq(inputs, 0, op.root_hash, "root hash")?;
                ensure_public_input_eq(inputs, 1, op.nullifier_hash, "nullifier hash")?;
                ensure_public_input_eq(inputs, 2, felt_to_u256_word(op.target), "target")?;
                ensure_public_input_eq(inputs, 3, data_hash, "action calldata hash")?;
                ensure_public_input_eq(inputs, 4, op.amount, "amount")?;
                ensure_public_input_eq(inputs, 5, op.new_commitment, "new commitment")?;
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub struct FeeEstimate {
    pub gas_estimate: u128,
    pub gas_price: u128,
    pub min_required_fee_wei: u128,
}

pub fn decode_relayer_address(word: &U256Word) -> Result<Felt> {
    if word.high != 0 {
        return Err(anyhow!("relayer address word has non-zero high limb"));
    }
    Ok(Felt::from(word.low))
}

pub fn parse_felt(input: &str) -> Result<Felt> {
    if input.starts_with("0x") || input.starts_with("0X") {
        Felt::from_hex(input).map_err(|error| anyhow!("invalid hex felt: {error}"))
    } else {
        Felt::from_dec_str(input).map_err(|error| anyhow!("invalid decimal felt: {error}"))
    }
}

pub fn parse_u256_word(input: &str) -> Result<U256Word> {
    if input.starts_with("0x") || input.starts_with("0X") {
        U256Word::from_hex(input)
    } else {
        U256Word::from_decimal(input)
    }
}

fn parse_felt_values(values: &[Value]) -> Result<Vec<Felt>> {
    let mut out = Vec::with_capacity(values.len());
    for (index, value) in values.iter().enumerate() {
        out.push(parse_felt_from_value(value).with_context(|| format!("invalid proof value at index {index}"))?);
    }
    Ok(out)
}

fn parse_proof_payload(proof: &Value) -> Result<Vec<Felt>> {
    match proof {
        Value::Array(values) => parse_felt_values(values),
        Value::String(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Err(anyhow!("proof string is empty"));
            }

            let tokens: Vec<&str> = trimmed
                .split(|ch: char| ch == ',' || ch.is_whitespace())
                .filter(|part| !part.is_empty())
                .collect();

            if tokens.is_empty() {
                return Err(anyhow!("proof string did not contain calldata tokens"));
            }

            let mut out = Vec::with_capacity(tokens.len());
            for (index, token) in tokens.iter().enumerate() {
                out.push(parse_felt(token).with_context(|| {
                    format!("invalid proof calldata token at index {index}: {token}")
                })?);
            }
            Ok(out)
        }
        _ => Err(anyhow!(
            "proof must be an array of felts, or a string containing felt tokens"
        )),
    }
}

fn parse_felt_from_metadata(metadata: &Value, fields: &[&str]) -> Result<Felt> {
    let value = get_required_value(metadata, fields)?;
    parse_felt_from_value(value)
}

fn parse_felt_from_value(value: &Value) -> Result<Felt> {
    match value {
        Value::String(raw) => parse_felt(raw),
        Value::Number(number) => {
            if let Some(as_u64) = number.as_u64() {
                Ok(Felt::from(as_u64))
            } else {
                Err(anyhow!("numeric value is not an unsigned integer"))
            }
        }
        _ => Err(anyhow!("value must be string or number")),
    }
}

fn parse_u256_from_metadata(metadata: &Value, fields: &[&str]) -> Result<U256Word> {
    let value = get_required_value(metadata, fields)?;
    parse_u256_from_value(value)
}

fn parse_u256_from_value(value: &Value) -> Result<U256Word> {
    match value {
        Value::String(raw) => parse_u256_word(raw),
        Value::Number(number) => {
            let as_u64 = number
                .as_u64()
                .ok_or_else(|| anyhow!("numeric value is not a u64"))?;
            Ok(U256Word {
                low: as_u64 as u128,
                high: 0,
            })
        }
        _ => Err(anyhow!("value must be string or number")),
    }
}

fn parse_action_calldata(value: &Value) -> Result<Vec<Felt>> {
    let array = value
        .as_array()
        .ok_or_else(|| anyhow!("action calldata must be an array"))?;

    let mut out = Vec::with_capacity(array.len());
    for (index, item) in array.iter().enumerate() {
        out.push(
            parse_felt_from_value(item)
                .with_context(|| format!("invalid action calldata index {index}"))?,
        );
    }
    Ok(out)
}

fn ensure_public_input_eq(
    inputs: &[U256Word],
    index: usize,
    expected: U256Word,
    label: &str,
) -> Result<()> {
    let actual = inputs.get(index).ok_or_else(|| {
        anyhow!("public_inputs missing {label} at index {index}")
    })?;

    if *actual != expected {
        return Err(anyhow!(
            "public input mismatch at index {index} ({label}): expected {}, got {}",
            expected.to_hex_32(),
            actual.to_hex_32()
        ));
    }

    Ok(())
}

fn felt_to_u256_word(value: Felt) -> U256Word {
    U256Word::from_be_bytes(value.to_bytes_be())
}

fn compute_action_calldata_hash(
    action_id: U256Word,
    selector: Felt,
    action_calldata: &[Felt],
) -> U256Word {
    let mut hasher = Keccak256::new();
    hasher.update(action_id.to_be_bytes());
    hasher.update(felt_to_u256_word(selector).to_be_bytes());

    for value in action_calldata {
        hasher.update(felt_to_u256_word(*value).to_be_bytes());
    }

    let digest = hasher.finalize();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);

    U256Word::from_be_bytes(bytes).shr8()
}

fn get_required_value<'a>(value: &'a Value, names: &[&str]) -> Result<&'a Value> {
    let object = value
        .as_object()
        .ok_or_else(|| anyhow!("metadata must be a JSON object"))?;

    for name in names {
        if let Some(v) = object.get(*name) {
            return Ok(v);
        }
    }

    Err(anyhow!("missing required metadata field: {}", names.join("/")))
}

fn get_optional_value<'a>(value: &'a Value, names: &[&str]) -> Option<&'a Value> {
    let object = value.as_object()?;
    for name in names {
        if let Some(v) = object.get(*name) {
            return Some(v);
        }
    }
    None
}
