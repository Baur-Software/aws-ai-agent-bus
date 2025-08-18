output "bus_name" {
  description = "EventBridge bus name"
  value       = module.event_bus.bus_name
}

output "bus_arn" {
  description = "EventBridge bus ARN"
  value       = module.event_bus.bus_arn
}

output "rule_arn" {
  description = "EventBridge rule ARN"
  value       = module.event_bus.rule_arn
}