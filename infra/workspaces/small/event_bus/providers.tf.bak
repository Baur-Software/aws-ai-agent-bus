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
    key     = "agent-mesh/small/event_bus/terraform.tfstate"
    region  = "us-west-2"
    profile = "baursoftware"
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