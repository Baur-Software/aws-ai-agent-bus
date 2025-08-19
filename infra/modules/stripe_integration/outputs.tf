locals {
  webhook_endpoint = var.webhook_url != null ? stripe_webhook_endpoint.main[0] : stripe_webhook_endpoint.lambda[0]
}

output "webhook_endpoint_id" {
  description = "Stripe webhook endpoint ID"
  value       = local.webhook_endpoint.id
}

output "webhook_endpoint_url" {
  description = "Stripe webhook endpoint URL"
  value       = local.webhook_endpoint.url
}

output "webhook_endpoint_secret" {
  description = "Stripe webhook endpoint secret"
  value       = local.webhook_endpoint.secret
  sensitive   = true
}

output "lambda_function_url" {
  description = "Lambda webhook processor URL"
  value       = aws_lambda_function_url.stripe_webhook.function_url
}

output "products" {
  description = "Created Stripe products"
  value = {
    for k, v in stripe_product.products : k => {
      id          = v.id
      name        = v.name
      description = v.description
      type        = v.type
      active      = v.active
    }
  }
}

output "prices" {
  description = "Created Stripe prices"
  value = {
    for k, v in stripe_price.prices : k => {
      id          = v.id
      product     = v.product
      currency    = v.currency
      unit_amount = v.unit_amount
      nickname    = v.nickname
      active      = v.active
    }
  }
}

output "secrets_manager_config_arn" {
  description = "AWS Secrets Manager ARN for Stripe configuration"
  value       = aws_secretsmanager_secret.stripe_config.arn
}

output "secrets_manager_webhook_secret_arn" {
  description = "AWS Secrets Manager ARN for Stripe webhook secret"
  value       = aws_secretsmanager_secret.stripe_webhook_secret.arn
}

output "event_rule_arn" {
  description = "EventBridge rule ARN for payment events (if enabled)"
  value       = var.enable_payment_events ? aws_cloudwatch_event_rule.stripe_events[0].arn : null
}