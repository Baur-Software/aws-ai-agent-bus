output "eventbridge_bus_name" {
  value = aws_cloudwatch_event_bus.main.name
}

output "bus_arn" {
  description = "EventBridge bus ARN"
  value       = aws_cloudwatch_event_bus.mesh.arn
}

output "rule_arn" {
  description = "EventBridge rule ARN"
  value       = aws_cloudwatch_event_rule.agent_events.arn
}