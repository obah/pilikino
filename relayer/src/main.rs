mod api;
mod chain;
mod config;
mod errors;
mod mempool;
mod models;
mod state;
mod worker;

use crate::chain::{ChainClient, ChainService};
use crate::{
    config::RelayerConfig, mempool::RelayMempool, state::AppState, worker::run_batch_worker,
};
use anyhow::{Context, Result};
#[cfg(not(unix))]
use std::future::pending;
use std::{collections::HashMap, sync::Arc};
use tokio::{net::TcpListener, sync::RwLock};
use tokio_util::sync::CancellationToken;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = Arc::new(RelayerConfig::from_env().context("failed to load relayer config")?);
    let mempool = RelayMempool::load_or_create(config.mempool_path.clone())
        .context("failed to load mempool")?;
    let mempool = Arc::new(RwLock::new(mempool));

    let chain: Arc<dyn ChainClient> = Arc::new(
        ChainService::new(config.clone())
            .await
            .context("failed to init chain")?,
    );

    let state = AppState {
        config: config.clone(),
        chain: chain.clone(),
        mempool: mempool.clone(),
        relay_statuses: Arc::new(RwLock::new(HashMap::new())),
    };

    let shutdown = CancellationToken::new();
    let worker_shutdown = shutdown.child_token();
    let worker_state = state.clone();
    let worker_handle = tokio::spawn(async move {
        run_batch_worker(worker_state, worker_shutdown).await;
    });

    let app = api::build_router(state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let listener = TcpListener::bind(config.bind_addr)
        .await
        .with_context(|| format!("failed to bind {}", config.bind_addr))?;

    info!(
        bind_addr = %config.bind_addr,
        relayer_address = %format!("{:#x}", chain.relayer_address()),
        "pilikino relayer started"
    );

    let serve_result = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutdown.clone()))
        .await;

    shutdown.cancel();

    if let Err(join_error) = worker_handle.await {
        error!(error = %join_error, "worker task join failed");
    }

    if let Err(error) = mempool.read().await.persist() {
        error!(error = %error, "failed to persist mempool during shutdown");
    }

    serve_result.context("axum server error")?;
    info!("pilikino relayer shutdown complete");
    Ok(())
}

async fn shutdown_signal(shutdown: CancellationToken) {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            error!(error = %error, "failed to listen for ctrl+c");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(error) => {
                error!(error = %error, "failed to listen for SIGTERM");
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }

    shutdown.cancel();
    info!("shutdown signal received");
}

fn init_tracing() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,hyper=warn,tower_http=warn"));

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(false)
        .json()
        .init();
}
