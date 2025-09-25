output "cluster_name" {
  description = "ECS cluster name"
  value       = module.dashboard_service.cluster_name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = module.dashboard_service.cluster_arn
}

output "service_name" {
  description = "ECS service name"
  value       = module.dashboard_service.service_name
}

output "service_arn" {
  description = "ECS service ARN"
  value       = module.dashboard_service.service_arn
}

output "task_definition_arn" {
  description = "ECS task definition ARN"
  value       = module.dashboard_service.task_definition_arn
}

output "security_group_id" {
  description = "Security group ID for the dashboard service"
  value       = module.dashboard_service.security_group_id
}

output "alb_dns_name" {
  description = "ALB DNS name (if ALB is created)"
  value       = module.dashboard_service.alb_dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID (if ALB is created)"
  value       = module.dashboard_service.alb_zone_id
}

output "estimated_monthly_cost" {
  description = "Estimated monthly cost in USD"
  value       = module.dashboard_service.estimated_monthly_cost_usd
}

output "dashboard_url" {
  description = "Dashboard access URL"
  value       = module.dashboard_service.dashboard_url
}