output "log_group_names" {
  description = "Map of agent names to log group names"
  value       = { for k, v in aws_cloudwatch_log_group.agents : k => v.name }
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.agents.dashboard_name}"
}