output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.dashboard.name
}

output "service_arn" {
  description = "ECS service ARN"
  value       = aws_ecs_service.dashboard.id
}

output "task_definition_arn" {
  description = "ECS task definition ARN"
  value       = aws_ecs_task_definition.dashboard.arn
}

output "security_group_id" {
  description = "Security group ID for the ECS service"
  value       = aws_security_group.dashboard.id
}

output "alb_dns_name" {
  description = "ALB DNS name (if ALB is created)"
  value       = var.create_alb ? aws_lb.main[0].dns_name : "No ALB created"
}

output "alb_zone_id" {
  description = "ALB hosted zone ID (if ALB is created)"
  value       = var.create_alb ? aws_lb.main[0].zone_id : "No ALB created"
}

output "dashboard_url" {
  description = "Dashboard access URL"
  value       = var.create_alb ? "http://${aws_lb.main[0].dns_name}" : "ECS service without external access"
}

output "estimated_monthly_cost_usd" {
  description = "Estimated monthly cost in USD"
  value       = local.estimated_cost
}