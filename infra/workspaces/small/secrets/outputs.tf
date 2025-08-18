output "secret_arns" {
  description = "Map of secret names to ARNs"
  value       = module.secrets.secret_arns
}