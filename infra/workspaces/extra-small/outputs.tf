output "kv_table_name" {
  description = "DynamoDB KV store table name"
  value       = module.kv_store.table_name
}

output "kv_table_arn" {
  description = "DynamoDB KV store table ARN"
  value       = module.kv_store.table_arn
}

output "event_bus_name" {
  description = "EventBridge custom bus name"
  value       = module.event_bus.bus_name
}

output "event_bus_arn" {
  description = "EventBridge custom bus ARN"
  value       = module.event_bus.bus_arn
}

output "secrets_arn" {
  description = "Secrets Manager secret ARN"
  value       = module.secrets.secret_arn
}

output "dashboard_service_endpoint" {
  description = "Dashboard service endpoint"
  value       = module.dashboard_service.dashboard_url
}

output "estimated_monthly_cost" {
  description = "Estimated monthly cost for extra-small workspace"
  value       = module.dashboard_service.estimated_monthly_cost_usd
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.dashboard_service.cluster_name
}

output "cost_breakdown" {
  description = "Cost breakdown for extra-small workspace"
  value = {
    dynamodb_kv      = "~$1-2/month (on-demand)"
    eventbridge      = "~$1/month (basic events)"
    secrets_manager  = "~$0.40/month (1 secret)"
    ecs_fargate_spot = module.dashboard_service.estimated_monthly_cost_usd
    total_target     = "~$10/month"
  }
}