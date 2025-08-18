output "bus_name" {
  description = "EventBridge bus name"
  value       = aws_cloudwatch_event_bus.mesh.name
}

output "bus_arn" {
  description = "EventBridge bus ARN"
  value       = aws_cloudwatch_event_bus.mesh.arn
}

output "rule_arn" {
  description = "EventBridge rule ARN"
  value       = aws_cloudwatch_event_rule.agent_events.arn
}