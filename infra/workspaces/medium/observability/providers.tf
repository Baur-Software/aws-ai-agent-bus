terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "agent-mesh/medium/observability/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  default_tags {
    tags = {
      ManagedBy = "terraform"
      Project   = "agent-mesh"
    }
  }
}