variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "service_name" {
  description = "Service name"
  type        = string
  default     = "dashboard"
}

variable "cpu_units" {
  description = "CPU units for the ECS task (256 = 0.25 vCPU)"
  type        = string
  default     = "256"
}

variable "memory_mb" {
  description = "Memory in MB for the ECS task"
  type        = string
  default     = "512"
}

variable "container_image" {
  description = "Container image for dashboard server (includes embedded Rust MCP binary)"
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:latest" # Placeholder
}

variable "desired_count" {
  description = "Number of running tasks"
  type        = number
  default     = 1
}

variable "enable_spot" {
  description = "Use Fargate Spot for cost savings (70% cheaper but can be interrupted)"
  type        = bool
  default     = true
}

variable "container_port" {
  description = "Port the dashboard server listens on"
  type        = number
  default     = 3001
}

# Dependencies from other modules
variable "kv_table_name" {
  description = "DynamoDB KV table name"
  type        = string
}

variable "kv_table_arn" {
  description = "DynamoDB KV table ARN"
  type        = string
}

variable "event_bus_name" {
  description = "EventBridge bus name"
  type        = string
}

variable "event_bus_arn" {
  description = "EventBridge bus ARN"
  type        = string
}

variable "secrets_arn" {
  description = "Secrets Manager ARN"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID (optional - will use default VPC if not provided)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs (optional - will use default subnets if not provided)"
  type        = list(string)
  default     = []
}

variable "create_alb" {
  description = "Create Application Load Balancer for external access"
  type        = bool
  default     = false
}