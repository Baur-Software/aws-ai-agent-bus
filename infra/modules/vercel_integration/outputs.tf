output "project_id" {
  description = "Vercel project ID"
  value       = vercel_project.main.id
}

output "project_name" {
  description = "Vercel project name"
  value       = vercel_project.main.name
}

output "project_url" {
  description = "Default Vercel project URL"
  value       = "https://${vercel_project.main.name}.vercel.app"
}

output "custom_domains" {
  description = "Configured custom domains"
  value       = var.custom_domains
}

output "git_repository" {
  description = "Git repository configuration"
  value       = var.git_repository
}

output "webhook_url" {
  description = "Webhook endpoint URL (if enabled)"
  value       = var.enable_webhooks ? aws_lambda_function_url.vercel_webhook[0].function_url : null
}

output "secrets_manager_arn" {
  description = "AWS Secrets Manager ARN for Vercel configuration"
  value       = aws_secretsmanager_secret.vercel_config.arn
}

output "event_rule_arn" {
  description = "EventBridge rule ARN for deployment events (if enabled)"
  value       = var.enable_deployment_events ? aws_cloudwatch_event_rule.vercel_deployments[0].arn : null
}