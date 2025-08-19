terraform {
  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix = "agent-mesh-${var.env}"
  tags = {
    app       = "agent-mesh"
    workspace = "supabase_integration"
    env       = var.env
  }
}

# Supabase project
resource "supabase_project" "main" {
  organization_id   = var.organization_id
  name              = "${local.name_prefix}-${var.project_name}"
  database_password = var.database_password
  region            = var.region
}

# Project settings configuration
resource "supabase_settings" "main" {
  project_ref = supabase_project.main.id

  api = jsonencode({
    db_schema            = var.db_schema
    db_extra_search_path = var.db_extra_search_path
    max_rows             = var.max_rows
  })

  auth = jsonencode({
    site_url                   = var.site_url
    uri_allow_list             = var.uri_allow_list
    jwt_expiry                 = var.jwt_expiry
    disable_signup             = var.disable_signup
    enable_signup              = var.enable_signup
    enable_confirmations       = var.enable_confirmations
    enable_email_confirmations = var.enable_email_confirmations
    enable_phone_confirmations = var.enable_phone_confirmations
  })
}

# AWS Secrets Manager integration for Supabase configuration
resource "aws_secretsmanager_secret" "supabase_config" {
  name        = "${local.name_prefix}-supabase-config"
  description = "Supabase integration configuration for agent mesh"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "supabase_config" {
  secret_id = aws_secretsmanager_secret.supabase_config.id
  secret_string = jsonencode({
    project_ref      = supabase_project.main.id
    project_name     = supabase_project.main.name
    database_host    = "placeholder-database-host"
    api_url          = "placeholder-api-url"
    anon_key         = "placeholder-anon-key"
    service_role_key = "placeholder-service-role-key"
    organization_id  = var.organization_id
    region           = var.region
    plan             = var.plan
    created_at       = timestamp()
  })
}

# Store individual secrets for easier access
resource "aws_secretsmanager_secret" "supabase_anon_key" {
  name        = "${local.name_prefix}-supabase-anon-key"
  description = "Supabase anonymous key"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "supabase_anon_key" {
  secret_id     = aws_secretsmanager_secret.supabase_anon_key.id
  secret_string = "placeholder-anon-key"
}

resource "aws_secretsmanager_secret" "supabase_service_role_key" {
  name        = "${local.name_prefix}-supabase-service-role-key"
  description = "Supabase service role key"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "supabase_service_role_key" {
  secret_id     = aws_secretsmanager_secret.supabase_service_role_key.id
  secret_string = "placeholder-service-role-key"
}

# EventBridge rule for Supabase events (if enabled)
resource "aws_cloudwatch_event_rule" "supabase_events" {
  count          = var.enable_database_events ? 1 : 0
  name           = "${local.name_prefix}-supabase-events"
  description    = "Capture Supabase database events"
  event_bus_name = var.event_bus_name

  event_pattern = jsonencode({
    source      = ["agent-mesh.supabase"]
    detail-type = ["Supabase Database Event"]
    detail = {
      project_ref = [supabase_project.main.id]
    }
  })

  tags = local.tags
}

# Lambda function for database webhook processing (if enabled)
resource "aws_lambda_function" "supabase_webhook" {
  count         = var.enable_webhooks ? 1 : 0
  filename      = data.archive_file.webhook_handler[0].output_path
  function_name = "${local.name_prefix}-supabase-webhook"
  role          = aws_iam_role.lambda_role[0].arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  source_code_hash = data.archive_file.webhook_handler[0].output_base64sha256

  environment {
    variables = {
      EVENT_BUS_NAME  = var.event_bus_name
      PROJECT_REF     = supabase_project.main.id
      ANON_KEY_SECRET = aws_secretsmanager_secret.supabase_anon_key.name
    }
  }

  tags = local.tags
}

# Package webhook handler
data "archive_file" "webhook_handler" {
  count       = var.enable_webhooks ? 1 : 0
  type        = "zip"
  output_path = "${path.module}/webhook-handler.zip"

  source {
    content = templatefile("${path.module}/webhook-handler.js", {
      event_bus_name = var.event_bus_name
    })
    filename = "index.js"
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  count = var.enable_webhooks ? 1 : 0
  name  = "${local.name_prefix}-supabase-webhook-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# Lambda execution policy
resource "aws_iam_role_policy" "lambda_policy" {
  count = var.enable_webhooks ? 1 : 0
  name  = "${local.name_prefix}-supabase-webhook-policy"
  role  = aws_iam_role.lambda_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = "arn:aws:events:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:event-bus/${var.event_bus_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.supabase_anon_key.arn,
          aws_secretsmanager_secret.supabase_service_role_key.arn
        ]
      }
    ]
  })
}

# Function URL for webhook endpoint
resource "aws_lambda_function_url" "supabase_webhook" {
  count              = var.enable_webhooks ? 1 : 0
  function_name      = aws_lambda_function.supabase_webhook[0].function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["POST"]
    allow_headers     = ["date", "keep-alive", "authorization", "content-type"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }
}