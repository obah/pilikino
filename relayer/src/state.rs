use crate::{
    chain::ChainClient,
    config::RelayerConfig,
    mempool::RelayMempool,
    models::RelayRequestStatus,
};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<RelayerConfig>,
    pub chain: Arc<dyn ChainClient>,
    pub mempool: Arc<RwLock<RelayMempool>>,
    pub relay_statuses: Arc<RwLock<HashMap<Uuid, RelayRequestStatus>>>,
}
