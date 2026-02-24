use crate::{
    errors::ApiError,
    models::{
        decode_relayer_address, HealthResponse, RelayQueuedResponse, RelayRequest,
        RelayRequestStatus, RelayStatusResponse,
    },
    state::AppState,
};
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use tracing::{info, warn};
use uuid::Uuid;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/relay", post(relay))
        .route("/relay/{request_id}", get(relay_status))
        .route("/health", get(health))
        .with_state(state)
}

pub async fn relay(
    State(state): State<AppState>,
    Json(payload): Json<RelayRequest>,
) -> Result<Json<RelayQueuedResponse>, ApiError> {
    let item = payload
        .into_pending(state.config.fee_public_input_index, Utc::now())
        .map_err(|error| ApiError::BadRequest(error.to_string()))?;

    let operation = item
        .operation()
        .map_err(|error| ApiError::BadRequest(format!("invalid relay metadata: {error:#}")))?;

    item.validate_public_inputs_against_operation(&operation)
        .map_err(|error| ApiError::BadRequest(format!("public input validation failed: {error:#}")))?;

    if let Some(relayer_index) = state.config.relayer_public_input_index {
        let relayer_word = item.public_inputs.get(relayer_index).ok_or_else(|| {
            ApiError::BadRequest(format!(
                "public_inputs missing relayer index {}, len={}",
                relayer_index,
                item.public_inputs.len()
            ))
        })?;

        let requested_relayer = decode_relayer_address(relayer_word).map_err(|error| {
            ApiError::BadRequest(format!(
                "failed to decode relayer address public input: {error:#}"
            ))
        })?;
        let expected_relayer = state.chain.relayer_address();

        if requested_relayer != expected_relayer {
            warn!(
                request_id = %item.id,
                expected_relayer = %format!("{:#x}", expected_relayer),
                requested_relayer = %format!("{:#x}", requested_relayer),
                "relay request rejected due to relayer mismatch"
            );
            return Err(ApiError::Forbidden(
                "public_inputs relayer address does not match this relayer".to_string(),
            ));
        }
    }

    let estimate = state
        .chain
        .estimate_single_request_fee(&item)
        .await
        .map_err(|error| ApiError::Unprocessable(format!("relay simulation failed: {error:#}")))?;

    if let Some(relayer_fee_wei) = item.relayer_fee_wei {
        if relayer_fee_wei < estimate.min_required_fee_wei {
            return Err(ApiError::Unprocessable(format!(
                "relayer fee {} is below required minimum {}",
                relayer_fee_wei, estimate.min_required_fee_wei
            )));
        }
    }

    let request_id = item.id;
    let queue_len = {
        let mut mempool = state.mempool.write().await;
        mempool
            .push(item)
            .map_err(|error| ApiError::Internal(format!("failed to enqueue request: {error:#}")))?
    };
    {
        let mut statuses = state.relay_statuses.write().await;
        statuses.insert(request_id, RelayRequestStatus::Queued);
    }

    info!(
        request_id = %request_id,
        queue_len,
        gas_estimate = %estimate.gas_estimate,
        gas_price = %estimate.gas_price,
        min_required_fee = %estimate.min_required_fee_wei,
        "relay request queued"
    );

    Ok(Json(RelayQueuedResponse {
        request_id,
        queue_len,
        gas_estimate: estimate.gas_estimate.to_string(),
        min_required_fee_wei: estimate.min_required_fee_wei.to_string(),
    }))
}

pub async fn relay_status(
    Path(request_id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<RelayStatusResponse>, ApiError> {
    let statuses = state.relay_statuses.read().await;
    let Some(status) = statuses.get(&request_id) else {
        return Err(ApiError::NotFound(format!(
            "relay request not found: {request_id}"
        )));
    };

    let (tx_hash, error) = match status {
        RelayRequestStatus::Queued => (None, None),
        RelayRequestStatus::Submitted { tx_hash } => (Some(format!("{:#x}", tx_hash)), None),
        RelayRequestStatus::Failed { error } => (None, Some(error.clone())),
    };

    Ok(Json(RelayStatusResponse {
        request_id,
        status: status.as_str(),
        tx_hash,
        error,
    }))
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let queue_len = state.mempool.read().await.len();
    Json(HealthResponse {
        status: "ok",
        queue_len,
    })
}
