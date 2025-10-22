# Centralize AWS profiles across all small workspace modules
# PowerShell version for Windows

$ErrorActionPreference = "Stop"

$WORKSPACE = "small"
$PROFILE = "baursoftware"
$REGION = "us-west-2"
$BUCKET = "baursoftware-terraform-state"

Write-Host "🔧 Centralizing AWS profiles in $WORKSPACE workspace..." -ForegroundColor Cyan
Write-Host ""

$MODULES = @(
    "artifacts_bucket",
    "event_bus",
    "events_monitoring",
    "kv_store",
    "secrets",
    "timeline_store"
)

foreach ($module in $MODULES) {
    $moduleDir = $module

    if (!(Test-Path $moduleDir)) {
        Write-Host "⚠️  Skipping $module (directory not found)" -ForegroundColor Yellow
        continue
    }

    Write-Host "📦 Processing $module..." -ForegroundColor Green

    # Create backend.hcl
    $backendContent = @"
# Backend configuration for $module
# Usage: terraform init -backend-config=backend.hcl
#
# Alternatively, set AWS_PROFILE environment variable:
#   `$env:AWS_PROFILE = "$PROFILE"

bucket  = "$BUCKET"
key     = "agent-mesh/$WORKSPACE/$module/terraform.tfstate"
region  = "$REGION"
profile = "$PROFILE"
encrypt = true
"@

    $backendContent | Out-File -FilePath "$moduleDir\backend.hcl" -Encoding UTF8
    Write-Host "  ✅ Created backend.hcl"

    # Update providers.tf if it exists
    if (Test-Path "$moduleDir\providers.tf") {
        # Backup original
        Copy-Item "$moduleDir\providers.tf" "$moduleDir\providers.tf.bak"

        # Read content
        $content = Get-Content "$moduleDir\providers.tf" -Raw

        # Replace backend block with partial config
        $content = $content -replace '(?s)backend\s+"s3"\s+\{[^}]+\}', @"
# Backend configuration moved to backend.hcl
  # Run: terraform init -backend-config=backend.hcl
  # Or set: `$env:AWS_PROFILE = '$PROFILE'
  backend "s3" {}
"@

        # Replace hardcoded profile in provider block
        $content = $content -replace 'profile\s*=\s*"baursoftware"', @"
# Profile managed by AWS_PROFILE env var or backend.hcl
  # Uncomment to override: profile = var.aws_profile
"@

        # Write updated content
        $content | Out-File -FilePath "$moduleDir\providers.tf" -Encoding UTF8
        Write-Host "  ✅ Updated providers.tf (backup: providers.tf.bak)"
    }

    # Add variables if they don't exist
    if ((Test-Path "$moduleDir\variables.tf") -and
        -not (Select-String -Path "$moduleDir\variables.tf" -Pattern "aws_profile" -Quiet)) {

        $varsContent = @"

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
"@

        Add-Content -Path "$moduleDir\variables.tf" -Value $varsContent
        Write-Host "  ✅ Added aws_profile and aws_region variables"
    }

    Write-Host ""
}

Write-Host "✨ Done!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the changes in each module"
Write-Host "  2. Set environment variable (recommended):"
Write-Host "       `$env:AWS_PROFILE = '$PROFILE'" -ForegroundColor Yellow
Write-Host "  3. Or use backend config in each module:"
Write-Host "       cd <module>; terraform init -backend-config=backend.hcl" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 Verify no hardcoded profiles remain:" -ForegroundColor Cyan
Write-Host "     Get-ChildItem -Recurse -Filter *.tf | Select-String 'profile = `"$PROFILE`"'" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Backups created: */providers.tf.bak" -ForegroundColor Green
