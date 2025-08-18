module "conductor_agent" {
  source = "../../modules/ecs_task_agent"
  
  env        = var.env
  agent_name = "conductor"
  lane       = "read_only"
}

module "critic_agent" {
  source = "../../modules/ecs_task_agent"
  
  env        = var.env
  agent_name = "critic"
  lane       = "dry_run"
}

module "sweeper_agent" {
  source = "../../modules/ecs_task_agent"
  
  env        = var.env
  agent_name = "sweeper"
  lane       = "read_only"
}