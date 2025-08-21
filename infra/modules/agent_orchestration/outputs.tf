output "state_machine_arn" {
  description = "ARN of the agent orchestration state machine"
  value       = aws_sfn_state_machine.agent_orchestration.arn
}

output "state_machine_name" {
  description = "Name of the agent orchestration state machine"
  value       = aws_sfn_state_machine.agent_orchestration.name
}

output "execution_role_arn" {
  description = "ARN of the Step Functions execution role"
  value       = aws_iam_role.stepfn_role.arn
}