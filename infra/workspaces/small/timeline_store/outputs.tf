output "bucket_name" {
  description = "Timeline S3 bucket name"
  value       = module.timeline_store.bucket_name
}

output "bucket_arn" {
  description = "Timeline S3 bucket ARN"
  value       = module.timeline_store.bucket_arn
}