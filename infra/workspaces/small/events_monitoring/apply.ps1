# PowerShell apply script for event monitoring infrastructure
$env:AWS_PROFILE = "your-profile"
$env:WS = "small/events_monitoring"
$env:ENV = "dev"
$env:AWS_REGION = "us-west-2"

Write-Host "Applying Terraform changes for event monitoring infrastructure..."
Write-Host "AWS_PROFILE: $env:AWS_PROFILE"
Write-Host "ENV: $env:ENV"

terraform apply -auto-approve -var env=dev

Write-Host "`nTerraform apply completed!"
Write-Host "Tables are now fully managed by Terraform."