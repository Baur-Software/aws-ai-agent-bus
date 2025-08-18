module "observability" {
  source = "../../modules/cw_observability_min"
  
  env         = var.env
  agent_names = ["conductor", "critic", "sweeper"]
}