output "agents_table_name" {
  description = "Name of the agents DynamoDB table"
  value       = aws_dynamodb_table.agents.name
}

output "agents_table_arn" {
  description = "ARN of the agents DynamoDB table"
  value       = aws_dynamodb_table.agents.arn
}

output "agent_versions_table_name" {
  description = "Name of the agent versions DynamoDB table"
  value       = aws_dynamodb_table.agent_versions.name
}

output "agent_versions_table_arn" {
  description = "ARN of the agent versions DynamoDB table"
  value       = aws_dynamodb_table.agent_versions.arn
}