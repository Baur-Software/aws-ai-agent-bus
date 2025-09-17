# PowerShell deployment script for event monitoring infrastructure
$env:AWS_PROFILE = "your-profile"
$env:WS = "small/events_monitoring"
$env:ENV = "dev"
$env:AWS_REGION = "us-west-2"

Write-Host "Setting up Terraform for event monitoring infrastructure..."
Write-Host "AWS_PROFILE: $env:AWS_PROFILE"
Write-Host "WS: $env:WS"
Write-Host "ENV: $env:ENV"
Write-Host "AWS_REGION: $env:AWS_REGION"

Write-Host "`nRunning terraform plan..."
terraform plan -var env=dev

Write-Host "`nDeployment script completed. Review the plan above."
Write-Host "To apply changes, run: terraform apply -var env=dev"

Write-Host "`nFor future deployments, use:"
Write-Host "  terraform plan -var env=dev"
Write-Host "  terraform apply -var env=dev"
Write-Host "  terraform destroy -var env=dev"