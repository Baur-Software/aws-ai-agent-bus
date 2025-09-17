output "events_table_name" {
  description = "Name of the events DynamoDB table"
  value       = module.events_monitoring.events_table_name
}

output "events_table_arn" {
  description = "ARN of the events DynamoDB table"
  value       = module.events_monitoring.events_table_arn
}

output "subscriptions_table_name" {
  description = "Name of the subscriptions DynamoDB table"
  value       = module.events_monitoring.subscriptions_table_name
}

output "subscriptions_table_arn" {
  description = "ARN of the subscriptions DynamoDB table"
  value       = module.events_monitoring.subscriptions_table_arn
}

output "event_rules_table_name" {
  description = "Name of the event rules DynamoDB table"
  value       = module.events_monitoring.event_rules_table_name
}

output "event_rules_table_arn" {
  description = "ARN of the event rules DynamoDB table"
  value       = module.events_monitoring.event_rules_table_arn
}

output "all_table_names" {
  description = "All event monitoring table names"
  value       = module.events_monitoring.all_table_names
}

output "all_table_arns" {
  description = "All event monitoring table ARNs"
  value       = module.events_monitoring.all_table_arns
}