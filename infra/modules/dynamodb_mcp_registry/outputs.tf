output "mcp_servers_table_name" {
  description = "Name of the MCP servers registry table"
  value       = aws_dynamodb_table.mcp_servers.name
}

output "mcp_servers_table_arn" {
  description = "ARN of the MCP servers registry table"
  value       = aws_dynamodb_table.mcp_servers.arn
}

output "mcp_connections_table_name" {
  description = "Name of the MCP connections table"
  value       = aws_dynamodb_table.mcp_connections.name
}

output "mcp_connections_table_arn" {
  description = "ARN of the MCP connections table"
  value       = aws_dynamodb_table.mcp_connections.arn
}

output "published_workflows_table_name" {
  description = "Name of the published workflows table"
  value       = aws_dynamodb_table.published_workflows.name
}

output "published_workflows_table_arn" {
  description = "ARN of the published workflows table"
  value       = aws_dynamodb_table.published_workflows.arn
}