variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "secret_names" {
  description = "List of secret names to create"
  type        = list(string)
  default     = ["api-key", "webhook-secret"]
}