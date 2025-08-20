terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.12"
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
    workspace = "vercel_integration"
    env       = var.env
  }
}

# Main Vercel project
resource "vercel_project" "main" {
  name      = "${local.name_prefix}-${var.project_name}"
  framework = var.framework
  team_id   = var.vercel_team_id

  git_repository = {
    type = var.git_repository.type
    repo = var.git_repository.repo
  }

  build_command    = var.build_command
  output_directory = var.output_directory
  install_command  = var.install_command
  root_directory   = var.root_directory
}

# Custom domains (if specified)
resource "vercel_project_domain" "domains" {
  for_each   = toset(var.custom_domains)
  project_id = vercel_project.main.id
  domain     = each.value
  team_id    = var.vercel_team_id
}

# AWS Secrets Manager integration for Vercel configuration
resource "aws_secretsmanager_secret" "vercel_config" {
  name        = "${local.name_prefix}-vercel-config"
  description = "Vercel integration configuration for agent mesh"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "vercel_config" {
  secret_id = aws_secretsmanager_secret.vercel_config.id
  secret_string = jsonencode({
    project_id     = vercel_project.main.id
    project_name   = vercel_project.main.name
    team_id        = var.vercel_team_id
    framework      = var.framework
    git_repository = var.git_repository
    domains        = var.custom_domains
    created_at     = timestamp()
  })
}

# Environment variables
resource "vercel_project_environment_variable" "env_vars" {
  for_each = var.environment_variables

  project_id = vercel_project.main.id
  key        = each.key
  value      = each.value
  target     = ["production", "preview"]

  depends_on = [vercel_project.main]
}

# EventBridge rule for Vercel deployment events (if enabled)
resource "aws_cloudwatch_event_rule" "vercel_deployments" {
  count          = var.enable_deployment_events ? 1 : 0
  name           = "${local.name_prefix}-vercel-deployments"
  description    = "Capture Vercel deployment events"
  event_bus_name = var.event_bus_name

  event_pattern = jsonencode({
    source      = ["agent-mesh.vercel"]
    detail-type = ["Vercel Deployment"]
    detail = {
      project_id = [vercel_project.main.id]
    }
  })

  tags = local.tags
}

# Lambda function for Vercel webhook processing (if enabled)
resource "aws_lambda_function" "vercel_webhook" {
  count         = var.enable_webhooks ? 1 : 0
  filename      = data.archive_file.webhook_handler[0].output_path
  function_name = "${local.name_prefix}-vercel-webhook"
  role          = aws_iam_role.lambda_role[0].arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  source_code_hash = data.archive_file.webhook_handler[0].output_base64sha256

  environment {
    variables = {
      EVENT_BUS_NAME = var.event_bus_name
      PROJECT_ID     = vercel_project.main.id
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
  name  = "${local.name_prefix}-vercel-webhook-role"

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
  name  = "${local.name_prefix}-vercel-webhook-policy"
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
      }
    ]
  })
}

# Function URL for webhook endpoint
resource "aws_lambda_function_url" "vercel_webhook" {
  count              = var.enable_webhooks ? 1 : 0
  function_name      = aws_lambda_function.vercel_webhook[0].function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["https://vercel.com"]
    allow_methods     = ["POST"]
    allow_headers     = ["date", "keep-alive", "x-vercel-signature"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }
}