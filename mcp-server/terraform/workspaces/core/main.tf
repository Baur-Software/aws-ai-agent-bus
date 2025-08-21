# MCP Server Core Infrastructure
# This workspace deploys the essential AWS services that support the MCP server

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

locals {
  common_tags = {
    Project     = "aws-ai-agent-bus"
    Component   = "mcp-server"
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

# Core MCP Server Infrastructure
module "kv_store" {
  source = "../../modules/dynamodb_kv"
  env    = var.env
}

module "artifacts_storage" {
  source = "../../modules/s3_bucket_artifacts"
  env    = var.env
}

module "event_bus" {
  source = "../../modules/eventbridge_bus"
  env    = var.env
}

module "message_queue" {
  source = "../../modules/sqs_subtasks"
  env    = var.env
}

module "secrets" {
  source = "../../modules/secrets_min"
  env    = var.env
}