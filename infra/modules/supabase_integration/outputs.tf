output "project_ref" {
  description = "Supabase project reference ID"
  value       = supabase_project.main.id
}

output "project_name" {
  description = "Supabase project name"
  value       = supabase_project.main.name
}

output "api_url" {
  description = "Supabase API URL"
  value       = "placeholder-api-url"
}

output "database_host" {
  description = "Supabase database host"
  value       = "placeholder-database-host"
  sensitive   = true
}

output "anon_key" {
  description = "Supabase anonymous key"
  value       = "placeholder-anon-key"
  sensitive   = true
}

output "service_role_key" {
  description = "Supabase service role key"
  value       = "placeholder-service-role-key"
  sensitive   = true
}

output "webhook_url" {
  description = "Webhook endpoint URL (if enabled)"
  value       = var.enable_webhooks ? aws_lambda_function_url.supabase_webhook[0].function_url : null
}

output "secrets_manager_config_arn" {
  description = "AWS Secrets Manager ARN for Supabase configuration"
  value       = aws_secretsmanager_secret.supabase_config.arn
}

output "secrets_manager_anon_key_arn" {
  description = "AWS Secrets Manager ARN for Supabase anonymous key"
  value       = aws_secretsmanager_secret.supabase_anon_key.arn
}

output "secrets_manager_service_role_key_arn" {
  description = "AWS Secrets Manager ARN for Supabase service role key"
  value       = aws_secretsmanager_secret.supabase_service_role_key.arn
}

output "event_rule_arn" {
  description = "EventBridge rule ARN for database events (if enabled)"
  value       = var.enable_database_events ? aws_cloudwatch_event_rule.supabase_events[0].arn : null
}

output "organization_id" {
  description = "Supabase organization ID"
  value       = var.organization_id
}

output "region" {
  description = "Supabase project region"
  value       = var.region
}

output "plan" {
  description = "Supabase subscription plan"
  value       = var.plan
}