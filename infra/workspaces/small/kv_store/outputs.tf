output "table_name" {
  description = "DynamoDB table name"
  value       = module.kv_store.table_name
}

output "table_arn" {
  description = "DynamoDB table ARN"
  value       = module.kv_store.table_arn
}