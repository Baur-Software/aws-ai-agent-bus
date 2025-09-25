terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# Core KV storage - essential for user connections and app configs
module "kv_store" {
  source = "../../modules/dynamodb_kv"

  env = var.env
}

# Event bus for system coordination
module "event_bus" {
  source = "../../modules/eventbridge_bus"

  env = var.env
}

# Minimal secrets storage for integrations
module "secrets" {
  source = "../../modules/secrets_min"

  env = var.env
}

# Dashboard service with embedded Rust MCP server
module "dashboard_service" {
  source = "../../modules/ecs_dashboard_service"

  env = var.env

  # Cost optimization settings for $10/month target
  cpu_units     = "256" # 0.25 vCPU
  memory_mb     = "512" # 0.5 GB
  enable_spot   = true  # Use Fargate Spot for 70% savings
  desired_count = 1     # Single instance

  # No ALB for extra-small to save costs
  create_alb = false

  # Dependencies
  kv_table_name  = module.kv_store.table_name
  kv_table_arn   = module.kv_store.table_arn
  event_bus_name = module.event_bus.bus_name
  event_bus_arn  = module.event_bus.bus_arn
  secrets_arn    = module.secrets.secret_arn
}