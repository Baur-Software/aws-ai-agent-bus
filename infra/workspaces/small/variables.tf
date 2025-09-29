variable "aws_region" {
  default = "us-west-2"
}
variable "cpu_units" {
  description = "CPU units for the dashboard service"
  type        = number
  default     = 0.75
}

variable "memory_mb" {
  description = "Memory (MB) for the dashboard service"
  type        = number
  default     = 512
}

variable "enable_spot" {
  description = "Enable spot instances for the dashboard service"
  type        = bool
  default     = false
}

variable "desired_count" {
  description = "Desired count of dashboard service tasks"
  type        = number
  default     = 1
}

variable "create_alb" {
  description = "Whether to create an ALB for the dashboard service"
  type        = bool
  default     = true
}

variable "container_image" {
  description = "Container image for the dashboard service"
  type        = string
  default     = ""
}

variable "container_port" {
  description = "Container port for the dashboard service"
  type        = number
  default     = 3001
}

variable "env" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs"
  type        = list(string)
  default     = []
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
  default     = ""
}

variable "cognito_callback_urls" {
  description = "Cognito callback URLs"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "baursoftware"

}