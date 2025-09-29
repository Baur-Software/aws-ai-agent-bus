# Outputs for Cognito Authentication Module

output "user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.auth.id
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.agent_mesh.arn
}

output "user_pool_endpoint" {
  description = "Endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.agent_mesh.endpoint
}

output "user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.agent_mesh_web.id
}

output "user_pool_client_secret" {
  description = "Secret of the Cognito User Pool Client (if generated)"
  value       = aws_cognito_user_pool_client.agent_mesh_web.client_secret
  sensitive   = true
}

output "user_pool_domain" {
  description = "Domain of the Cognito User Pool (if hosted UI enabled)"
  value       = var.enable_hosted_ui ? aws_cognito_user_pool_domain.agent_mesh[0].domain : null
}

output "user_pool_domain_url" {
  description = "Full URL of the Cognito Hosted UI (if enabled)"
  value       = var.enable_hosted_ui ? "https://${aws_cognito_user_pool_domain.agent_mesh[0].domain}.auth.${data.aws_region.current.name}.amazoncognito.com" : null
}

output "identity_pool_id" {
  description = "ID of the Cognito Identity Pool (if enabled)"
  value       = var.enable_identity_pool ? aws_cognito_identity_pool.agent_mesh[0].id : null
}

output "authenticated_role_arn" {
  description = "ARN of the authenticated IAM role (if identity pool enabled)"
  value       = var.enable_identity_pool ? aws_iam_role.authenticated[0].arn : null
}

# Configuration object for frontend applications
output "cognito_config" {
  description = "Complete Cognito configuration for frontend applications"
  value = {
    userPoolId             = aws_cognito_user_pool.agent_mesh.id
    userPoolClientId       = aws_cognito_user_pool_client.agent_mesh_web.id
    region                 = data.aws_region.current.name
    identityPoolId         = var.enable_identity_pool ? aws_cognito_identity_pool.agent_mesh[0].id : null
    domain                 = var.enable_hosted_ui ? aws_cognito_user_pool_domain.agent_mesh[0].domain : null
    redirectSignIn         = length(var.callback_urls) > 0 ? var.callback_urls[0] : null
    redirectSignOut        = length(var.logout_urls) > 0 ? var.logout_urls[0] : null
    authenticationFlowType = "USER_PASSWORD_AUTH"
  }
}

# Data source for current AWS region
data "aws_region" "current" {}