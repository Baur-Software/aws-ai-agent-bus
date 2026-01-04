use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_eventbridge::Client as EventBridgeClient;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_secretsmanager::Client as SecretsManagerClient;
use serde_json::{json, Value};
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
    #[allow(dead_code)]
    EventBridge(String),
    #[error("SecretsManager error: {0}")]
    #[allow(dead_code)]
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

        let kv_table =
            std::env::var("AGENT_MESH_KV_TABLE").unwrap_or_else(|_| "agent-mesh-kv".to_string());
        let artifacts_bucket = std::env::var("AGENT_MESH_ARTIFACTS_BUCKET")
            .unwrap_or_else(|_| "agent-mesh-artifacts".to_string());
        let event_bus = std::env::var("AGENT_MESH_EVENT_BUS")
            .unwrap_or_else(|_| "agent-mesh-events".to_string());

        eprintln!("[MCP Server] AWS Configuration:");
        eprintln!("[MCP Server]   KV Table: {}", kv_table);
        eprintln!("[MCP Server]   Artifacts Bucket: {}", artifacts_bucket);
        eprintln!("[MCP Server]   Event Bus: {}", event_bus);

        Ok(Self {
            clients,
            kv_table,
            artifacts_bucket,
            event_bus,
        })
    }

    // KV Store operations
    pub async fn kv_get(
        &self,
        session: &TenantSession,
        key: &str,
    ) -> Result<Option<String>, AwsError> {
        // Use context-aware namespacing
        let tenant_key = format!("{}:{}", session.context.get_namespace_prefix(), key);

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
        // Use context-aware namespacing
        let tenant_key = format!("{}:{}", session.context.get_namespace_prefix(), key);
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
        let tenant_key = format!("{}/{}", session.context.get_context_id(), key);

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
        let tenant_key = format!("{}/{}", session.context.get_context_id(), key);

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
            Some(p) => format!("{}/{}", session.context.get_context_id(), p),
            None => format!("{}/", session.context.get_context_id()),
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

    // Query events from DynamoDB events table
    #[allow(clippy::too_many_arguments)]
    pub async fn query_events(
        &self,
        user_id: Option<String>,
        organization_id: Option<String>,
        source: Option<String>,
        detail_type: Option<String>,
        priority: Option<String>,
        start_time: Option<String>,
        end_time: Option<String>,
        limit: i32,
        exclusive_start_key: Option<String>,
        ascending: bool,
    ) -> Result<Value, AwsError> {
        use aws_sdk_dynamodb::types::AttributeValue;

        // Determine table name from environment
        let events_table = std::env::var("AGENT_MESH_EVENTS_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-events".to_string());

        // Build query based on available filters
        // Priority: user_id > source > table scan
        let mut query_builder = if let Some(uid) = user_id.as_ref() {
            // Use user-index GSI
            self.clients
                .dynamodb
                .query()
                .table_name(&events_table)
                .index_name("user-index")
                .key_condition_expression("#userId = :userId")
                .expression_attribute_names("#userId", "userId")
                .expression_attribute_values(":userId", AttributeValue::S(uid.clone()))
        } else if let Some(src) = source.as_ref() {
            // Use timestamp-index GSI
            self.clients
                .dynamodb
                .query()
                .table_name(&events_table)
                .index_name("timestamp-index")
                .key_condition_expression("#source = :source")
                .expression_attribute_names("#source", "source")
                .expression_attribute_values(":source", AttributeValue::S(src.clone()))
        } else {
            // Fall back to scan (expensive!)
            // In production, we should always have userId or source filter
            return Err(AwsError::Config(
                "Query requires userId or source filter to avoid expensive scan".to_string(),
            ));
        };

        // Add time range filter if provided
        if let (Some(start), Some(end)) = (start_time.as_ref(), end_time.as_ref()) {
            if user_id.is_some() {
                query_builder = query_builder
                    .key_condition_expression(
                        "#userId = :userId AND #timestamp BETWEEN :start AND :end",
                    )
                    .expression_attribute_names("#timestamp", "timestamp")
                    .expression_attribute_values(":start", AttributeValue::S(start.clone()))
                    .expression_attribute_values(":end", AttributeValue::S(end.clone()));
            } else if source.is_some() {
                query_builder = query_builder
                    .key_condition_expression(
                        "#source = :source AND #timestamp BETWEEN :start AND :end",
                    )
                    .expression_attribute_names("#timestamp", "timestamp")
                    .expression_attribute_values(":start", AttributeValue::S(start.clone()))
                    .expression_attribute_values(":end", AttributeValue::S(end.clone()));
            }
        } else if let Some(start) = start_time.as_ref() {
            if user_id.is_some() {
                query_builder = query_builder
                    .key_condition_expression("#userId = :userId AND #timestamp >= :start")
                    .expression_attribute_names("#timestamp", "timestamp")
                    .expression_attribute_values(":start", AttributeValue::S(start.clone()));
            } else if source.is_some() {
                query_builder = query_builder
                    .key_condition_expression("#source = :source AND #timestamp >= :start")
                    .expression_attribute_names("#timestamp", "timestamp")
                    .expression_attribute_values(":start", AttributeValue::S(start.clone()));
            }
        }

        // Add filter expressions for additional filters
        let mut filter_expression_parts = Vec::new();

        if let Some(dt) = detail_type.as_ref() {
            filter_expression_parts.push("#detailType = :detailType".to_string());
            query_builder = query_builder
                .expression_attribute_names("#detailType", "detailType")
                .expression_attribute_values(":detailType", AttributeValue::S(dt.clone()));
        }

        if let Some(prio) = priority.as_ref() {
            filter_expression_parts.push("#priority = :priority".to_string());
            query_builder = query_builder
                .expression_attribute_names("#priority", "priority")
                .expression_attribute_values(":priority", AttributeValue::S(prio.clone()));
        }

        if let Some(org_id) = organization_id.as_ref() {
            filter_expression_parts.push("#organizationId = :organizationId".to_string());
            query_builder = query_builder
                .expression_attribute_names("#organizationId", "organizationId")
                .expression_attribute_values(":organizationId", AttributeValue::S(org_id.clone()));
        }

        if !filter_expression_parts.is_empty() {
            query_builder = query_builder.filter_expression(filter_expression_parts.join(" AND "));
        }

        // Set limit
        query_builder = query_builder.limit(limit);

        // Set scan direction
        query_builder = query_builder.scan_index_forward(ascending);

        // Add pagination cursor if provided
        if let Some(_start_key) = exclusive_start_key {
            // TODO: Parse start key (simplified - in production would be proper DynamoDB key)
            // For now, we'll skip this since it requires proper key deserialization
        }

        // Execute query
        let result = query_builder
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        // Convert DynamoDB items to JSON
        let mut events = Vec::new();
        if let Some(ref items) = result.items {
            for item in items {
                let mut event = serde_json::Map::new();

                for (key, value) in item {
                    let json_value = match value {
                        AttributeValue::S(s) => Value::String(s.clone()),
                        AttributeValue::N(n) => {
                            if let Ok(num) = n.parse::<i64>() {
                                Value::Number(num.into())
                            } else if let Ok(num) = n.parse::<f64>() {
                                Value::Number(serde_json::Number::from_f64(num).unwrap_or(0.into()))
                            } else {
                                Value::String(n.clone())
                            }
                        }
                        AttributeValue::Bool(b) => Value::Bool(*b),
                        _ => Value::String(format!("{:?}", value)),
                    };
                    event.insert(key.clone(), json_value);
                }

                events.push(Value::Object(event));
            }
        }

        // Build response
        let response = serde_json::json!({
            "events": events,
            "count": events.len(),
            "lastEvaluatedKey": result.last_evaluated_key().map(|k| format!("{:?}", k))
        });

        Ok(response)
    }

    // Analytics query for event metrics
    #[allow(clippy::too_many_arguments)]
    pub async fn analytics_query(
        &self,
        session: &TenantSession,
        user_id: Option<String>,
        organization_id: Option<String>,
        start_time: Option<String>,
        end_time: Option<String>,
        metrics: Vec<String>,
        granularity: String,
    ) -> Result<Value, AwsError> {
        // Generate cache key
        let scope = if let Some(org_id) = &organization_id {
            format!("org-{}", org_id)
        } else if let Some(uid) = &user_id {
            format!("user-{}", uid)
        } else {
            format!("user-{}", session.context.user_id)
        };

        let time_range = format!(
            "{}-{}",
            start_time.as_deref().unwrap_or("24h"),
            end_time.as_deref().unwrap_or("now")
        );
        let cache_key = format!("analytics-{}-{}", scope, time_range);

        // Check cache (5 minute TTL)
        if let Ok(Some(cached)) = self.kv_get_direct(&cache_key).await {
            if let Ok(cached_value) = serde_json::from_str::<Value>(&cached) {
                tracing::info!("Returning cached analytics for {}", cache_key);
                return Ok(cached_value);
            }
        }

        // Query events for analytics
        let events_table = std::env::var("AGENT_MESH_EVENTS_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-events".to_string());

        // Default time window: last 24 hours
        let end_dt = if let Some(et) = end_time {
            chrono::DateTime::parse_from_rfc3339(&et)
                .map_err(|e| AwsError::Config(format!("Invalid endTime: {}", e)))?
                .with_timezone(&chrono::Utc)
        } else {
            chrono::Utc::now()
        };

        let start_dt = if let Some(st) = start_time {
            chrono::DateTime::parse_from_rfc3339(&st)
                .map_err(|e| AwsError::Config(format!("Invalid startTime: {}", e)))?
                .with_timezone(&chrono::Utc)
        } else {
            end_dt - chrono::Duration::hours(24)
        };

        // Query events using timestamp-index
        let mut query_builder = self
            .clients
            .dynamodb
            .query()
            .table_name(&events_table)
            .index_name("timestamp-index")
            .key_condition_expression("#timestamp BETWEEN :start AND :end")
            .expression_attribute_names("#timestamp", "timestamp")
            .expression_attribute_values(
                ":start",
                aws_sdk_dynamodb::types::AttributeValue::S(start_dt.to_rfc3339()),
            )
            .expression_attribute_values(
                ":end",
                aws_sdk_dynamodb::types::AttributeValue::S(end_dt.to_rfc3339()),
            );

        // Add user/org filtering
        if let Some(uid) = user_id.as_ref() {
            query_builder = query_builder
                .filter_expression("#userId = :userId")
                .expression_attribute_names("#userId", "userId")
                .expression_attribute_values(
                    ":userId",
                    aws_sdk_dynamodb::types::AttributeValue::S(uid.clone()),
                );
        } else if let Some(org_id) = organization_id.as_ref() {
            query_builder = query_builder
                .filter_expression("#organizationId = :organizationId")
                .expression_attribute_names("#organizationId", "organizationId")
                .expression_attribute_values(
                    ":organizationId",
                    aws_sdk_dynamodb::types::AttributeValue::S(org_id.clone()),
                );
        }

        let result = query_builder
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        // Process events for analytics
        let mut volume_buckets: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();
        let mut source_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();
        let mut priority_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();
        let mut event_type_counts: std::collections::HashMap<String, i32> =
            std::collections::HashMap::new();

        if let Some(ref items) = result.items {
            for item in items {
                // Extract timestamp for volume buckets
                if let Some(timestamp_attr) = item.get("timestamp") {
                    if let Ok(ts_str) = timestamp_attr.as_s() {
                        if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(ts_str) {
                            let bucket_key = if granularity == "hourly" {
                                ts.format("%Y-%m-%d %H:00").to_string()
                            } else {
                                ts.format("%Y-%m-%d").to_string()
                            };
                            *volume_buckets.entry(bucket_key).or_insert(0) += 1;
                        }
                    }
                }

                // Count sources
                if let Some(source_attr) = item.get("source") {
                    if let Ok(source) = source_attr.as_s() {
                        *source_counts.entry(source.clone()).or_insert(0) += 1;
                    }
                }

                // Count priorities
                if let Some(priority_attr) = item.get("priority") {
                    if let Ok(priority) = priority_attr.as_s() {
                        *priority_counts.entry(priority.clone()).or_insert(0) += 1;
                    }
                }

                // Count event types
                if let Some(detail_type_attr) = item.get("detailType") {
                    if let Ok(detail_type) = detail_type_attr.as_s() {
                        *event_type_counts.entry(detail_type.clone()).or_insert(0) += 1;
                    }
                }
            }
        }

        // Build response based on requested metrics
        let mut analytics = serde_json::Map::new();

        if metrics.contains(&"volume".to_string()) {
            let mut buckets: Vec<_> = volume_buckets
                .into_iter()
                .map(|(bucket, count)| json!({ "bucket": bucket, "count": count }))
                .collect();
            buckets.sort_by(|a, b| a["bucket"].as_str().cmp(&b["bucket"].as_str()));
            analytics.insert(
                "volume".to_string(),
                json!({
                    "granularity": granularity,
                    "buckets": buckets
                }),
            );
        }

        if metrics.contains(&"topSources".to_string()) {
            let mut sources: Vec<_> = source_counts.into_iter().collect();
            sources.sort_by(|a, b| b.1.cmp(&a.1)); // Descending by count
            let top_sources: Vec<_> = sources
                .into_iter()
                .map(|(source, count)| json!({ "source": source, "count": count }))
                .collect();
            analytics.insert("topSources".to_string(), json!(top_sources));
        }

        if metrics.contains(&"priority".to_string()) {
            analytics.insert(
                "priority".to_string(),
                json!({
                    "low": priority_counts.get("low").unwrap_or(&0),
                    "medium": priority_counts.get("medium").unwrap_or(&0),
                    "high": priority_counts.get("high").unwrap_or(&0),
                    "critical": priority_counts.get("critical").unwrap_or(&0)
                }),
            );
        }

        if metrics.contains(&"eventTypes".to_string()) {
            let mut types: Vec<_> = event_type_counts.into_iter().collect();
            types.sort_by(|a, b| b.1.cmp(&a.1)); // Descending by count
            let event_types: Vec<_> = types
                .into_iter()
                .map(|(event_type, count)| json!({ "eventType": event_type, "count": count }))
                .collect();
            analytics.insert("eventTypes".to_string(), json!(event_types));
        }

        let response = json!({
            "scope": scope,
            "startTime": start_dt.to_rfc3339(),
            "endTime": end_dt.to_rfc3339(),
            "analytics": analytics,
            "cached": false
        });

        // Cache the result (5 minute TTL = 300 seconds)
        let cache_value = serde_json::to_string(&response).unwrap();
        let ttl = (chrono::Utc::now().timestamp() + 300) as u32;
        if let Err(e) = self
            .kv_set_direct(&cache_key, &cache_value, Some(ttl))
            .await
        {
            tracing::warn!("Failed to cache analytics: {}", e);
        }

        Ok(response)
    }

    // Create event rule
    pub async fn create_event_rule(
        &self,
        session: &TenantSession,
        name: &str,
        pattern: Value,
        description: Option<String>,
        enabled: bool,
    ) -> Result<Value, AwsError> {
        let event_rules_table = std::env::var("AGENT_MESH_EVENT_RULES_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-event-rules".to_string());

        // Generate unique rule ID
        let rule_id = format!("rule-{}-{}", session.context.user_id, uuid::Uuid::new_v4());
        let timestamp = chrono::Utc::now().to_rfc3339();

        // Store rule in DynamoDB
        let mut put_item = self
            .clients
            .dynamodb
            .put_item()
            .table_name(&event_rules_table)
            .item(
                "ruleId",
                aws_sdk_dynamodb::types::AttributeValue::S(rule_id.clone()),
            )
            .item(
                "userId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.user_id.clone()),
            )
            .item(
                "organizationId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.organization_id.clone()),
            )
            .item(
                "name",
                aws_sdk_dynamodb::types::AttributeValue::S(name.to_string()),
            )
            .item(
                "pattern",
                aws_sdk_dynamodb::types::AttributeValue::S(serde_json::to_string(&pattern)?),
            )
            .item(
                "enabled",
                aws_sdk_dynamodb::types::AttributeValue::Bool(enabled),
            )
            .item(
                "createdAt",
                aws_sdk_dynamodb::types::AttributeValue::S(timestamp.clone()),
            )
            .item(
                "updatedAt",
                aws_sdk_dynamodb::types::AttributeValue::S(timestamp.clone()),
            );

        if let Some(desc) = description.as_ref() {
            put_item = put_item.item(
                "description",
                aws_sdk_dynamodb::types::AttributeValue::S(desc.clone()),
            );
        }

        put_item
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        Ok(json!({
            "ruleId": rule_id,
            "name": name,
            "pattern": pattern,
            "description": description,
            "enabled": enabled,
            "createdAt": timestamp
        }))
    }

    // Create alert subscription
    #[allow(clippy::too_many_arguments)]
    pub async fn create_alert_subscription(
        &self,
        session: &TenantSession,
        name: &str,
        rule_id: &str,
        notification_method: &str,
        sns_topic_arn: Option<String>,
        email_address: Option<String>,
        enabled: bool,
    ) -> Result<Value, AwsError> {
        let subscriptions_table = std::env::var("AGENT_MESH_SUBSCRIPTIONS_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-subscriptions".to_string());

        // Generate unique subscription ID
        let subscription_id = format!("sub-{}-{}", session.context.user_id, uuid::Uuid::new_v4());
        let timestamp = chrono::Utc::now().to_rfc3339();

        // Store subscription in DynamoDB
        let mut put_item = self
            .clients
            .dynamodb
            .put_item()
            .table_name(&subscriptions_table)
            .item(
                "subscriptionId",
                aws_sdk_dynamodb::types::AttributeValue::S(subscription_id.clone()),
            )
            .item(
                "userId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.user_id.clone()),
            )
            .item(
                "organizationId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.organization_id.clone()),
            )
            .item(
                "name",
                aws_sdk_dynamodb::types::AttributeValue::S(name.to_string()),
            )
            .item(
                "ruleId",
                aws_sdk_dynamodb::types::AttributeValue::S(rule_id.to_string()),
            )
            .item(
                "notificationMethod",
                aws_sdk_dynamodb::types::AttributeValue::S(notification_method.to_string()),
            )
            .item(
                "enabled",
                aws_sdk_dynamodb::types::AttributeValue::Bool(enabled),
            )
            .item(
                "createdAt",
                aws_sdk_dynamodb::types::AttributeValue::S(timestamp.clone()),
            )
            .item(
                "updatedAt",
                aws_sdk_dynamodb::types::AttributeValue::S(timestamp.clone()),
            );

        if let Some(arn) = sns_topic_arn.as_ref() {
            put_item = put_item.item(
                "snsTopicArn",
                aws_sdk_dynamodb::types::AttributeValue::S(arn.clone()),
            );
        }

        if let Some(email) = email_address.as_ref() {
            put_item = put_item.item(
                "emailAddress",
                aws_sdk_dynamodb::types::AttributeValue::S(email.clone()),
            );
        }

        put_item
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        Ok(json!({
            "subscriptionId": subscription_id,
            "name": name,
            "ruleId": rule_id,
            "notificationMethod": notification_method,
            "snsTopicArn": sns_topic_arn,
            "emailAddress": email_address,
            "enabled": enabled,
            "createdAt": timestamp
        }))
    }

    // Events health check
    pub async fn events_health_check(&self, session: &TenantSession) -> Result<Value, AwsError> {
        let events_table = std::env::var("AGENT_MESH_EVENTS_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-events".to_string());
        let rules_table = std::env::var("AGENT_MESH_EVENT_RULES_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-event-rules".to_string());
        let subscriptions_table = std::env::var("AGENT_MESH_SUBSCRIPTIONS_TABLE")
            .unwrap_or_else(|_| "agent-mesh-dev-subscriptions".to_string());

        // Check events table - count user's events from last 24 hours
        let end_time = chrono::Utc::now();
        let start_time = end_time - chrono::Duration::hours(24);

        let events_result = self
            .clients
            .dynamodb
            .query()
            .table_name(&events_table)
            .index_name("user-index")
            .key_condition_expression("#userId = :userId")
            .filter_expression("#timestamp BETWEEN :start AND :end")
            .expression_attribute_names("#userId", "userId")
            .expression_attribute_names("#timestamp", "timestamp")
            .expression_attribute_values(
                ":userId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.user_id.clone()),
            )
            .expression_attribute_values(
                ":start",
                aws_sdk_dynamodb::types::AttributeValue::S(start_time.to_rfc3339()),
            )
            .expression_attribute_values(
                ":end",
                aws_sdk_dynamodb::types::AttributeValue::S(end_time.to_rfc3339()),
            )
            .select(aws_sdk_dynamodb::types::Select::Count)
            .send()
            .await;

        let events_count = events_result.map(|r| r.count()).unwrap_or(0);

        // Check rules table - count user's rules
        let rules_result = self
            .clients
            .dynamodb
            .query()
            .table_name(&rules_table)
            .index_name("user-index")
            .key_condition_expression("#userId = :userId")
            .expression_attribute_names("#userId", "userId")
            .expression_attribute_values(
                ":userId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.user_id.clone()),
            )
            .select(aws_sdk_dynamodb::types::Select::Count)
            .send()
            .await;

        let rules_count = rules_result.map(|r| r.count()).unwrap_or(0);

        // Check subscriptions table - count user's subscriptions
        let subscriptions_result = self
            .clients
            .dynamodb
            .query()
            .table_name(&subscriptions_table)
            .index_name("user-index")
            .key_condition_expression("#userId = :userId")
            .expression_attribute_names("#userId", "userId")
            .expression_attribute_values(
                ":userId",
                aws_sdk_dynamodb::types::AttributeValue::S(session.context.user_id.clone()),
            )
            .select(aws_sdk_dynamodb::types::Select::Count)
            .send()
            .await;

        let subscriptions_count = subscriptions_result.map(|r| r.count()).unwrap_or(0);

        // Determine overall health status
        let status = if events_count > 0 || rules_count > 0 || subscriptions_count > 0 {
            "healthy"
        } else {
            "idle" // No data yet, but system is operational
        };

        Ok(json!({
            "status": status,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "checks": {
                "eventsTable": {
                    "name": events_table,
                    "count24h": events_count,
                    "status": "ok"
                },
                "rulesTable": {
                    "name": rules_table,
                    "count": rules_count,
                    "status": "ok"
                },
                "subscriptionsTable": {
                    "name": subscriptions_table,
                    "count": subscriptions_count,
                    "status": "ok"
                }
            }
        }))
    }

    // Direct KV operations without session (for internal use)
    pub async fn kv_get_direct(&self, key: &str) -> Result<Option<String>, AwsError> {
        let result = self
            .clients
            .dynamodb
            .get_item()
            .table_name(&self.kv_table)
            .key(
                "key",
                aws_sdk_dynamodb::types::AttributeValue::S(key.to_string()),
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

    pub async fn kv_set_direct(
        &self,
        key: &str,
        value: &str,
        ttl_hours: Option<u32>,
    ) -> Result<(), AwsError> {
        let now = chrono::Utc::now().timestamp();

        // Prepare DynamoDB item
        let mut put_request = self
            .clients
            .dynamodb
            .put_item()
            .table_name(&self.kv_table)
            .item(
                "key",
                aws_sdk_dynamodb::types::AttributeValue::S(key.to_string()),
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

    pub async fn kv_list(&self, prefix: &str) -> Result<Vec<String>, AwsError> {
        let result = self
            .clients
            .dynamodb
            .scan()
            .table_name(&self.kv_table)
            .filter_expression("begins_with(#k, :prefix)")
            .expression_attribute_names("#k", "key")
            .expression_attribute_values(
                ":prefix",
                aws_sdk_dynamodb::types::AttributeValue::S(prefix.to_string()),
            )
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        let mut keys = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                if let Some(key_attr) = item.get("key") {
                    if let Ok(key) = key_attr.as_s() {
                        keys.push(key.clone());
                    }
                }
            }
        }

        Ok(keys)
    }

    pub async fn kv_delete(&self, key: &str) -> Result<(), AwsError> {
        self.clients
            .dynamodb
            .delete_item()
            .table_name(&self.kv_table)
            .key(
                "key",
                aws_sdk_dynamodb::types::AttributeValue::S(key.to_string()),
            )
            .send()
            .await
            .map_err(|e| AwsError::DynamoDb(e.to_string()))?;

        Ok(())
    }

    // Secrets Manager operations for secure credential storage

    /// Store a secret in AWS Secrets Manager
    /// Returns the secret ARN for reference
    pub async fn secret_store(
        &self,
        secret_name: &str,
        secret_value: &str,
        description: Option<&str>,
    ) -> Result<String, AwsError> {
        // Try to create the secret first
        let create_result = self
            .clients
            .secrets_manager
            .create_secret()
            .name(secret_name)
            .secret_string(secret_value)
            .set_description(description.map(|s| s.to_string()))
            .send()
            .await;

        match create_result {
            Ok(output) => {
                let arn = output.arn().unwrap_or(secret_name).to_string();
                tracing::info!("Created secret: {}", secret_name);
                Ok(arn)
            }
            Err(e) => {
                // If secret already exists, update it instead
                let error_str = e.to_string();
                if error_str.contains("ResourceExistsException") {
                    let update_result = self
                        .clients
                        .secrets_manager
                        .put_secret_value()
                        .secret_id(secret_name)
                        .secret_string(secret_value)
                        .send()
                        .await
                        .map_err(|e| AwsError::SecretsManager(e.to_string()))?;

                    let arn = update_result.arn().unwrap_or(secret_name).to_string();
                    tracing::info!("Updated existing secret: {}", secret_name);
                    Ok(arn)
                } else {
                    Err(AwsError::SecretsManager(e.to_string()))
                }
            }
        }
    }

    /// Retrieve a secret value from AWS Secrets Manager
    pub async fn secret_get(&self, secret_name: &str) -> Result<Option<String>, AwsError> {
        let result = self
            .clients
            .secrets_manager
            .get_secret_value()
            .secret_id(secret_name)
            .send()
            .await;

        match result {
            Ok(output) => Ok(output.secret_string().map(|s| s.to_string())),
            Err(e) => {
                let error_str = e.to_string();
                if error_str.contains("ResourceNotFoundException") {
                    Ok(None)
                } else {
                    Err(AwsError::SecretsManager(e.to_string()))
                }
            }
        }
    }

    /// Delete a secret from AWS Secrets Manager
    /// By default uses a 7-day recovery window; set force_delete=true to delete immediately
    pub async fn secret_delete(
        &self,
        secret_name: &str,
        force_delete: bool,
    ) -> Result<(), AwsError> {
        let mut request = self
            .clients
            .secrets_manager
            .delete_secret()
            .secret_id(secret_name);

        if force_delete {
            request = request.force_delete_without_recovery(true);
        } else {
            // Use AWS minimum allowed recovery window (7-30 days range)
            request = request.recovery_window_in_days(7);
        }

        let result = request.send().await;

        match result {
            Ok(_) => {
                tracing::info!("Deleted secret: {} (force={})", secret_name, force_delete);
                Ok(())
            }
            Err(e) => {
                let error_str = e.to_string();
                // Ignore if secret doesn't exist
                if error_str.contains("ResourceNotFoundException") {
                    Ok(())
                } else {
                    Err(AwsError::SecretsManager(e.to_string()))
                }
            }
        }
    }

    /// Store integration credentials securely in Secrets Manager
    /// Creates a structured secret with all credential key-value pairs
    pub async fn store_integration_credentials(
        &self,
        tenant_id: &str,
        user_id: &str,
        service_id: &str,
        connection_id: &str,
        credentials: &std::collections::HashMap<String, String>,
    ) -> Result<String, AwsError> {
        let secret_name = format!(
            "mcp-credentials/{}/{}/{}/{}",
            tenant_id, user_id, service_id, connection_id
        );

        let secret_value = serde_json::to_string(credentials).map_err(AwsError::Serialization)?;

        let description = format!(
            "MCP integration credentials for service {} (user: {}, connection: {})",
            service_id, user_id, connection_id
        );

        self.secret_store(&secret_name, &secret_value, Some(&description))
            .await
    }

    /// Retrieve integration credentials from Secrets Manager
    pub async fn get_integration_credentials(
        &self,
        tenant_id: &str,
        user_id: &str,
        service_id: &str,
        connection_id: &str,
    ) -> Result<Option<std::collections::HashMap<String, String>>, AwsError> {
        let secret_name = format!(
            "mcp-credentials/{}/{}/{}/{}",
            tenant_id, user_id, service_id, connection_id
        );

        match self.secret_get(&secret_name).await? {
            Some(secret_value) => {
                let credentials: std::collections::HashMap<String, String> =
                    serde_json::from_str(&secret_value).map_err(AwsError::Serialization)?;
                Ok(Some(credentials))
            }
            None => Ok(None),
        }
    }

    /// Delete integration credentials from Secrets Manager
    pub async fn delete_integration_credentials(
        &self,
        tenant_id: &str,
        user_id: &str,
        service_id: &str,
        connection_id: &str,
        force_delete: bool,
    ) -> Result<(), AwsError> {
        let secret_name = format!(
            "mcp-credentials/{}/{}/{}/{}",
            tenant_id, user_id, service_id, connection_id
        );

        self.secret_delete(&secret_name, force_delete).await
    }
}
