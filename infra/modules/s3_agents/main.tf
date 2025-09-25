data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  tags = {
    app       = "agent-mesh"
    workspace = "s3_agents"
    env       = var.env
  }

  bucket_name = "agent-mesh-${var.env}-agents"
}

# S3 bucket for agent storage with path-based security
resource "aws_s3_bucket" "agents" {
  bucket = local.bucket_name
  tags   = local.tags
}

# Enable versioning for agent history
resource "aws_s3_bucket_versioning" "agents" {
  bucket = aws_s3_bucket.agents.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "agents" {
  bucket = aws_s3_bucket.agents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "agents" {
  bucket = aws_s3_bucket.agents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM policy for agent access based on paths
data "aws_iam_policy_document" "agent_access" {
  # Allow users to read public/system agents (bootstrap agents)
  statement {
    sid    = "ReadSystemAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.agents.arn}/agents/public/system/*"
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment" = var.env
      }
    }
  }

  # Allow users to read public/community agents
  statement {
    sid    = "ReadCommunityAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.agents.arn}/agents/public/community/*"
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment" = var.env
      }
    }
  }

  # Allow users full access to their private agents
  statement {
    sid    = "AccessPrivateAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObjectVersion",
      "s3:ListObjectVersions"
    ]

    resources = [
      "${aws_s3_bucket.agents.arn}/agents/users/$${aws:PrincipalTag/UserId}/*"
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment" = var.env
      }
    }
  }

  # Allow organization members to read org shared agents
  statement {
    sid    = "ReadOrgSharedAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.agents.arn}/agents/organizations/$${aws:PrincipalTag/OrganizationId}/shared/*"
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment" = var.env
      }
    }
  }

  # Allow organization admins to manage org shared agents
  statement {
    sid    = "ManageOrgSharedAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObjectVersion",
      "s3:ListObjectVersions"
    ]

    resources = [
      "${aws_s3_bucket.agents.arn}/agents/organizations/$${aws:PrincipalTag/OrganizationId}/shared/*"
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment"      = var.env
        "aws:PrincipalTag/OrganizationRole" = "admin"
      }
    }
  }

  # Allow users full access to their agents within organization
  statement {
    sid    = "AccessOrgUserAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObjectVersion",
      "s3:ListObjectVersions"
    ]

    resources = [
      "${aws_s3_bucket.agents.arn}/agents/organizations/$${aws:PrincipalTag/OrganizationId}/users/$${aws:PrincipalTag/UserId}/*"
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment" = var.env
      }
    }
  }

  # Allow listing agents at appropriate levels
  statement {
    sid    = "ListAgents"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "s3:ListBucket"
    ]

    resources = [
      aws_s3_bucket.agents.arn
    ]

    condition {
      string_equals = {
        "aws:PrincipalTag/Environment" = var.env
      }

      string_like = {
        "s3:prefix" = [
          "agents/public/*",
          "agents/users/$${aws:PrincipalTag/UserId}/*",
          "agents/organizations/$${aws:PrincipalTag/OrganizationId}/*"
        ]
      }
    }
  }
}

# Apply bucket policy
resource "aws_s3_bucket_policy" "agents" {
  bucket = aws_s3_bucket.agents.id
  policy = data.aws_iam_policy_document.agent_access.json
}

# Lifecycle configuration for old versions
resource "aws_s3_bucket_lifecycle_configuration" "agents" {
  bucket = aws_s3_bucket.agents.id

  rule {
    id     = "agent_version_management"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}