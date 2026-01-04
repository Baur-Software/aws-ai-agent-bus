output "bucket_name" {
  description = "The name of the Terraform state bucket"
  value       = aws_s3_bucket.state.bucket
}

output "bucket_arn" {
  description = "The ARN of the Terraform state bucket"
  value       = aws_s3_bucket.state.arn
}

output "bucket_region" {
  description = "The region of the Terraform state bucket"
  value       = data.aws_region.current.name
}
