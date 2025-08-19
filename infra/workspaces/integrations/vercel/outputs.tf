output "project_id" {
  description = "Vercel project ID"
  value       = module.vercel_integration.project_id
}

output "project_name" {
  description = "Vercel project name"
  value       = module.vercel_integration.project_name
}

output "project_url" {
  description = "Default Vercel project URL"
  value       = module.vercel_integration.project_url
}

output "custom_domains" {
  description = "Configured custom domains"
  value       = module.vercel_integration.custom_domains
}

output "webhook_url" {
  description = "Webhook endpoint URL"
  value       = module.vercel_integration.webhook_url
}

output "secrets_manager_arn" {
  description = "AWS Secrets Manager ARN for Vercel configuration"
  value       = module.vercel_integration.secrets_manager_arn
}