terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources to reference other components
data "terraform_remote_state" "kv_store" {
  backend = "local"
  config = {
    path = "../kv_store/terraform.tfstate"
  }
}

data "terraform_remote_state" "event_bus" {
  backend = "local"
  config = {
    path = "../event_bus/terraform.tfstate"
  }
}

data "terraform_remote_state" "secrets" {
  backend = "local"
  config = {
    path = "../secrets/terraform.tfstate"
  }
}

# Dashboard service module
module "dashboard_service" {
  source = "../../../modules/ecs_dashboard_service"

  env = var.env

  # Resource configuration for small workspace
  cpu_units     = var.cpu_units
  memory_mb     = var.memory_mb
  enable_spot   = var.enable_spot
  desired_count = var.desired_count
  create_alb    = var.create_alb

  # Container configuration
  container_image = var.container_image
  container_port  = var.container_port

  # Network configuration (optional overrides)
  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  # Dependencies from other components
  kv_table_name  = data.terraform_remote_state.kv_store.outputs.table_name
  kv_table_arn   = data.terraform_remote_state.kv_store.outputs.table_arn
  event_bus_name = data.terraform_remote_state.event_bus.outputs.bus_name
  event_bus_arn  = data.terraform_remote_state.event_bus.outputs.bus_arn
  secrets_arn    = data.terraform_remote_state.secrets.outputs.secret_arn
}