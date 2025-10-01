use crate::rate_limiting::{AwsOperation, AwsRateLimiter, AwsServiceLimits};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum TenantError {
    #[error("Tenant not found: {0}")]
    NotFound(String),
    #[error("Unauthorized access for tenant: {0}")]
    Unauthorized(String),
    #[error("Tenant configuration error: {0}")]
    ConfigError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextType {
    Personal,
    Organization { org_id: String, org_name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantContext {
    pub tenant_id: String,
    pub user_id: String,
    pub context_type: ContextType,
    pub organization_id: String, // Deprecated, kept for compatibility
    pub role: UserRole,
    pub permissions: Vec<Permission>,
    pub aws_region: String,
    pub resource_limits: ResourceLimits,
}

impl TenantContext {
    /// Returns true if this is a personal context
    pub fn is_personal(&self) -> bool {
        matches!(self.context_type, ContextType::Personal)
    }

    /// Returns true if this is an organizational context
    pub fn is_organizational(&self) -> bool {
        matches!(self.context_type, ContextType::Organization { .. })
    }

    /// Get the effective context identifier for namespacing
    pub fn get_context_id(&self) -> String {
        match &self.context_type {
            ContextType::Personal => format!("personal-{}", self.user_id),
            ContextType::Organization { org_id, .. } => format!("org-{}", org_id),
        }
    }

    /// Get namespace prefix for KV storage and other resources
    pub fn get_namespace_prefix(&self) -> String {
        match &self.context_type {
            ContextType::Personal => format!("user:{}", self.user_id),
            ContextType::Organization { org_id, .. } => format!("org:{}:user:{}", org_id, self.user_id),
        }
    }

    /// Get the organization ID if in organizational context
    pub fn get_org_id(&self) -> Option<String> {
        match &self.context_type {
            ContextType::Organization { org_id, .. } => Some(org_id.clone()),
            ContextType::Personal => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserRole {
    Admin,
    User,
    Viewer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Permission {
    ReadKV,
    WriteKV,
    DeleteKV,
    ListArtifacts,
    GetArtifacts,
    PutArtifacts,
    SendEvents,
    ExecuteWorkflows,
    ManageUsers,
    Execute,
    Admin,
    Read,
    Write,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_kv_size: u64,         // Maximum KV storage in bytes
    pub max_artifacts: u32,       // Maximum number of artifacts
    pub requests_per_minute: u32, // Rate limiting (legacy)
    pub max_concurrent_requests: u32,
    pub aws_service_limits: AwsServiceLimits, // AWS-specific rate limits
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_kv_size: 100_000_000, // 100MB
            max_artifacts: 1000,
            requests_per_minute: 100, // Legacy fallback
            max_concurrent_requests: 10,
            aws_service_limits: AwsServiceLimits::default(),
        }
    }
}

#[derive(Debug)]
pub struct TenantSession {
    pub context: TenantContext,
    pub session_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: Arc<RwLock<chrono::DateTime<chrono::Utc>>>,
    pub request_count: Arc<RwLock<u32>>,
    pub active_requests: Arc<RwLock<u32>>,
}

impl TenantSession {
    pub fn new(context: TenantContext) -> Self {
        let now = chrono::Utc::now();
        Self {
            context,
            session_id: Uuid::new_v4(),
            created_at: now,
            last_activity: Arc::new(RwLock::new(now)),
            request_count: Arc::new(RwLock::new(0)),
            active_requests: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn update_activity(&self) {
        let mut last_activity = self.last_activity.write().await;
        *last_activity = chrono::Utc::now();
    }

    pub async fn increment_request_count(&self) -> u32 {
        let mut count = self.request_count.write().await;
        *count += 1;
        *count
    }

    pub async fn increment_active_requests(&self) -> u32 {
        let mut active = self.active_requests.write().await;
        *active += 1;
        *active
    }

    pub async fn decrement_active_requests(&self) {
        let mut active = self.active_requests.write().await;
        if *active > 0 {
            *active -= 1;
        }
    }

    pub async fn check_rate_limit(&self) -> bool {
        let count = *self.request_count.read().await;
        let active = *self.active_requests.read().await;

        // Legacy rate limiting check
        count < self.context.resource_limits.requests_per_minute
            && active < self.context.resource_limits.max_concurrent_requests
    }

    /// Check if an AWS operation is allowed based on service-specific limits
    pub async fn check_aws_operation(
        &self,
        aws_limiter: &AwsRateLimiter,
        operation: &AwsOperation,
    ) -> bool {
        aws_limiter
            .check_aws_operation(&self.context.tenant_id, operation)
            .await
    }

    pub fn has_permission(&self, permission: &Permission) -> bool {
        match self.context.role {
            UserRole::Admin => true,
            _ => self.context.permissions.contains(permission),
        }
    }
}

pub struct TenantManager {
    sessions: Arc<RwLock<HashMap<String, Arc<TenantSession>>>>,
    // In production, this would integrate with a database
    tenant_configs: Arc<RwLock<HashMap<String, TenantContext>>>,
    aws_rate_limiter: Arc<AwsRateLimiter>,
}

impl TenantManager {
    pub async fn new() -> anyhow::Result<Self> {
        let mut tenant_configs = HashMap::new();

        // Load tenant configs from environment or config file
        // In production, tenants should be loaded from database/config service
        // For development, check if DEV_MODE is enabled before creating demo tenant
        if std::env::var("DEV_MODE").unwrap_or_default() == "true" {
            warn!("DEV_MODE enabled: Creating demo tenant (DO NOT USE IN PRODUCTION)");
            let demo_context = TenantContext {
                tenant_id: "demo-tenant".to_string(),
                user_id: "user-demo-123".to_string(),
                context_type: ContextType::Organization {
                    org_id: "org-demo-456".to_string(),
                    org_name: "Demo Organization".to_string(),
                },
                organization_id: "org-demo-456".to_string(),
                role: UserRole::Admin,
                permissions: vec![
                    Permission::ReadKV,
                    Permission::WriteKV,
                    Permission::DeleteKV,
                    Permission::ListArtifacts,
                    Permission::GetArtifacts,
                    Permission::PutArtifacts,
                    Permission::SendEvents,
                    Permission::ExecuteWorkflows,
                ],
                aws_region: "us-west-2".to_string(),
                resource_limits: ResourceLimits::default(),
            };

            tenant_configs.insert("demo-tenant".to_string(), demo_context);
        } else {
            info!("Production mode: Tenant contexts will be created from auth headers");
        }

        // Create AWS rate limiter with default limits
        let aws_rate_limiter = Arc::new(AwsRateLimiter::new(AwsServiceLimits::default()));

        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            tenant_configs: Arc::new(RwLock::new(tenant_configs)),
            aws_rate_limiter,
        })
    }

    pub async fn create_session(&self, tenant_id: &str) -> Result<Arc<TenantSession>, TenantError> {
        let configs = self.tenant_configs.read().await;
        let context = configs
            .get(tenant_id)
            .ok_or_else(|| TenantError::NotFound(tenant_id.to_string()))?
            .clone();
        drop(configs);

        let session = Arc::new(TenantSession::new(context));
        let session_key = format!("{}:{}", tenant_id, session.session_id);

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_key, session.clone());

        Ok(session)
    }

    pub async fn get_session(&self, session_key: &str) -> Option<Arc<TenantSession>> {
        let sessions = self.sessions.read().await;
        sessions.get(session_key).cloned()
    }

    pub async fn cleanup_expired_sessions(&self) {
        let mut sessions = self.sessions.write().await;
        let now = chrono::Utc::now();
        let timeout = chrono::Duration::minutes(30); // 30-minute timeout

        sessions.retain(|_, session| {
            let last_activity =
                futures::executor::block_on(async { *session.last_activity.read().await });
            now.signed_duration_since(last_activity) < timeout
        });

        // Also cleanup AWS rate limiter buckets
        self.aws_rate_limiter.cleanup_expired_buckets().await;
    }

    /// Get AWS rate limiter for checking service-specific limits
    pub fn get_aws_rate_limiter(&self) -> Arc<AwsRateLimiter> {
        self.aws_rate_limiter.clone()
    }

    pub async fn validate_tenant_access(
        &self,
        tenant_id: &str,
        user_id: &str,
    ) -> Result<(), TenantError> {
        // Check if tenant already exists
        {
            let configs = self.tenant_configs.read().await;
            if let Some(context) = configs.get(tenant_id) {
                // Tenant exists, validate user
                if context.user_id != user_id {
                    return Err(TenantError::Unauthorized(tenant_id.to_string()));
                }
                return Ok(());
            }
        }

        // Tenant doesn't exist - auto-register in dev mode (when DEFAULT_TENANT_ID is set)
        if std::env::var("DEFAULT_TENANT_ID").is_ok() {
            info!("Auto-registering tenant '{}' for user '{}' (dev mode)", tenant_id, user_id);
            let context = TenantContext {
                tenant_id: tenant_id.to_string(),
                user_id: user_id.to_string(),
                context_type: ContextType::Organization {
                    org_id: tenant_id.to_string(),
                    org_name: tenant_id.to_string(),
                },
                organization_id: tenant_id.to_string(),
                role: UserRole::Admin,
                permissions: vec![Permission::Admin],
                aws_region: std::env::var("AWS_REGION").unwrap_or_else(|_| "us-west-2".to_string()),
                resource_limits: ResourceLimits::default(),
            };

            let mut configs = self.tenant_configs.write().await;
            configs.insert(tenant_id.to_string(), context);
            Ok(())
        } else {
            // Production mode - reject unknown tenants
            Err(TenantError::NotFound(tenant_id.to_string()))
        }
    }
}

