variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "project_name" {
  description = "Supabase project name (will be prefixed with env)"
  type        = string
}

variable "organization_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "database_password" {
  description = "Database password for Supabase project"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Supabase project region"
  type        = string
  default     = "us-east-1"
  validation {
    condition = contains([
      "us-east-1", "us-west-1", "ap-northeast-1", "ap-southeast-1",
      "ap-southeast-2", "eu-central-1", "eu-west-1", "eu-west-2"
    ], var.region)
    error_message = "Region must be one of the supported Supabase regions."
  }
}

variable "plan" {
  description = "Supabase subscription plan"
  type        = string
  default     = "free"
  validation {
    condition = contains([
      "free", "pro", "team", "enterprise"
    ], var.plan)
    error_message = "Plan must be one of: free, pro, team, enterprise."
  }
}

# API Settings
variable "db_schema" {
  description = "Database schema for API exposure"
  type        = string
  default     = "public,storage,graphql_public"
}

variable "db_extra_search_path" {
  description = "Extra search path for database"
  type        = string
  default     = "public,extensions"
}

variable "max_rows" {
  description = "Maximum rows returned by API"
  type        = number
  default     = 1000
}

# Auth Settings
variable "site_url" {
  description = "Site URL for authentication redirects"
  type        = string
  default     = null
}

variable "uri_allow_list" {
  description = "List of allowed URIs for authentication redirects"
  type        = string
  default     = null
}

variable "jwt_expiry" {
  description = "JWT token expiry in seconds"
  type        = number
  default     = 3600
}

variable "disable_signup" {
  description = "Disable user signups"
  type        = bool
  default     = false
}

variable "enable_signup" {
  description = "Enable user signups"
  type        = bool
  default     = true
}

variable "enable_confirmations" {
  description = "Enable email confirmations"
  type        = bool
  default     = true
}

variable "enable_email_confirmations" {
  description = "Enable email confirmations"
  type        = bool
  default     = true
}

variable "enable_phone_confirmations" {
  description = "Enable phone confirmations"
  type        = bool
  default     = false
}

# Integration Settings
variable "enable_database_events" {
  description = "Enable EventBridge events for database changes"
  type        = bool
  default     = true
}

variable "enable_webhooks" {
  description = "Enable webhook processing Lambda function"
  type        = bool
  default     = true
}

variable "event_bus_name" {
  description = "EventBridge event bus name for integration events"
  type        = string
  default     = "default"
}