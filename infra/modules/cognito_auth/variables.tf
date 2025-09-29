variable "enable_identity_pool" {
  description = "Enable creation of Cognito Identity Pool and related resources"
  type        = bool
  default     = false
}

variable "name" {
  description = "Base name for Cognito resources"
  type        = string
}
variable "enable_hosted_ui" {
  description = "Enable Cognito Hosted UI for authentication"
  type        = bool
  default     = true
}
variable "callback_urls" {
  description = "List of allowed callback URLs for Cognito OAuth"
  type        = list(string)
  default     = []
}

variable "logout_urls" {
  description = "List of allowed logout URLs for Cognito OAuth"
  type        = list(string)
  default     = []
}

# Variable declaration for tags
variable "tags" {
  description = "A map of tags to assign to resources."
  type        = map(string)
  default     = {}
}