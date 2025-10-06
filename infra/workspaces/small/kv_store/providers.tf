terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket  = "baursoftware-terraform-state"
    key     = "agent-mesh/small/kv_store/terraform.tfstate"
    region  = "us-west-2"
    # profile = "baursoftware" # Now using AWS_PROFILE env var or backend.hcl
    encrypt = true
  }
}

provider "aws" {
  region  = "us-west-2"
  # profile = "baursoftware" # Now using AWS_PROFILE env var or backend.hcl

  default_tags {
    tags = {
      ManagedBy = "terraform"
      Project   = "agent-mesh"
    }
  }
}