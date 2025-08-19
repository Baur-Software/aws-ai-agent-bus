terraform {
  required_version = ">= 1.0"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
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

# Configure Supabase provider
provider "supabase" {
  # Access token should be set via SUPABASE_ACCESS_TOKEN environment variable
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "agent-mesh"
      Environment = var.env
      Workspace   = "integrations-supabase"
      ManagedBy   = "terraform"
    }
  }
}