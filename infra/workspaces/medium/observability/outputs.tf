output "log_group_names" {
  description = "Map of agent names to log group names"
  value       = module.observability.log_group_names
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.observability.dashboard_url
}