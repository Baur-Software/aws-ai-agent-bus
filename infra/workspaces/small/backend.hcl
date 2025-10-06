# Shared backend configuration for small workspace
# Usage: terraform init -backend-config=backend.hcl
#
# This file centralizes the AWS profile and backend settings
# so they don't need to be duplicated across all providers.tf files

bucket  = "baursoftware-terraform-state"
key     = "infra/workspaces/small/terraform.tfstate"
region  = "us-west-2"
profile = "baursoftware"
encrypt = true
