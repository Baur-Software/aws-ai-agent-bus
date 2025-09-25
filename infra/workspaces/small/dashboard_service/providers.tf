provider "aws" {
  region = "us-west-2" # Default region, can be overridden

  default_tags {
    tags = {
      workspace   = "small"
      component   = "dashboard_service"
      managed_by  = "terraform"
      cost_center = "agent-mesh"
    }
  }
}