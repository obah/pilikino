use crate::models::RelayRequestStatus;
use crate::state::AppState;
use chrono::Utc;
use std::time::Duration;
use tokio::time::sleep;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

const EMPTY_QUEUE_SLEEP_MS: u64 = 1_000;
const NON_EMPTY_QUEUE_SLEEP_MS: u64 = 300;
const SUBMIT_FAILURE_SLEEP_SECS: u64 = 2;

pub async fn run_batch_worker(state: AppState, shutdown: CancellationToken) {
    info!(
        batch_size = state.config.batch_size,
        max_wait_secs = state.config.batch_max_wait_secs,
        "relay batch worker started"
    );

    loop {
        if shutdown.is_cancelled() {
            break;
        }

        let (queue_len, should_submit) = {
            let mempool = state.mempool.read().await;
            let len = mempool.len();
            let oldest_age_secs = mempool.oldest_age_secs(Utc::now()).unwrap_or(0);
            let due_to_size = len >= state.config.batch_size;
            let due_to_age = len > 0 && oldest_age_secs >= state.config.batch_max_wait_secs as i64;
            (len, due_to_size || due_to_age)
        };

        if !should_submit {
            let sleep_for = if queue_len == 0 {
                Duration::from_millis(EMPTY_QUEUE_SLEEP_MS)
            } else {
                Duration::from_millis(NON_EMPTY_QUEUE_SLEEP_MS)
            };

            tokio::select! {
                _ = shutdown.cancelled() => break,
                _ = sleep(sleep_for) => {}
            }
            continue;
        }

        let batch = {
            let mempool = state.mempool.read().await;
            mempool.snapshot_batch(state.config.batch_size)
        };

        if batch.is_empty() {
            continue;
        }

        let mut hit_failure = false;
        for item in &batch {
            match state.chain.submit_item(item).await {
                Ok(tx_hash) => {
                    let mut mempool = state.mempool.write().await;
                    if let Err(error) = mempool.acknowledge_batch(1) {
                        error!(
                            tx_hash = %format!("{:#x}", tx_hash),
                            request_id = %item.id,
                            error = %error,
                            "item submitted but failed to persist mempool ack"
                        );
                        hit_failure = true;
                        break;
                    }
                    let queue_len = mempool.len();
                    drop(mempool);

                    {
                        let mut statuses = state.relay_statuses.write().await;
                        statuses.insert(item.id, RelayRequestStatus::Submitted { tx_hash });
                    }

                    info!(
                        tx_hash = %format!("{:#x}", tx_hash),
                        request_id = %item.id,
                        queue_len,
                        "relay request submitted successfully"
                    );
                }
                Err(error) => {
                    warn!(
                        request_id = %item.id,
                        error = %error,
                        "relay request submission failed; item left in queue"
                    );
                    hit_failure = true;
                    break;
                }
            }
        }

        if hit_failure {
            tokio::select! {
                _ = shutdown.cancelled() => break,
                _ = sleep(Duration::from_secs(SUBMIT_FAILURE_SLEEP_SECS)) => {}
            }
        }
    }

    info!("relay batch worker stopped");
}
