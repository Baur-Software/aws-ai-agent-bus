terraform {
  required_providers {
    stripe = {
      source  = "lukasaron/stripe"
      version = "~> 3.1"
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
    workspace = "stripe_integration"
    env       = var.env
  }
}

# Stripe products
resource "stripe_product" "products" {
  for_each = { for p in var.products : p.name => p }

  name        = each.value.name
  description = each.value.description
  active      = each.value.active

  metadata = each.value.metadata
}

# Stripe prices for products
resource "stripe_price" "prices" {
  for_each = { for p in var.prices : "${p.product_name}-${p.nickname}" => p }

  product     = stripe_product.products[each.value.product_name].id
  currency    = each.value.currency
  unit_amount = each.value.unit_amount
  nickname    = each.value.nickname

  recurring {
    interval       = each.value.recurring.interval
    interval_count = each.value.recurring.interval_count
  }

  active = each.value.active
}

# Stripe webhook endpoints
resource "stripe_webhook_endpoint" "main" {
  count = var.webhook_url != null ? 1 : 0
  url   = var.webhook_url

  enabled_events = var.webhook_events

  description = "Agent Mesh Stripe Integration Webhook"
}

# Create webhook endpoint using Lambda URL if no custom URL provided
resource "stripe_webhook_endpoint" "lambda" {
  count = var.webhook_url == null ? 1 : 0
  url   = aws_lambda_function_url.stripe_webhook.function_url

  enabled_events = var.webhook_events

  description = "Agent Mesh Stripe Integration Webhook (Lambda)"

  depends_on = [aws_lambda_function_url.stripe_webhook]
}

# AWS Secrets Manager integration for Stripe configuration
resource "aws_secretsmanager_secret" "stripe_config" {
  name        = "${local.name_prefix}-stripe-config"
  description = "Stripe integration configuration for agent mesh"

  tags = local.tags
}


resource "aws_secretsmanager_secret_version" "stripe_config" {
  secret_id = aws_secretsmanager_secret.stripe_config.id
  secret_string = jsonencode({
    webhook_endpoint_id     = local.webhook_endpoint.id
    webhook_endpoint_url    = local.webhook_endpoint.url
    webhook_endpoint_secret = local.webhook_endpoint.secret
    products                = { for k, v in stripe_product.products : k => v.id }
    prices                  = { for k, v in stripe_price.prices : k => v.id }
    created_at              = timestamp()
  })
}

# Store webhook secret separately for Lambda access
resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name        = "${local.name_prefix}-stripe-webhook-secret"
  description = "Stripe webhook endpoint secret"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.stripe_webhook_secret.id
  secret_string = local.webhook_endpoint.secret
}

# EventBridge rule for Stripe events (if enabled)
resource "aws_cloudwatch_event_rule" "stripe_events" {
  count          = var.enable_payment_events ? 1 : 0
  name           = "${local.name_prefix}-stripe-events"
  description    = "Capture Stripe payment events"
  event_bus_name = var.event_bus_name

  event_pattern = jsonencode({
    source      = ["agent-mesh.stripe"]
    detail-type = ["Stripe Payment Event", "Stripe Subscription Event", "Stripe Customer Event"]
  })

  tags = local.tags
}

# Lambda function for Stripe webhook processing
resource "aws_lambda_function" "stripe_webhook" {
  filename      = data.archive_file.webhook_handler.output_path
  function_name = "${local.name_prefix}-stripe-webhook"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  source_code_hash = data.archive_file.webhook_handler.output_base64sha256

  environment {
    variables = {
      EVENT_BUS_NAME           = var.event_bus_name
      WEBHOOK_SECRET_ARN       = aws_secretsmanager_secret.stripe_webhook_secret.arn
      STRIPE_CONFIG_SECRET_ARN = aws_secretsmanager_secret.stripe_config.arn
    }
  }

  tags = local.tags
}

# Package webhook handler
data "archive_file" "webhook_handler" {
  type        = "zip"
  output_path = "${path.module}/webhook-handler.zip"

  source {
    content  = replace(file("${path.module}/webhook-handler.js"), "$${event_bus_name}", var.event_bus_name)
    filename = "index.js"
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${local.name_prefix}-stripe-webhook-role"

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
  name = "${local.name_prefix}-stripe-webhook-policy"
  role = aws_iam_role.lambda_role.id

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
          aws_secretsmanager_secret.stripe_webhook_secret.arn,
          aws_secretsmanager_secret.stripe_config.arn
        ]
      }
    ]
  })
}

# Function URL for webhook endpoint
resource "aws_lambda_function_url" "stripe_webhook" {
  function_name      = aws_lambda_function.stripe_webhook.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["https://api.stripe.com"]
    allow_methods     = ["POST"]
    allow_headers     = ["stripe-signature", "content-type"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }
}