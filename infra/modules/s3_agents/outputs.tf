output "bucket_name" {
  description = "Name of the S3 bucket for agent storage"
  value       = aws_s3_bucket.agents.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket for agent storage"
  value       = aws_s3_bucket.agents.arn
}

output "bucket_id" {
  description = "ID of the S3 bucket for agent storage"
  value       = aws_s3_bucket.agents.id
}