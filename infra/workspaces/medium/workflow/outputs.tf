output "state_machine_arn" {
  description = "Step Functions state machine ARN"
  value       = module.lanes_workflow.state_machine_arn
}

output "state_machine_name" {
  description = "Step Functions state machine name"
  value       = module.lanes_workflow.state_machine_name
}

output "subtasks_queue_url" {
  description = "SQS subtasks queue URL"
  value       = module.subtasks_queue.queue_url
}