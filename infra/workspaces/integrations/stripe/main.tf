module "stripe_integration" {
  source = "../../modules/stripe_integration"

  env = var.env

  products       = var.products
  prices         = var.prices
  webhook_url    = var.webhook_url
  webhook_events = var.webhook_events

  enable_payment_events = var.enable_payment_events
  event_bus_name        = var.event_bus_name
}