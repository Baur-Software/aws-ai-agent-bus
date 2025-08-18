output "conductor_task_arn" {
  description = "Conductor task definition ARN"
  value       = module.conductor_agent.task_definition_arn
}

output "critic_task_arn" {
  description = "Critic task definition ARN"
  value       = module.critic_agent.task_definition_arn
}

output "sweeper_task_arn" {
  description = "Sweeper task definition ARN"
  value       = module.sweeper_agent.task_definition_arn
}

output "task_role_arns" {
  description = "List of all task role ARNs"
  value = [
    module.conductor_agent.task_role_arn,
    module.critic_agent.task_role_arn,
    module.sweeper_agent.task_role_arn
  ]
}

output "security_group_id" {
  description = "Security group ID (using conductor's as they're all the same)"
  value       = module.conductor_agent.security_group_id
}