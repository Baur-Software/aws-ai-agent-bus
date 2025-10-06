# Small Workspace - Centralized AWS Profile Configuration

## Overview

AWS profile configuration has been centralized to avoid duplication across modules.

## Configuration

### Option 1: Environment Variable (Recommended)

Set the AWS profile as an environment variable before running Terraform:

```bash
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2

# Then run terraform commands
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

### Option 2: backend.hcl Files

Each module directory contains a `backend.hcl` file with centralized backend configuration:

```bash
cd kv_store
terraform init -backend-config=backend.hcl
```

### Option 3: Terraform Variables

Override the profile using terraform variables:

```bash
terraform plan -var="aws_profile=your-profile-name"
terraform apply -var="aws_profile=your-profile-name"
```

Or create a `terraform.tfvars` file:

```hcl
aws_profile = "your-profile-name"
aws_region  = "us-west-2"
```

## Module Structure

- `main.tf` - Main workspace configuration
- `variables.tf` - Variable definitions (includes `aws_profile` with default)
- `backend.hcl` - Centralized backend configuration
- `*/backend.hcl` - Per-module backend configurations

## Benefits

1. **Single Source of Truth**: Profile name defined in one place (`variables.tf`)
2. **Easy Updates**: Change profile in `backend.hcl` or set `AWS_PROFILE` env var
3. **No Duplication**: No hardcoded profiles scattered across `providers.tf` files
4. **Flexibility**: Can override per-module if needed

## Migration

If you have existing Terraform state:

```bash
# Reinitialize with new backend config
terraform init -backend-config=backend.hcl -reconfigure
```

##Best Practice

Use environment variables for profile management:

```bash
# In your ~/.bashrc or ~/.zshrc
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2
```

This way you never need to specify the profile in Terraform files.
