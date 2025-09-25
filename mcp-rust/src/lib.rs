pub mod aws;
pub mod handlers;
pub mod mcp;
pub mod tenant;

pub use aws::{AwsError, AwsService};
pub use handlers::{Handler, HandlerError, HandlerRegistry};
pub use mcp::{MCPError, MCPRequest, MCPResponse, MCPServer};
pub use tenant::{
    Permission, ResourceLimits, TenantContext, TenantManager, TenantSession, UserRole,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tenant_context_creation() {
        let context = TenantContext {
            tenant_id: "test-tenant".to_string(),
            user_id: "test-user".to_string(),
            organization_id: "test-org".to_string(),
            role: UserRole::Admin,
            permissions: vec![Permission::ReadKV, Permission::WriteKV],
            aws_region: "us-west-2".to_string(),
            resource_limits: ResourceLimits::default(),
        };

        let session = TenantSession::new(context);
        assert_eq!(session.context.tenant_id, "test-tenant");
        assert_eq!(session.context.user_id, "test-user");
    }

    #[test]
    fn test_permission_check() {
        let context = TenantContext {
            tenant_id: "test-tenant".to_string(),
            user_id: "test-user".to_string(),
            organization_id: "test-org".to_string(),
            role: UserRole::User,
            permissions: vec![Permission::ReadKV, Permission::WriteKV],
            aws_region: "us-west-2".to_string(),
            resource_limits: ResourceLimits::default(),
        };

        let session = TenantSession::new(context);
        assert!(session.has_permission(&Permission::ReadKV));
        assert!(session.has_permission(&Permission::WriteKV));
        assert!(!session.has_permission(&Permission::ManageUsers));
    }

    #[test]
    fn test_admin_permissions() {
        let context = TenantContext {
            tenant_id: "test-tenant".to_string(),
            user_id: "admin-user".to_string(),
            organization_id: "test-org".to_string(),
            role: UserRole::Admin,
            permissions: vec![], // Empty permissions, but admin should have all
            aws_region: "us-west-2".to_string(),
            resource_limits: ResourceLimits::default(),
        };

        let session = TenantSession::new(context);
        assert!(session.has_permission(&Permission::ReadKV));
        assert!(session.has_permission(&Permission::WriteKV));
        assert!(session.has_permission(&Permission::ManageUsers));
    }
}
