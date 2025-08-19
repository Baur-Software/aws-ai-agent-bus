output "webhook_endpoint_id" {
  description = "Stripe webhook endpoint ID"
  value       = module.stripe_integration.webhook_endpoint_id
}

output "webhook_endpoint_url" {
  description = "Stripe webhook endpoint URL"
  value       = module.stripe_integration.webhook_endpoint_url
}

output "lambda_function_url" {
  description = "Lambda webhook processor URL"
  value       = module.stripe_integration.lambda_function_url
}

output "products" {
  description = "Created Stripe products"
  value       = module.stripe_integration.products
}

output "prices" {
  description = "Created Stripe prices"
  value       = module.stripe_integration.prices
}

output "secrets_manager_config_arn" {
  description = "AWS Secrets Manager ARN for Stripe configuration"
  value       = module.stripe_integration.secrets_manager_config_arn
}