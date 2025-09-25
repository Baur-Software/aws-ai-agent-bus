variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
  default     = "dev"
}

variable "tags" {
  description = "Default tags for all resources"
  type        = map(string)
  default = {
    workspace   = "small"
    managed_by  = "terraform"
    cost_center = "agent-mesh"
  }
}

# Dashboard service configuration
variable "dashboard_cpu_units" {
  description = "CPU units for dashboard service (512 = 0.5 vCPU)"
  type        = string
  default     = "512"
}

variable "dashboard_memory_mb" {
  description = "Memory in MB for dashboard service"
  type        = string
  default     = "1024"
}

variable "dashboard_desired_count" {
  description = "Number of dashboard service instances"
  type        = number
  default     = 1
}

variable "dashboard_enable_spot" {
  description = "Use Fargate Spot for dashboard service"
  type        = bool
  default     = true
}

variable "dashboard_create_alb" {
  description = "Create ALB for dashboard service"
  type        = bool
  default     = true
}

variable "dashboard_container_image" {
  description = "Container image for dashboard service"
  type        = string
  default     = "public.ecr.aws/docker/library/node:18-alpine"
}

variable "dashboard_container_port" {
  description = "Port for dashboard service container"
  type        = number
  default     = 3000
}

# Network configuration (optional overrides)
variable "vpc_id" {
  description = "VPC ID (leave empty for default VPC)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs (leave empty for default subnets)"
  type        = list(string)
  default     = []
}