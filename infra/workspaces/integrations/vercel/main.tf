module "vercel_integration" {
  source = "../../modules/vercel_integration"

  env          = var.env
  project_name = var.project_name
  framework    = var.framework

  vercel_team_id = var.vercel_team_id

  git_repository = var.git_repository

  build_command    = var.build_command
  output_directory = var.output_directory
  install_command  = var.install_command
  root_directory   = var.root_directory

  environment_variables = var.environment_variables
  custom_domains        = var.custom_domains

  enable_deployment_events = var.enable_deployment_events
  enable_webhooks          = var.enable_webhooks
  event_bus_name           = var.event_bus_name
}