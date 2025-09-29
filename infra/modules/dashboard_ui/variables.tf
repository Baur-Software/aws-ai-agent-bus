variable "env" { type = string }
variable "user_pool_id" { type = string }
variable "user_pool_client_id" { type = string }
variable "region" { type = string }
variable "callback_urls" { type = list(string) }
variable "dashboard_alb_dns" { type = string }
