output "artifacts_bucket_name" {
  value = aws_s3_bucket.artifacts.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.artifacts.arn
}