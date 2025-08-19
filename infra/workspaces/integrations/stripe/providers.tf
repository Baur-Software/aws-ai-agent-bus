terraform {
  required_version = ">= 1.0"

  required_providers {
    stripe = {
      source  = "lukasaron/stripe"
      version = "~> 3.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

# Configure Stripe provider
provider "stripe" {
  # API key should be set via STRIPE_API_KEY environment variable
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "agent-mesh"
      Environment = var.env
      Workspace   = "integrations-stripe"
      ManagedBy   = "terraform"
    }
  }
}