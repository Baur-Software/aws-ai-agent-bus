data "terraform_remote_state" "mesh_agents" {
  backend = "local"
  config = {
    path = "../mesh_agents/terraform.tfstate"
  }
}

data "terraform_remote_state" "event_bus" {
  backend = "local"
  config = {
    path = "../../small/event_bus/terraform.tfstate"
  }
}

data "terraform_remote_state" "timeline_store" {
  backend = "local"
  config = {
    path = "../../small/timeline_store/terraform.tfstate"
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

module "subtasks_queue" {
  source = "../../modules/sqs_subtasks"
  
  env = var.env
}

module "lanes_workflow" {
  source = "../../modules/stepfn_lanes"
  
  env                    = var.env
  conductor_task_arn     = data.terraform_remote_state.mesh_agents.outputs.conductor_task_arn
  critic_task_arn        = data.terraform_remote_state.mesh_agents.outputs.critic_task_arn
  sweeper_task_arn       = data.terraform_remote_state.mesh_agents.outputs.sweeper_task_arn
  task_role_arns         = data.terraform_remote_state.mesh_agents.outputs.task_role_arns
  subtasks_queue_arn     = module.subtasks_queue.queue_arn
  subtasks_queue_url     = module.subtasks_queue.queue_url
  timeline_bucket_arn    = data.terraform_remote_state.timeline_store.outputs.bucket_arn
  timeline_bucket_name   = data.terraform_remote_state.timeline_store.outputs.bucket_name
  event_bus_arn          = data.terraform_remote_state.event_bus.outputs.bus_arn
  event_bus_name         = data.terraform_remote_state.event_bus.outputs.bus_name
  security_group_id      = data.terraform_remote_state.mesh_agents.outputs.security_group_id
  subnets                = data.aws_subnets.default.ids
}