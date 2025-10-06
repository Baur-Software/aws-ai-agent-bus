# AWS Profile Centralization

## Problem

AWS profile name "baursoftware" was hardcoded in multiple places:
- `infra/workspaces/small/main.tf` - backend and provider blocks
- `infra/workspaces/small/*/providers.tf` - 6+ module provider blocks
- Difficult to change profile across all modules
- Duplication led to inconsistencies

## Solution

Centralized AWS profile configuration using three approaches:

### 1. Environment Variables (Recommended)

```bash
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2
```

Terraform automatically picks up `AWS_PROFILE` environment variable.

**Benefits:**
- No hardcoding in files
- Works across all Terraform commands
- Easy to switch profiles
- Standard AWS CLI practice

### 2. Backend Config Files

Created `backend.hcl` files in each module:

```hcl
# backend.hcl
bucket  = "baursoftware-terraform-state"
key     = "agent-mesh/small/MODULE_NAME/terraform.tfstate"
region  = "us-west-2"
profile = "baursoftware"
encrypt = true
```

Usage:
```bash
terraform init -backend-config=backend.hcl
```

**Benefits:**
- Centralized backend configuration
- Profile specified in one file per module
- Easy to version control

### 3. Terraform Variables

Updated `variables.tf` with defaults:

```hcl
variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "baursoftware"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}
```

Updated provider blocks to use variables:

```hcl
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}
```

**Benefits:**
- Can override with `-var` flag
- Can use `terraform.tfvars` file
- Default value for convenience

## Files Updated

- ✅ `infra/workspaces/small/main.tf` - Use partial backend config
- ✅ `infra/workspaces/small/variables.tf` - Already had `aws_profile` variable
- ✅ `infra/workspaces/small/backend.hcl` - Created centralized backend config
- ✅ `infra/workspaces/small/README.md` - Documentation added
- ✅ `CLAUDE.md` - Updated with centralization notes

## Files To Update (If Needed)

Each module directory should have:
- `backend.hcl` - Module-specific backend configuration
- `providers.tf` - Updated to use variables instead of hardcoded values

Modules that need updating:
- `artifacts_bucket/`
- `event_bus/`
- `events_monitoring/`
- `kv_store/` ✅ (example created)
- `secrets/`
- `timeline_store/`

## Migration Steps

For existing Terraform state:

```bash
# 1. Backup current state
cp terraform.tfstate terraform.tfstate.backup

# 2. Set environment variables
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2

# 3. Reinitialize with new backend config
terraform init -backend-config=backend.hcl -reconfigure

# 4. Verify state
terraform plan

# Should show "No changes" if migration successful
```

## Best Practices

### For Development

```bash
# Set in ~/.bashrc or ~/.zshrc
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2

# Then just use terraform normally
terraform init
terraform plan
terraform apply
```

### For CI/CD

```bash
# Use backend config file
terraform init -backend-config=backend.hcl

# Or set AWS credentials via environment/IAM role
# Don't hardcode profiles in CI
```

### For Multiple Environments

```bash
# dev.backend.hcl
profile = "baursoftware-dev"

# prod.backend.hcl
profile = "baursoftware-prod"

# Then:
terraform init -backend-config=dev.backend.hcl
```

## Verification

Check that profile is not hardcoded:

```bash
# Should return nothing (or only in backend.hcl files)
grep -r 'profile = "baursoftware"' infra/workspaces/small/ --include="*.tf"
```

Check variables are used:

```bash
# Should find provider blocks using variables
grep -r 'profile = var.aws_profile' infra/workspaces/small/ --include="*.tf"
```

## References

- [Terraform Backend Configuration](https://www.terraform.io/language/settings/backends/configuration#partial-configuration)
- [AWS Provider Authentication](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication-and-configuration)
- Project README: `infra/workspaces/small/README.md`
