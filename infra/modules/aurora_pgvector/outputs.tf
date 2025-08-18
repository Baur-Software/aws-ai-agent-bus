# output "cluster_endpoint" {
#   description = "Aurora cluster endpoint"
#   value       = aws_rds_cluster.vector.endpoint
# }

# output "cluster_arn" {
#   description = "Aurora cluster ARN"
#   value       = aws_rds_cluster.vector.arn
# }

# output "master_user_secret_arn" {
#   description = "ARN of the master user secret"
#   value       = aws_rds_cluster.vector.master_user_secret[0].secret_arn
# }

output "status" {
  description = "Module status"
  value       = "disabled - uncomment resources in main.tf to enable"
}