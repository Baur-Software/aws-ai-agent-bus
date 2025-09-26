use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

/// AWS service rate limits based on actual AWS capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwsServiceLimits {
    // DynamoDB limits (per second)
    pub dynamodb_read_units: u32,    // Default: 40,000 RCU/sec
    pub dynamodb_write_units: u32,   // Default: 40,000 WCU/sec
    pub dynamodb_queries_per_sec: u32, // Default: 10,000/sec

    // S3 limits (per second)
    pub s3_get_requests_per_sec: u32,  // Default: 5,500/sec
    pub s3_put_requests_per_sec: u32,  // Default: 3,500/sec
    pub s3_list_requests_per_sec: u32, // Default: 100/sec

    // EventBridge limits (per second)
    pub eventbridge_put_events_per_sec: u32, // Default: 10,000/sec
    pub eventbridge_events_batch_size: u32,  // Default: 10 events/batch

    // Secrets Manager limits (per second)
    pub secrets_manager_requests_per_sec: u32, // Default: 5,000/sec

    // General AWS API limits
    pub aws_api_calls_per_sec: u32,    // Default: 2,000/sec (varies by service)
    pub aws_burst_capacity: u32,       // Burst allowance
}

impl Default for AwsServiceLimits {
    fn default() -> Self {
        Self {
            // Conservative defaults based on AWS service quotas
            dynamodb_read_units: 1000,     // Conservative for multi-tenant
            dynamodb_write_units: 1000,
            dynamodb_queries_per_sec: 100,

            s3_get_requests_per_sec: 500,
            s3_put_requests_per_sec: 350,
            s3_list_requests_per_sec: 10,

            eventbridge_put_events_per_sec: 1000,
            eventbridge_events_batch_size: 10,

            secrets_manager_requests_per_sec: 500,

            aws_api_calls_per_sec: 200,
            aws_burst_capacity: 1000,
        }
    }
}

/// Rate limiter bucket for tracking usage
#[derive(Debug)]
struct RateLimitBucket {
    tokens: f64,
    last_refill: Instant,
    capacity: f64,
    refill_rate: f64, // tokens per second
}

impl RateLimitBucket {
    fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            tokens: capacity,
            last_refill: Instant::now(),
            capacity,
            refill_rate,
        }
    }

    fn try_consume(&mut self, tokens: f64) -> bool {
        self.refill();

        if self.tokens >= tokens {
            self.tokens -= tokens;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();

        let tokens_to_add = elapsed * self.refill_rate;
        self.tokens = (self.tokens + tokens_to_add).min(self.capacity);
        self.last_refill = now;
    }
}

/// AWS service-specific rate limiter
#[derive(Debug)]
pub struct AwsRateLimiter {
    limits: AwsServiceLimits,
    buckets: Arc<RwLock<HashMap<String, RateLimitBucket>>>,
}

