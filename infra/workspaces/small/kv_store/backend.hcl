# Backend configuration for kv_store module
# Usage: terraform init -backend-config=backend.hcl

bucket  = "baursoftware-terraform-state"
key     = "agent-mesh/small/kv_store/terraform.tfstate"
region  = "us-west-2"
profile = "baursoftware"
encrypt = true
