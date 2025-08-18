variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "conductor_task_arn" {
  description = "Conductor ECS task definition ARN"
  type        = string
}

variable "critic_task_arn" {
  description = "Critic ECS task definition ARN"
  type        = string
}

variable "sweeper_task_arn" {
  description = "Sweeper ECS task definition ARN"
  type        = string
}

variable "task_role_arns" {
  description = "List of task role ARNs to allow PassRole"
  type        = list(string)
}

variable "subtasks_queue_arn" {
  description = "SQS subtasks queue ARN"
  type        = string
}

variable "subtasks_queue_url" {
  description = "SQS subtasks queue URL"
  type        = string
}

variable "timeline_bucket_arn" {
  description = "Timeline S3 bucket ARN"
  type        = string
}

variable "timeline_bucket_name" {
  description = "Timeline S3 bucket name"
  type        = string
}

variable "event_bus_arn" {
  description = "EventBridge bus ARN"
  type        = string
}

variable "event_bus_name" {
  description = "EventBridge bus name"
  type        = string
}

variable "security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "subnets" {
  description = "Subnets for ECS tasks"
  type        = list(string)
}