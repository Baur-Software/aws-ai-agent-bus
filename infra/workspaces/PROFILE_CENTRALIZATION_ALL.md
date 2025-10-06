# AWS Profile Centralization - All Workspaces

## Status by Workspace

### ✅ extra-small - CLEAN
- No hardcoded AWS profiles
- No backend configuration (stateless)
- Uses environment variables only
- **No changes needed**

### ✅ medium - CLEAN
- No hardcoded AWS profiles
- Backend configuration commented out (not using remote state yet)
- Uses environment variables only
- **No changes needed**

### ✅ large - CLEAN
- No hardcoded AWS profiles
- Backend configuration commented out (not using remote state yet)
- Uses environment variables only
- **No changes needed**

### ⚠️ small - NEEDS CLEANUP

**Main workspace:**
- ✅ `main.tf` - Updated to use partial backend config
- ✅ `variables.tf` - Has `aws_profile` variable with default
- ✅ `backend.hcl` - Created centralized backend config
- ✅ `README.md` - Documentation added

**Submodules with hardcoded profiles:**
- ⚠️ `artifacts_bucket/providers.tf` - profile = "baursoftware"
- ⚠️ `event_bus/providers.tf` - profile = "baursoftware"
- ⚠️ `events_monitoring/providers.tf` - profile = "baursoftware"
- ✅ `kv_store/providers.tf` - Example backend.hcl created
- ⚠️ `secrets/providers.tf` - profile = "baursoftware"
- ⚠️ `timeline_store/providers.tf` - profile = "baursoftware"

## Recommended Solution for Small Workspace

### Option 1: Environment Variables (Simplest)

Just set the environment variable and remove all hardcoded profiles:

```bash
# In ~/.bashrc or ~/.zshrc
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2
```

Then remove the hardcoded `profile = "baursoftware"` lines from all providers.tf files.

### Option 2: Backend Config Files (More Explicit)

Create `backend.hcl` for each module and use partial backend configuration.

## Quick Fix Script

Create this script to remove all hardcoded profiles:

```bash
#!/bin/bash
# remove-hardcoded-profiles.sh

cd infra/workspaces/small

for module in artifacts_bucket event_bus events_monitoring secrets timeline_store; do
  if [ -f "$module/providers.tf" ]; then
    echo "Updating $module/providers.tf..."

    # Backup
    cp "$module/providers.tf" "$module/providers.tf.bak"

    # Remove hardcoded profile from provider block
    sed -i '/provider "aws" {/,/^}/s/profile = "baursoftware"/# profile managed by AWS_PROFILE environment variable/' "$module/providers.tf"

    # Remove hardcoded profile from backend block
    sed -i '/backend "s3" {/,/^}/s/profile = "baursoftware"/# profile managed by AWS_PROFILE environment variable/' "$module/providers.tf"
  fi
done

echo "Done! Set export AWS_PROFILE=baursoftware before running terraform"
```

## Verification

Check that profiles are centralized:

```bash
# Should only find profiles in backend.hcl files
find infra/workspaces -name "*.tf" -exec grep -l 'profile = "baursoftware"' {} \;

# Should be empty or only show *.hcl files
find infra/workspaces -name "*.hcl" -exec grep -l 'profile = "baursoftware"' {} \;
```

## Best Practice: Use AWS_PROFILE

The cleanest approach across ALL workspaces:

```bash
# Set once in your shell profile
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2

# Then terraform commands work everywhere without any hardcoding
cd infra/workspaces/extra-small && terraform plan
cd infra/workspaces/small/kv_store && terraform plan
cd infra/workspaces/medium/mesh_agents && terraform plan
cd infra/workspaces/large/vector_pg && terraform plan
```

## Summary

- **extra-small, medium, large**: Already clean ✅
- **small**: Main workspace fixed, submodules need cleanup ⚠️
- **Recommendation**: Use `AWS_PROFILE` environment variable everywhere
- **Benefit**: Zero hardcoding, works across all workspaces

## Next Steps

1. Set `export AWS_PROFILE=baursoftware` in your shell profile
2. Remove hardcoded profiles from small workspace submodules
3. Test: `terraform plan` should work without any profile errors
4. Commit changes

Done! 🎉
