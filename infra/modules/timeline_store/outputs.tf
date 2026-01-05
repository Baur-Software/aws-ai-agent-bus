output "database_name" {
  description = "Timestream database name"
  value       = aws_timestreamwrite_database.this.database_name
}

output "database_arn" {
  description = "Timestream database ARN"
  value       = aws_timestreamwrite_database.this.arn
}

output "table_name" {
  description = "Timestream table name"
  value       = aws_timestreamwrite_table.this.table_name
}

output "table_arn" {
  description = "Timestream table ARN"
  value       = aws_timestreamwrite_table.this.arn
}
