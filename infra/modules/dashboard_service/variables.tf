variable "name" {}
variable "description" {
  default = "Dashboard for monitoring the service"
}
variable "env" { type = string }
variable "cpu_units" { type = string }
variable "memory_mb" { type = string }
variable "enable_spot" { type = bool }
variable "desired_count" { type = number }
variable "create_alb" { type = bool }
variable "container_image" { type = string }
variable "container_port" { type = number }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "kv_table_name" { type = string }
variable "kv_table_arn" { type = string }
variable "event_bus_name" { type = string }
variable "event_bus_arn" { type = string }
variable "secrets_arn" { type = string }
variable "dashboard_lambda_role_arn" { type = string }
