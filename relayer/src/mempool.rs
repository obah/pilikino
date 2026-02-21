use crate::models::{PendingRelayItem, StoredPendingRelayItem};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Default)]
pub struct RelayMempool {
    items: VecDeque<PendingRelayItem>,
    persist_path: PathBuf,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedMempool {
    items: Vec<StoredPendingRelayItem>,
}

impl RelayMempool {
    pub fn load_or_create(path: PathBuf) -> Result<Self> {
        ensure_parent_exists(&path)?;

        if !path.exists() {
            let mempool = Self {
                items: VecDeque::new(),
                persist_path: path,
            };
            mempool.persist()?;
            return Ok(mempool);
        }

        let raw = fs::read_to_string(&path)
            .with_context(|| format!("failed to read mempool state file {}", path.display()))?;
        if raw.trim().is_empty() {
            return Ok(Self {
                items: VecDeque::new(),
                persist_path: path,
            });
        }

        let persisted: PersistedMempool = serde_json::from_str(&raw)
            .with_context(|| format!("failed to parse mempool state file {}", path.display()))?;

        let mut items = VecDeque::with_capacity(persisted.items.len());
        for item in persisted.items {
            items.push_back(item.try_into()?);
        }

        Ok(Self {
            items,
            persist_path: path,
        })
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn oldest_age_secs(&self, now: DateTime<Utc>) -> Option<i64> {
        self.items
            .front()
            .map(|item| (now - item.received_at).num_seconds())
    }

    pub fn push(&mut self, item: PendingRelayItem) -> Result<usize> {
        self.items.push_back(item);
        self.persist()?;
        Ok(self.items.len())
    }

    pub fn snapshot_batch(&self, batch_size: usize) -> Vec<PendingRelayItem> {
        self.items.iter().take(batch_size).cloned().collect()
    }

    pub fn acknowledge_batch(&mut self, batch_size: usize) -> Result<()> {
        if batch_size == 0 {
            return Ok(());
        }

        for _ in 0..batch_size {
            if self.items.pop_front().is_none() {
                break;
            }
        }
        self.persist()
    }

    pub fn persist(&self) -> Result<()> {
        let persisted = PersistedMempool {
            items: self
                .items
                .iter()
                .map(StoredPendingRelayItem::from)
                .collect(),
        };

        let payload =
            serde_json::to_string_pretty(&persisted).context("failed to serialize mempool")?;
        fs::write(&self.persist_path, payload).with_context(|| {
            format!(
                "failed to write mempool state file {}",
                self.persist_path.display()
            )
        })?;
        Ok(())
    }
}

fn ensure_parent_exists(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create mempool dir {}", parent.display()))?;
    }
    Ok(())
}
