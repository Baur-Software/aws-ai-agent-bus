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

# Core KV storage
module "kv_store" {
  source = "../../modules/dynamodb_kv"

  env = var.env
}

# Event bus for system coordination
module "event_bus" {
  source = "../../modules/eventbridge_bus"

  env = var.env
}

# Event monitoring system
module "events_monitoring" {
  source = "../../modules/dynamodb_events"

  env = var.env
}

# Secrets storage
module "secrets" {
  source = "../../modules/secrets_min"

  env = var.env
}

# Artifacts bucket
module "artifacts_bucket" {
  source = "../../modules/s3_artifacts"

  env = var.env
}

# Timeline store
module "timeline_store" {
  source = "../../modules/dynamodb_timeline"

  env = var.env
}

# Cognito authentication
module "cognito_auth" {
  source = "../../modules/cognito_auth"

  name = local.name
  tags = var.tags

  # Development-friendly configuration
  callback_urls        = var.cognito_callback_urls
  logout_urls         = var.cognito_logout_urls
  enable_hosted_ui    = var.cognito_enable_hosted_ui
  enable_identity_pool = var.cognito_enable_identity_pool
}

# Dashboard service with all dependencies
module "dashboard_service" {
  source = "../../modules/ecs_dashboard_service"

  env = var.env

  # Small workspace configuration - balanced cost/performance
  cpu_units     = var.dashboard_cpu_units
  memory_mb     = var.dashboard_memory_mb
  enable_spot   = var.dashboard_enable_spot
  desired_count = var.dashboard_desired_count
  create_alb    = var.dashboard_create_alb

  # Container configuration
  container_image = var.dashboard_container_image
  container_port  = var.dashboard_container_port

  # Network configuration
  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  # Dependencies - direct module references
  kv_table_name  = module.kv_store.table_name
  kv_table_arn   = module.kv_store.table_arn
  event_bus_name = module.event_bus.bus_name
  event_bus_arn  = module.event_bus.bus_arn
  secrets_arn    = module.secrets.secret_arn

  depends_on = [
    module.kv_store,
    module.event_bus,
    module.secrets
  ]
}