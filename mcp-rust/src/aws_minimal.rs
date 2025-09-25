use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use serde_json::Value;
use tokio::sync::RwLock;

use crate::tenant::TenantSession;

#[derive(Error, Debug)]
pub enum AwsError {
    #[error("Mock AWS error: {0}")]
    MockError(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("AWS configuration error: {0}")]
    Config(String),
}

// Mock AWS service for testing without real AWS dependencies
pub struct AwsService {
    // Mock in-memory storage
    kv_store: Arc<RwLock<HashMap<String, String>>>,
    artifacts: Arc<RwLock<HashMap<String, Vec<u8>>>>,
}

impl AwsService {
    pub async fn new(_region: &str) -> Result<Self, AwsError> {
        Ok(Self {
            kv_store: Arc::new(RwLock::new(HashMap::new())),
            artifacts: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    // KV Store operations (mock)
    pub async fn kv_get(&self, session: &TenantSession, key: &str) -> Result<Option<String>, AwsError> {
        let tenant_key = format!("{}:{}", session.context.tenant_id, key);
        let store = self.kv_store.read().await;
        Ok(store.get(&tenant_key).cloned())
    }

    pub async fn kv_set(&self, session: &TenantSession, key: &str, value: &str, _ttl_hours: Option<u32>) -> Result<(), AwsError> {
        let tenant_key = format!("{}:{}", session.context.tenant_id, key);
        let mut store = self.kv_store.write().await;
        store.insert(tenant_key, value.to_string());
        Ok(())
    }

    // Artifacts operations (mock)
    pub async fn artifacts_put(&self, session: &TenantSession, key: &str, content: &[u8], _content_type: &str) -> Result<(), AwsError> {
        let tenant_key = format!("{}/{}", session.context.tenant_id, key);
        let mut artifacts = self.artifacts.write().await;
        artifacts.insert(tenant_key, content.to_vec());
        Ok(())
    }

    pub async fn artifacts_get(&self, session: &TenantSession, key: &str) -> Result<Option<Vec<u8>>, AwsError> {
        let tenant_key = format!("{}/{}", session.context.tenant_id, key);
        let artifacts = self.artifacts.read().await;
        Ok(artifacts.get(&tenant_key).cloned())
    }

    pub async fn artifacts_list(&self, session: &TenantSession, prefix: Option<&str>) -> Result<Vec<String>, AwsError> {
        let tenant_prefix = match prefix {
            Some(p) => format!("{}/{}", session.context.tenant_id, p),
            None => format!("{}/", session.context.tenant_id),
        };

        let artifacts = self.artifacts.read().await;
        let keys: Vec<String> = artifacts
            .keys()
            .filter(|key| key.starts_with(&tenant_prefix))
            .filter_map(|key| key.strip_prefix(&format!("{}/", session.context.tenant_id)))
            .map(|s| s.to_string())
            .collect();

        Ok(keys)
    }

    // Event operations (mock)
    pub async fn send_event(&self, session: &TenantSession, detail_type: &str, detail: Value) -> Result<(), AwsError> {
        // Mock event sending - just log it
        println!("Mock Event Sent:");
        println!("  Tenant: {}", session.context.tenant_id);
        println!("  Detail Type: {}", detail_type);
        println!("  Detail: {}", serde_json::to_string_pretty(&detail)?);
        Ok(())
    }
}