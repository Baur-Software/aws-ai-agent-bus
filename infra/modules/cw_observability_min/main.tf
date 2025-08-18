data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}"
  tags = {
    app       = "agent-mesh"
    workspace = "cw_observability_min"
    env       = var.env
  }
}

resource "aws_cloudwatch_log_group" "agents" {
  for_each = toset(var.agent_names)
  
  name              = "/ecs/agent-mesh/${var.env}/${each.key}"
  retention_in_days = 30
  
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "stepfunctions" {
  name              = "/aws/stepfunctions/${local.name}-lanes"
  retention_in_days = 30
  
  tags = local.tags
}

resource "aws_cloudwatch_dashboard" "agents" {
  dashboard_name = "${local.name}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${local.name}-conductor"],
            [".", "MemoryUtilization", ".", "."],
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${local.name}-critic"],
            [".", "MemoryUtilization", ".", "."],
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${local.name}-sweeper"],
            [".", "MemoryUtilization", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Agent Resource Utilization"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/ecs/agent-mesh/${var.env}/conductor' | SOURCE '/ecs/agent-mesh/${var.env}/critic' | SOURCE '/ecs/agent-mesh/${var.env}/sweeper' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = data.aws_region.current.name
          title   = "Recent Agent Logs"
        }
      }
    ]
  })
  
  tags = local.tags
}