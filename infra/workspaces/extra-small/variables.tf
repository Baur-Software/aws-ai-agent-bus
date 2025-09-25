variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project    = "agent-mesh"
    Workspace  = "extra-small"
    CostTarget = "10-dollars-monthly"
  }
}