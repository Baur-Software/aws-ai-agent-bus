# KV Store outputs
output "kv_table_name" {
  description = "DynamoDB KV table name"
  value       = module.kv_store.table_name
}

output "kv_table_arn" {
  description = "DynamoDB KV table ARN"
  value       = module.kv_store.table_arn
}

# Event Bus outputs
output "event_bus_name" {
  description = "EventBridge bus name"
  value       = module.event_bus.bus_name
}

output "event_bus_arn" {
  description = "EventBridge bus ARN"
  value       = module.event_bus.bus_arn
}

# Secrets outputs
output "secrets_arn" {
  description = "Secrets Manager secret ARN"
  value       = module.secrets.secret_arn
}

# Artifacts bucket outputs
output "artifacts_bucket_name" {
  description = "S3 artifacts bucket name"
  value       = module.artifacts_bucket.bucket_name
}

output "artifacts_bucket_arn" {
  description = "S3 artifacts bucket ARN"
  value       = module.artifacts_bucket.bucket_arn
}

# Dashboard service outputs
output "dashboard_cluster_name" {
  description = "ECS cluster name for dashboard service"
  value       = module.dashboard_service.cluster_name
}

output "dashboard_service_name" {
  description = "ECS service name for dashboard"
  value       = module.dashboard_service.service_name
}

output "dashboard_alb_dns_name" {
  description = "ALB DNS name for dashboard access"
  value       = module.dashboard_service.alb_dns_name
}

output "dashboard_estimated_cost" {
  description = "Estimated monthly cost for dashboard service"
  value       = module.dashboard_service.estimated_monthly_cost_usd
}

output "dashboard_url" {
  description = "Dashboard access URL"
  value       = module.dashboard_service.dashboard_url
}

# Combined cost estimation
output "total_estimated_monthly_cost" {
  description = "Total estimated monthly cost for small workspace"
  value       = "~$25-35/month (dashboard: ${module.dashboard_service.estimated_monthly_cost_usd}, storage: ~$5-10, networking: ~$5-10)"
}