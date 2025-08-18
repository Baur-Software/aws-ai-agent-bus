variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "agent_names" {
  description = "List of agent names for log groups"
  type        = list(string)
  default     = ["conductor", "critic", "sweeper"]
}