impl AwsRateLimiter {
    pub fn new(limits: AwsServiceLimits) -> Self {
        Self {
            limits,
            buckets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if an AWS service operation is allowed
    pub async fn check_aws_operation(&self, tenant_id: &str, operation: &AwsOperation) -> bool {
        let bucket_key = format!("{}:{}", tenant_id, operation.service_key());
        let (capacity, rate, cost) = self.get_limits_for_operation(operation);

        let mut buckets = self.buckets.write().await;
        let bucket = buckets.entry(bucket_key).or_insert_with(|| {
            RateLimitBucket::new(capacity, rate)
        });

        bucket.try_consume(cost)
    }

    /// Get rate limits and cost for a specific AWS operation
    fn get_limits_for_operation(&self, operation: &AwsOperation) -> (f64, f64, f64) {
        match operation {
            AwsOperation::DynamoDbQuery => (
                self.limits.dynamodb_queries_per_sec as f64,
                self.limits.dynamodb_queries_per_sec as f64,
                1.0,
            ),
            AwsOperation::DynamoDbRead { read_units } => (
                self.limits.dynamodb_read_units as f64,
                self.limits.dynamodb_read_units as f64,
                *read_units as f64,
            ),
            AwsOperation::DynamoDbWrite { write_units } => (
                self.limits.dynamodb_write_units as f64,
                self.limits.dynamodb_write_units as f64,
                *write_units as f64,
            ),
            AwsOperation::S3Get => (
                self.limits.s3_get_requests_per_sec as f64,
                self.limits.s3_get_requests_per_sec as f64,
                1.0,
            ),
            AwsOperation::S3Put => (
                self.limits.s3_put_requests_per_sec as f64,
                self.limits.s3_put_requests_per_sec as f64,
                1.0,
            ),
            AwsOperation::S3List => (
                self.limits.s3_list_requests_per_sec as f64,
                self.limits.s3_list_requests_per_sec as f64,
                1.0,
            ),
            AwsOperation::EventBridgePutEvents { event_count } => (
                self.limits.eventbridge_put_events_per_sec as f64,
                self.limits.eventbridge_put_events_per_sec as f64,
                (*event_count as f64).min(self.limits.eventbridge_events_batch_size as f64),
            ),
            AwsOperation::SecretsManagerGet => (
                self.limits.secrets_manager_requests_per_sec as f64,
                self.limits.secrets_manager_requests_per_sec as f64,
                1.0,
            ),
            AwsOperation::GenericAwsApi => (
                self.limits.aws_api_calls_per_sec as f64,
                self.limits.aws_api_calls_per_sec as f64,
                1.0,
            ),
        }
    }

    /// Clean up old buckets to prevent memory leaks
    pub async fn cleanup_expired_buckets(&self) {
        let mut buckets = self.buckets.write().await;
        let now = Instant::now();
        let expiry_threshold = Duration::from_secs(3600); // 1 hour

        buckets.retain(|_, bucket| {
            now.duration_since(bucket.last_refill) < expiry_threshold
        });
    }
}

/// AWS operations that require rate limiting
#[derive(Debug, Clone)]
pub enum AwsOperation {
    DynamoDbQuery,
    DynamoDbRead { read_units: u32 },
    DynamoDbWrite { write_units: u32 },
    S3Get,
    S3Put,
    S3List,
    EventBridgePutEvents { event_count: u32 },
    SecretsManagerGet,
    GenericAwsApi,
}

impl AwsOperation {
    fn service_key(&self) -> &'static str {
        match self {
            AwsOperation::DynamoDbQuery => "dynamodb_query",
            AwsOperation::DynamoDbRead { .. } => "dynamodb_read",
            AwsOperation::DynamoDbWrite { .. } => "dynamodb_write",
            AwsOperation::S3Get => "s3_get",
            AwsOperation::S3Put => "s3_put",
            AwsOperation::S3List => "s3_list",
            AwsOperation::EventBridgePutEvents { .. } => "eventbridge_put",
            AwsOperation::SecretsManagerGet => "secrets_get",
            AwsOperation::GenericAwsApi => "aws_api",
        }
    }

    /// Create operation from MCP tool name
    pub fn from_tool_name(tool_name: &str, args: &serde_json::Value) -> Option<Self> {
        match tool_name {
            "kv_get" | "kv_list" => Some(AwsOperation::DynamoDbRead { read_units: 1 }),
            "kv_set" | "kv_delete" => Some(AwsOperation::DynamoDbWrite { write_units: 1 }),
            "artifacts_get" | "artifacts_list" => Some(AwsOperation::S3Get),
            "artifacts_put" => Some(AwsOperation::S3Put),
            "events_send" => {
                let event_count = args.get("events")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.len() as u32)
                    .unwrap_or(1);
                Some(AwsOperation::EventBridgePutEvents { event_count })
            },
            "analytics_query" => Some(AwsOperation::DynamoDbQuery),
            _ => Some(AwsOperation::GenericAwsApi),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_basic() {
        let limits = AwsServiceLimits {
            dynamodb_read_units: 10,
            ..Default::default()
        };
        let limiter = AwsRateLimiter::new(limits);

        // Should allow initial requests
        assert!(limiter.check_aws_operation("tenant1", &AwsOperation::DynamoDbRead { read_units: 5 }).await);
        assert!(limiter.check_aws_operation("tenant1", &AwsOperation::DynamoDbRead { read_units: 5 }).await);

        // Should reject when limit exceeded
        assert!(!limiter.check_aws_operation("tenant1", &AwsOperation::DynamoDbRead { read_units: 1 }).await);
    }

    #[tokio::test]
    async fn test_tenant_isolation() {
        let limits = AwsServiceLimits {
            dynamodb_read_units: 5,
            ..Default::default()
        };
        let limiter = AwsRateLimiter::new(limits);

        // Tenant 1 uses up their quota
        assert!(limiter.check_aws_operation("tenant1", &AwsOperation::DynamoDbRead { read_units: 5 }).await);
        assert!(!limiter.check_aws_operation("tenant1", &AwsOperation::DynamoDbRead { read_units: 1 }).await);

        // Tenant 2 should still have their quota
        assert!(limiter.check_aws_operation("tenant2", &AwsOperation::DynamoDbRead { read_units: 5 }).await);
    }
}