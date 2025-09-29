#!/bin/bash

# Script to fix all Terraform backends in small workspace components

COMPONENTS=(
  "artifacts_bucket"
  "dashboard_service"
  "event_bus"
  "secrets"
  "timeline_store"
)

for component in "${COMPONENTS[@]}"; do
  providers_file="infra/workspaces/small/${component}/providers.tf"

  if [ -f "$providers_file" ]; then
    echo "Fixing backend for $component..."

    # Replace the commented S3 backend with proper configuration
    sed -i 's|  # backend "s3" {|  backend "s3" {|g' "$providers_file"
    sed -i 's|  #   bucket = "your-terraform-state-bucket"|    bucket  = "baursoftware-terraform-state"|g' "$providers_file"
    sed -i "s|  #   key    = \"agent-mesh/small/${component}/terraform.tfstate\"|    key     = \"agent-mesh/small/${component}/terraform.tfstate\"|g" "$providers_file"
    sed -i 's|  #   region = "us-east-1"|    region  = "us-west-2"|g' "$providers_file"
    sed -i 's|  # }|    profile = "baursoftware"\n    encrypt = true\n  }|g' "$providers_file"

    echo "Fixed $component backend configuration"
  else
    echo "No providers.tf found for $component"
  fi
done

echo "All Terraform backends updated to use S3!"