variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
  default     = "dev"
}

variable "approval_change_arn" {
  description = "Change approval ARN required for execute lane (set to dummy for dev)"
  type        = string
  default     = "arn:aws:ssm:us-east-1:123456789012:changerequest/dummy-dev-approval"
}