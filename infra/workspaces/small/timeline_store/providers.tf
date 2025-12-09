terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket  = "baursoftware-terraform-state"
    key     = "agent-mesh/small/timeline_store/terraform.tfstate"
    region  = "us-west-2"
    # profile = "baursoftware" # Now using AWS_PROFILE env var or backend.hcl
    encrypt = true
  }
}

provider "aws" {
  default_tags {
    tags = {
      ManagedBy = "terraform"
      Project   = "agent-mesh"
    }
  }
}