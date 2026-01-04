# Terraform state bucket module
# Creates an S3 bucket for storing Terraform remote state

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-tfstate-${random_id.bucket_suffix.hex}"
  tags = {
    app       = "agent-mesh"
    workspace = "state_bucket"
    purpose   = "terraform-state"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "state" {
  bucket = local.name
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
