output "events_table_name" {
  description = "Name of the events DynamoDB table"
  value       = aws_dynamodb_table.events.name
}

output "events_table_arn" {
  description = "ARN of the events DynamoDB table"
  value       = aws_dynamodb_table.events.arn
}

output "subscriptions_table_name" {
  description = "Name of the subscriptions DynamoDB table"
  value       = aws_dynamodb_table.subscriptions.name
}

output "subscriptions_table_arn" {
  description = "ARN of the subscriptions DynamoDB table"
  value       = aws_dynamodb_table.subscriptions.arn
}

output "event_rules_table_name" {
  description = "Name of the event rules DynamoDB table"
  value       = aws_dynamodb_table.event_rules.name
}

output "event_rules_table_arn" {
  description = "ARN of the event rules DynamoDB table"
  value       = aws_dynamodb_table.event_rules.arn
}

output "all_table_names" {
  description = "All event monitoring table names"
  value = {
    events        = aws_dynamodb_table.events.name
    subscriptions = aws_dynamodb_table.subscriptions.name
    event_rules   = aws_dynamodb_table.event_rules.name
  }
}

output "all_table_arns" {
  description = "All event monitoring table ARNs"
  value = {
    events        = aws_dynamodb_table.events.arn
    subscriptions = aws_dynamodb_table.subscriptions.arn
    event_rules   = aws_dynamodb_table.event_rules.arn
  }
}