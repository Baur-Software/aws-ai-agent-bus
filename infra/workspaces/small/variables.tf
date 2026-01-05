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

# Variables for dependent resources (from nested workspaces like kv_store, secrets, event_bus)
# These allow CI validation without requiring pre-deployed dependencies
variable "kv_table_name" {
  description = "DynamoDB KV table name (from kv_store workspace)"
  type        = string
  default     = "agent-mesh-kv"
}

variable "kv_table_arn" {
  description = "DynamoDB KV table ARN (from kv_store workspace)"
  type        = string
  default     = "arn:aws:dynamodb:us-west-2:000000000000:table/agent-mesh-kv"
}

variable "secrets_arn" {
  description = "Secrets Manager ARN (from secrets workspace)"
  type        = string
  default     = "arn:aws:secretsmanager:us-west-2:000000000000:secret:agent-mesh-secrets"
}

variable "event_bus_arn" {
  description = "EventBridge bus ARN (from event_bus workspace)"
  type        = string
  default     = "arn:aws:events:us-west-2:000000000000:event-bus/agent-mesh-events"
}

variable "event_bus_name" {
  description = "EventBridge bus name (from event_bus workspace)"
  type        = string
  default     = "agent-mesh-events"
}