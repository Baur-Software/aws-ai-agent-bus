output "secret_arns" {
  description = "Map of secret names to ARNs"
  value       = { for k, v in aws_secretsmanager_secret.secrets : k => v.arn }
}

# Alias for single secret ARN for compatibility with extra-small workspace
output "secret_arn" {
  description = "ARN of the first secret (for single-secret use cases)"
  value       = length(aws_secretsmanager_secret.secrets) > 0 ? values(aws_secretsmanager_secret.secrets)[0].arn : ""
}