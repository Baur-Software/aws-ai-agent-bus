output "project_ref" {
  description = "Supabase project reference ID"
  value       = module.supabase_integration.project_ref
}

output "project_name" {
  description = "Supabase project name"
  value       = module.supabase_integration.project_name
}

output "api_url" {
  description = "Supabase API URL"
  value       = module.supabase_integration.api_url
}

output "database_host" {
  description = "Supabase database host"
  value       = module.supabase_integration.database_host
  sensitive   = true
}

output "anon_key" {
  description = "Supabase anonymous key"
  value       = module.supabase_integration.anon_key
  sensitive   = true
}

output "service_role_key" {
  description = "Supabase service role key"
  value       = module.supabase_integration.service_role_key
  sensitive   = true
}

output "webhook_url" {
  description = "Webhook endpoint URL"
  value       = module.supabase_integration.webhook_url
}

output "secrets_manager_config_arn" {
  description = "AWS Secrets Manager ARN for Supabase configuration"
  value       = module.supabase_integration.secrets_manager_config_arn
}