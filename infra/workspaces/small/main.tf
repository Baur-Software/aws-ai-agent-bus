terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Backend configuration moved to backend.hcl for centralization
  # Run: terraform init -backend-config=backend.hcl
  backend "s3" {}
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

module "state_bucket" {
  source = "../../modules/state_bucket"
}

# Dashboard service module
module "dashboard_service" {
  source = "../../modules/dashboard_service"

  name                      = "dashboard-service-${var.env}"
  dashboard_lambda_role_arn = aws_iam_role.dashboard_lambda_role.arn

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
  kv_table_name  = data.terraform_remote_state.dynamodb_kv.outputs.table_name
  kv_table_arn   = data.terraform_remote_state.dynamodb_kv.outputs.table_arn
  secrets_arn    = data.terraform_remote_state.secrets.outputs.secret_arn
  event_bus_arn  = data.terraform_remote_state.eventbridge_bus.outputs.bus_arn
  event_bus_name = data.terraform_remote_state.eventbridge_bus.outputs.bus_name
}

module "dashboard_ui" {
  source = "../../modules/dashboard_ui"

  env = var.env

  # Cognito configuration
  user_pool_id        = var.cognito_user_pool_id
  user_pool_client_id = var.cognito_user_pool_client_id
  region              = var.aws_region
  callback_urls       = var.cognito_callback_urls

  # Dashboard service ALB DNS (if created)
  dashboard_alb_dns = var.create_alb ? module.dashboard_service.alb_dns_name : ""
}

resource "aws_iam_role" "dashboard_lambda_role" {
  name = "dashboard-lambda-role-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dashboard_lambda_basic" {
  role       = aws_iam_role.dashboard_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}