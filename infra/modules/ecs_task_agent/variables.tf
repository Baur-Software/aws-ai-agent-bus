variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "agent_name" {
  description = "Agent name (conductor/critic/sweeper)"
  type        = string
}

variable "lane" {
  description = "Lane permission level (read_only/dry_run/execute)"
  type        = string
  default     = "read_only"
}

variable "container_image" {
  description = "Container image for the agent"
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:latest"
}

variable "cpu" {
  description = "CPU units for the task"
  type        = string
  default     = "256"
}

variable "memory" {
  description = "Memory for the task"
  type        = string
  default     = "512"
}