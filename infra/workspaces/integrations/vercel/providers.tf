terraform {
  required_version = ">= 1.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.12"
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

# Configure Vercel provider
provider "vercel" {
  # API token should be set via VERCEL_API_TOKEN environment variable
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "agent-mesh"
      Environment = var.env
      Workspace   = "integrations-vercel"
      ManagedBy   = "terraform"
    }
  }
}