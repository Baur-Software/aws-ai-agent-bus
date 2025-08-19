variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "products" {
  description = "List of Stripe products to create"
  type = list(object({
    name        = string
    description = string
    type        = string
    active      = bool
    metadata    = optional(map(string))
  }))
  default = []
}

variable "prices" {
  description = "List of Stripe prices to create"
  type = list(object({
    product_name = string
    currency     = string
    unit_amount  = number
    nickname     = string
    recurring = object({
      interval       = string
      interval_count = number
    })
    active = bool
  }))
  default = []
}

variable "webhook_url" {
  description = "Webhook endpoint URL (will be auto-generated if not provided)"
  type        = string
  default     = null
}

variable "webhook_events" {
  description = "List of Stripe webhook events to subscribe to"
  type        = list(string)
  default = [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.created",
    "customer.updated",
    "customer.deleted"
  ]
}

variable "enable_payment_events" {
  description = "Enable EventBridge events for payment processing"
  type        = bool
  default     = true
}

variable "event_bus_name" {
  description = "EventBridge event bus name for integration events"
  type        = string
  default     = "default"
}