output "task_definition_arn" {
  description = "ECS task definition ARN"
  value       = aws_ecs_task_definition.agent.arn
}

output "task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.task_role.arn
}

output "execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.task_execution_role.arn
}

output "security_group_id" {
  description = "Security group ID for the task"
  value       = aws_security_group.task.id
}