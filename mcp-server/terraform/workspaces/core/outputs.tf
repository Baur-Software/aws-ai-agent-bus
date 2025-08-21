# MCP Server Core Infrastructure Outputs
# These outputs are used by the MCP server and can be consumed by agent infrastructure

output "kv_store_table_name" {
  description = "DynamoDB table name for key-value storage"
  value       = module.kv_store.table_name
}

output "kv_store_table_arn" {
  description = "DynamoDB table ARN for key-value storage"
  value       = module.kv_store.table_arn
}

output "artifacts_bucket_name" {
  description = "S3 bucket name for artifacts storage"
  value       = module.artifacts_storage.bucket_name
}

output "artifacts_bucket_arn" {
  description = "S3 bucket ARN for artifacts storage"
  value       = module.artifacts_storage.bucket_arn
}

output "event_bus_name" {
  description = "EventBridge bus name for agent communication"
  value       = module.event_bus.bus_name
}

output "event_bus_arn" {
  description = "EventBridge bus ARN for agent communication"
  value       = module.event_bus.bus_arn
}

output "message_queue_url" {
  description = "SQS queue URL for subtask processing"
  value       = module.message_queue.queue_url
}

output "message_queue_arn" {
  description = "SQS queue ARN for subtask processing"
  value       = module.message_queue.queue_arn
}

output "secrets_arns" {
  description = "Map of secret names to ARNs"
  value       = module.secrets.secret_arns
}

# Consolidated output for MCP server configuration
output "mcp_server_config" {
  description = "Complete configuration for MCP server"
  value = {
    kv_store = {
      table_name = module.kv_store.table_name
      table_arn  = module.kv_store.table_arn
    }
    artifacts = {
      bucket_name = module.artifacts_storage.bucket_name
      bucket_arn  = module.artifacts_storage.bucket_arn
    }
    events = {
      bus_name = module.event_bus.bus_name
      bus_arn  = module.event_bus.bus_arn
    }
    messaging = {
      queue_url = module.message_queue.queue_url
      queue_arn = module.message_queue.queue_arn
    }
    security = {
      secret_arns = module.secrets.secret_arns
    }
  }
}