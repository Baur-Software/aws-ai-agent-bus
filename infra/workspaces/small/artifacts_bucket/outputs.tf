output "bucket_name" {
  description = "S3 bucket name"
  value       = module.artifacts_bucket.bucket_name
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.artifacts_bucket.bucket_arn
}