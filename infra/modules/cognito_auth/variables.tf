# Variables for Cognito Authentication Module

variable "name" {
  description = "Name prefix for all resources"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "callback_urls" {
  description = "List of allowed callback URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173", "https://localhost:5173"]
}

variable "logout_urls" {
  description = "List of allowed logout URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:5173", "https://localhost:5173"]
}

variable "enable_hosted_ui" {
  description = "Enable Cognito Hosted UI"
  type        = bool
  default     = true
}

variable "enable_identity_pool" {
  description = "Enable Cognito Identity Pool for AWS resource access"
  type        = bool
  default     = false
}

variable "enable_mfa" {
  description = "Enable Multi-Factor Authentication"
  type        = bool
  default     = false
}

variable "mfa_configuration" {
  description = "MFA configuration - OFF, ON, or OPTIONAL"
  type        = string
  default     = "OFF"

  validation {
    condition     = contains(["OFF", "ON", "OPTIONAL"], var.mfa_configuration)
    error_message = "MFA configuration must be OFF, ON, or OPTIONAL."
  }
}

variable "password_minimum_length" {
  description = "Minimum password length"
  type        = number
  default     = 8
}

variable "password_require_numbers" {
  description = "Require numbers in password"
  type        = bool
  default     = true
}

variable "password_require_symbols" {
  description = "Require symbols in password"
  type        = bool
  default     = false
}

variable "password_require_uppercase" {
  description = "Require uppercase letters in password"
  type        = bool
  default     = true
}

variable "password_require_lowercase" {
  description = "Require lowercase letters in password"
  type        = bool
  default     = true
}

variable "token_validity_access" {
  description = "Access token validity in hours"
  type        = number
  default     = 1
}

variable "token_validity_id" {
  description = "ID token validity in hours"
  type        = number
  default     = 1
}

variable "token_validity_refresh" {
  description = "Refresh token validity in days"
  type        = number
  default     = 30
}