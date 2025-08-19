module "supabase_integration" {
  source = "../../modules/supabase_integration"

  env               = var.env
  project_name      = var.project_name
  organization_id   = var.organization_id
  database_password = var.database_password
  region            = var.supabase_region
  plan              = var.plan

  # API Settings
  db_schema            = var.db_schema
  db_extra_search_path = var.db_extra_search_path
  max_rows             = var.max_rows

  # Auth Settings
  site_url                   = var.site_url
  uri_allow_list             = var.uri_allow_list
  jwt_expiry                 = var.jwt_expiry
  disable_signup             = var.disable_signup
  enable_signup              = var.enable_signup
  enable_confirmations       = var.enable_confirmations
  enable_email_confirmations = var.enable_email_confirmations
  enable_phone_confirmations = var.enable_phone_confirmations

  # Integration Settings
  enable_database_events = var.enable_database_events
  enable_webhooks        = var.enable_webhooks
  event_bus_name         = var.event_bus_name
}