variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
  default     = "dev"
}

# Resource sizing variables
variable "cpu_units" {
  description = "CPU units for the ECS task (256 = 0.25 vCPU)"
  type        = string
  default     = "512" # 0.5 vCPU for small workspace
}

variable "memory_mb" {
  description = "Memory in MB for the ECS task"
  type        = string
  default     = "1024" # 1 GB for small workspace
}

variable "desired_count" {
  description = "Number of instances to run"
  type        = number
  default     = 1
}

variable "enable_spot" {
  description = "Use Fargate Spot instances for cost savings"
  type        = bool
  default     = true
}

variable "create_alb" {
  description = "Create an Application Load Balancer for external access"
  type        = bool
  default     = true # ALB included in small workspace
}

# Container configuration
variable "container_image" {
  description = "Docker image for the dashboard service"
  type        = string
  default     = "public.ecr.aws/docker/library/node:18-alpine" # Placeholder
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

# Network overrides (optional)
variable "vpc_id" {
  description = "VPC ID (leave empty to use default VPC)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs (leave empty to use default subnets)"
  type        = list(string)
  default     = []
}