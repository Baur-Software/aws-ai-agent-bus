module "events_monitoring" {
  source = "../../../modules/dynamodb_events"

  env = var.env
}