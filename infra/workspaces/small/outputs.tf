# Dashboard service outputs
output "dashboard_ui_bucket_name" {
  description = "S3 bucket name for dashboard UI artifacts"
  value       = module.dashboard_ui.dashboard_ui_bucket_name
}