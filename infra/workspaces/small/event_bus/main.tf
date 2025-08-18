module "event_bus" {
  source = "../../../modules/eventbridge_bus"

  env = var.env
}