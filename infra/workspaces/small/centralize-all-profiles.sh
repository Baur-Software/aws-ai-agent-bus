#!/bin/bash
# Centralize AWS profiles across all small workspace modules
# This script removes hardcoded profiles and creates backend.hcl files

set -e

WORKSPACE="small"
PROFILE="baursoftware"
REGION="us-west-2"
BUCKET="baursoftware-terraform-state"

echo "🔧 Centralizing AWS profiles in $WORKSPACE workspace..."
echo ""

# Modules to process
MODULES=(
  "artifacts_bucket"
  "event_bus"
  "events_monitoring"
  "kv_store"
  "secrets"
  "timeline_store"
)

for module in "${MODULES[@]}"; do
  MODULE_DIR="$module"

  if [ ! -d "$MODULE_DIR" ]; then
    echo "⚠️  Skipping $module (directory not found)"
    continue
  fi

  echo "📦 Processing $module..."

  # Create backend.hcl
  cat > "$MODULE_DIR/backend.hcl" <<EOF
# Backend configuration for $module
# Usage: terraform init -backend-config=backend.hcl
#
# Alternatively, set AWS_PROFILE environment variable:
#   export AWS_PROFILE=$PROFILE

bucket  = "$BUCKET"
key     = "agent-mesh/$WORKSPACE/$module/terraform.tfstate"
region  = "$REGION"
profile = "$PROFILE"
encrypt = true
EOF

  echo "  ✅ Created backend.hcl"

  # Update providers.tf if it exists
  if [ -f "$MODULE_DIR/providers.tf" ]; then
    # Backup original
    cp "$MODULE_DIR/providers.tf" "$MODULE_DIR/providers.tf.bak"

    # Create temporary file with updated content
    awk '
      # Track if we are in backend block
      /backend "s3" {/ { in_backend=1 }

      # Replace backend block with partial config
      in_backend && /}/ {
        print "  # Backend configuration moved to backend.hcl"
        print "  # Run: terraform init -backend-config=backend.hcl"
        print "  # Or set: export AWS_PROFILE='$PROFILE'"
        print "  backend \"s3\" {}"
        in_backend=0
        next
      }

      # Skip lines inside backend block
      in_backend { next }

      # Replace hardcoded profile in provider block
      /profile = "'"$PROFILE"'"/ && !/backend/ {
        print "  # Profile managed by AWS_PROFILE env var or backend.hcl"
        print "  # Uncomment to override: profile = var.aws_profile"
        next
      }

      # Print all other lines
      { print }
    ' "$MODULE_DIR/providers.tf" > "$MODULE_DIR/providers.tf.tmp"

    # Replace original with updated
    mv "$MODULE_DIR/providers.tf.tmp" "$MODULE_DIR/providers.tf"

    echo "  ✅ Updated providers.tf (backup: providers.tf.bak)"
  fi

  # Add variables if they don'\''t exist
  if [ -f "$MODULE_DIR/variables.tf" ] && ! grep -q "aws_profile" "$MODULE_DIR/variables.tf"; then
    cat >> "$MODULE_DIR/variables.tf" <<EOF

# AWS Configuration
variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "$PROFILE"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "$REGION"
}
EOF
    echo "  ✅ Added aws_profile and aws_region variables"
  fi

  echo ""
done

echo "✨ Done!"
echo ""
echo "📝 Next steps:"
echo "  1. Review the changes in each module"
echo "  2. Set environment variable (recommended):"
echo "       export AWS_PROFILE=$PROFILE"
echo "  3. Or use backend config in each module:"
echo "       cd <module> && terraform init -backend-config=backend.hcl"
echo ""
echo "🔍 Verify no hardcoded profiles remain:"
echo "     grep -r 'profile = \"$PROFILE\"' --include=\"*.tf\" ."
echo ""
echo "✅ Backups created: */providers.tf.bak"
