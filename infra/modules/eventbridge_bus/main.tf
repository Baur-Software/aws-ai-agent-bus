data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}"
  tags = {
    app       = "agent-mesh"
    workspace = "eventbridge_bus"
    env       = var.env
  }
}

resource "aws_cloudwatch_event_bus" "mesh" {
  name = local.name
  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "agent_events" {
  name           = "${local.name}-agent-events"
  event_bus_name = aws_cloudwatch_event_bus.mesh.name

  event_pattern = jsonencode({
    source = ["agent-mesh"]
    detail-type = [
      "Agent Task Started",
      "Agent Task Completed",
      "Agent Task Failed"
    ]
  })

  tags = local.tags
}

resource "aws_cloudwatch_event_bus" "main" {
  name = "main-event-bus"
}