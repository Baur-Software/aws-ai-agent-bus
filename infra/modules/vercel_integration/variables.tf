variable "env" {
  description = "Environment name (dev/stage/prod)"
  type        = string
}

variable "project_name" {
  description = "Vercel project name (will be prefixed with env)"
  type        = string
}

variable "framework" {
  description = "Framework preset for the project"
  type        = string
  default     = "nextjs"
  validation {
    condition = contains([
      "nextjs", "create-react-app", "gatsby", "remix", "astro", "nuxtjs",
      "vue", "svelte", "sveltekit", "angular", "vite", "static"
    ], var.framework)
    error_message = "Framework must be one of the supported Vercel frameworks."
  }
}

variable "vercel_team_id" {
  description = "Vercel team ID (optional for personal accounts)"
  type        = string
  default     = null
}

variable "git_repository" {
  description = "Git repository configuration"
  type = object({
    type = string
    repo = string
  })
}

variable "build_command" {
  description = "Build command override"
  type        = string
  default     = null
}

variable "output_directory" {
  description = "Output directory override"
  type        = string
  default     = null
}

variable "install_command" {
  description = "Install command override"
  type        = string
  default     = null
}

variable "root_directory" {
  description = "Root directory of the project"
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Environment variables for the project"
  type        = map(string)
  default     = {}
}

variable "custom_domains" {
  description = "List of custom domains to configure"
  type        = list(string)
  default     = []
}

variable "enable_deployment_events" {
  description = "Enable EventBridge events for deployments"
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