use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_eventbridge::Client as EventBridgeClient;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_secretsmanager::Client as SecretsManagerClient;
use serde_json::Value;
use std::sync::Arc;
use thiserror::Error;

use crate::tenant::TenantSession;

#[derive(Error, Debug)]
pub enum AwsError {
    #[error("DynamoDB error: {0}")]
    DynamoDb(String),
    #[error("S3 error: {0}")]
    S3(String),
    #[error("EventBridge error: {0}")]
    EventBridge(String),
    #[error("SecretsManager error: {0}")]
    SecretsManager(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("AWS configuration error: {0}")]
    Config(String),
}

pub struct AwsClients {
    pub dynamodb: DynamoDbClient,
    pub s3: S3Client,
    pub eventbridge: EventBridgeClient,
    pub secrets_manager: SecretsManagerClient,
}

impl AwsClients {
    pub async fn new(_region: &str) -> Result<Self, AwsError> {
        let config = aws_config::load_from_env().await;

        Ok(Self {
            dynamodb: DynamoDbClient::new(&config),
            s3: S3Client::new(&config),
            eventbridge: EventBridgeClient::new(&config),
            secrets_manager: SecretsManagerClient::new(&config),
        })
    }
}

pub struct AwsService {
    clients: Arc<AwsClients>,
    kv_table: String,
    artifacts_bucket: String,
    event_bus: String,
}

impl AwsService {
    pub async fn new(region: &str) -> Result<Self, AwsError> {
        let clients = Arc::new(AwsClients::new(region).await?);

        Ok(Self {
            clients,
            kv_table: std::env::var("AGENT_MESH_KV_TABLE")
                .unwrap_or_else(|_| "agent-mesh-kv".to_string()),
            artifacts_bucket: std::env::var("AGENT_MESH_ARTIFACTS_BUCKET")
                .unwrap_or_else(|_| "agent-mesh-artifacts".to_string()),
            event_bus: std::env::var("AGENT_MESH_EVENT_BUS")
                .unwrap_or_else(|_| "agent-mesh-events".to_string()),
        })
    }

    // KV Store operations
    pub async fn kv_get(
        &self,
        session: &TenantSession,
        key: &str,
    ) -> Result<Option<String>, AwsError> {
        let tenant_key = format!("{}:{}", session.context.tenant_id, key);

        let result = self
            .clients
            .dynamodb
            .get_item()
            .table_name(&self.kv_table)
            .key(
                "key",
                aws_sdk_dynamodb::types::AttributeValue::S(tenant_key),
            )
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        if let Some(item) = result.item {
            if let Some(value) = item.get("value") {
                if let Ok(s_val) = value.as_s() {
                    return Ok(Some(s_val.clone()));
                }
            }
        }

        Ok(None)
    }

    pub async fn kv_set(
        &self,
        session: &TenantSession,
        key: &str,
        value: &str,
        ttl_hours: Option<u32>,
    ) -> Result<(), AwsError> {
        let tenant_key = format!("{}:{}", session.context.tenant_id, key);
        let now = chrono::Utc::now().timestamp();

        // Prepare DynamoDB item
        let mut put_request = self
            .clients
            .dynamodb
            .put_item()
            .table_name(&self.kv_table)
            .item(
                "key",
                aws_sdk_dynamodb::types::AttributeValue::S(tenant_key),
            )
            .item(
                "value",
                aws_sdk_dynamodb::types::AttributeValue::S(value.to_string()),
            )
            .item(
                "created_at",
                aws_sdk_dynamodb::types::AttributeValue::N(now.to_string()),
            );

        if let Some(ttl) = ttl_hours {
            let expiry = now + (ttl as i64 * 3600);
            put_request = put_request.item(
                "expires_at",
                aws_sdk_dynamodb::types::AttributeValue::N(expiry.to_string()),
            );
        }

        put_request
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;
        Ok(())
    }

    // Artifacts operations
    pub async fn artifacts_put(
        &self,
        session: &TenantSession,
        key: &str,
        content: &[u8],
        content_type: &str,
    ) -> Result<(), AwsError> {
        let tenant_key = format!("{}/{}", session.context.tenant_id, key);

        self.clients
            .s3
            .put_object()
            .bucket(&self.artifacts_bucket)
            .key(tenant_key)
            .body(aws_sdk_s3::primitives::ByteStream::from(content.to_vec()))
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| AwsError::S3(e.to_string()))?;

        Ok(())
    }

    pub async fn artifacts_get(
        &self,
        session: &TenantSession,
        key: &str,
    ) -> Result<Option<Vec<u8>>, AwsError> {
        let tenant_key = format!("{}/{}", session.context.tenant_id, key);

        match self
            .clients
            .s3
            .get_object()
            .bucket(&self.artifacts_bucket)
            .key(tenant_key)
            .send()
            .await
        {
            Ok(result) => {
                let body = result
                    .body
                    .collect()
                    .await
                    .map_err(|e| AwsError::Config(e.to_string()))?;
                Ok(Some(body.into_bytes().to_vec()))
            }
            Err(e) if e.to_string().contains("NoSuchKey") => Ok(None),
            Err(e) => Err(AwsError::S3(e.to_string())),
        }
    }

    pub async fn artifacts_list(
        &self,
        session: &TenantSession,
        prefix: Option<&str>,
    ) -> Result<Vec<String>, AwsError> {
        let tenant_prefix = match prefix {
            Some(p) => format!("{}/{}", session.context.tenant_id, p),
            None => format!("{}/", session.context.tenant_id),
        };

        let result = self
            .clients
            .s3
            .list_objects_v2()
            .bucket(&self.artifacts_bucket)
            .prefix(tenant_prefix)
            .send()
            .await
            .map_err(|e| AwsError::S3(e.to_string()))?;

        let mut keys = Vec::new();
        if let Some(contents) = result.contents {
            for object in contents {
                if let Some(key) = object.key {
                    // Remove tenant prefix from key
                    if let Some(relative_key) =
                        key.strip_prefix(&format!("{}/", session.context.tenant_id))
                    {
                        keys.push(relative_key.to_string());
                    }
                }
            }
        }

        Ok(keys)
    }

    // Event operations
    pub async fn send_event(
        &self,
        session: &TenantSession,
        detail_type: &str,
        detail: Value,
    ) -> Result<(), AwsError> {
        let mut event_detail = detail;
        if let Value::Object(ref mut map) = event_detail {
            map.insert(
                "tenant_id".to_string(),
                Value::String(session.context.tenant_id.clone()),
            );
            map.insert(
                "user_id".to_string(),
                Value::String(session.context.user_id.clone()),
            );
        }

        let result = self
            .clients
            .eventbridge
            .put_events()
            .entries(
                aws_sdk_eventbridge::types::PutEventsRequestEntry::builder()
                    .source("mcp-rust")
                    .detail_type(detail_type)
                    .detail(serde_json::to_string(&event_detail)?)
                    .event_bus_name(&self.event_bus)
                    .build(),
            )
            .send()
            .await;

        match result {
            Ok(_) => {}
            Err(e) => return Err(AwsError::Config(format!("EventBridge error: {}", e))),
        }

        Ok(())
    }
}
