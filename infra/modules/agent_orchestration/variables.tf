variable "env" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "mcp_server_state_path" {
  description = "Path to the MCP server Terraform state file"
  type        = string
  default     = "../../../mcp-server/terraform/workspaces/core/terraform.tfstate"
}

variable "timeline_store_state_path" {
  description = "Path to the timeline store Terraform state file"
  type        = string
  default     = "../../small/timeline_store/terraform.tfstate"
}

variable "workflow_state_path" {
  description = "Path to the workflow Terraform state file"
  type        = string
  default     = "../../medium/workflow/terraform.tfstate"
}

variable "conductor_task_arn" {
  description = "ECS task definition ARN for conductor agent"
  type        = string
}

variable "critic_task_arn" {
  description = "ECS task definition ARN for critic agent"
  type        = string
}

variable "sweeper_task_arn" {
  description = "ECS task definition ARN for sweeper agent"
  type        = string
}

variable "agent_task_role_arns" {
  description = "List of IAM role ARNs that can be passed to agent tasks"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for agent tasks"
  type        = string
}

variable "subnets" {
  description = "List of subnet IDs for agent tasks"
  type        = list(string)
}