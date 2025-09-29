# Agent Orchestration Module
# Manages Step Functions workflow for coordinating Claude agents (conductor, critic, sweeper)

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}-orchestration"
  tags = {
    app       = "agent-mesh"
    component = "agent-orchestration"
    env       = var.env
  }
}

# Data source to get MCP server infrastructure outputs
data "terraform_remote_state" "mcp_server" {
  config = {
    path = var.mcp_server_state_path
  }
}

# Data source to get timeline store outputs
data "terraform_remote_state" "timeline_store" {
  config = {
    path = var.timeline_store_state_path
  }
}

# Data source to get workflow outputs
data "terraform_remote_state" "workflow" {
  config = {
    path = var.workflow_state_path
  }
}

data "aws_iam_policy_document" "stepfn_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "stepfn_policy" {
  statement {
    sid    = "ECSTaskAccess"
    effect = "Allow"
    actions = [
      "ecs:RunTask",
      "ecs:StopTask",
      "ecs:DescribeTasks"
    ]
    resources = ["*"]
  }

  statement {
    sid       = "PassRole"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = var.agent_task_role_arns
  }

  statement {
    sid    = "MCPServerAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "s3:GetObject",
      "s3:PutObject",
      "sqs:SendMessage",
      "sqs:GetQueueAttributes",
      "events:PutEvents"
    ]
    resources = [
      data.terraform_remote_state.mcp_server.outputs.dynamodb_kv_table_arn,
      data.terraform_remote_state.mcp_server.outputs.artifacts_bucket_arn,
      "${data.terraform_remote_state.mcp_server.outputs.artifacts_bucket_arn}/*",
      data.terraform_remote_state.timeline_store.outputs.bucket_arn,
      "${data.terraform_remote_state.timeline_store.outputs.bucket_arn}/*",
      data.terraform_remote_state.mcp_server.outputs.message_queue_arn,
      data.terraform_remote_state.mcp_server.outputs.event_bus_arn
    ]
  }
}

resource "aws_iam_role" "stepfn_role" {
  name               = "${local.name}-role"
  assume_role_policy = data.aws_iam_policy_document.stepfn_assume_role.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "stepfn_policy" {
  name   = "${local.name}-policy"
  role   = aws_iam_role.stepfn_role.id
  policy = data.aws_iam_policy_document.stepfn_policy.json
}

resource "aws_sfn_state_machine" "agent_orchestration" {
  name     = local.name
  role_arn = aws_iam_role.stepfn_role.arn

  definition = templatefile("${path.module}/state_machine.json", {
    conductor_task_arn = var.conductor_task_arn
    critic_task_arn    = var.critic_task_arn
    sweeper_task_arn   = var.sweeper_task_arn
    kv_table_name      = data.terraform_remote_state.mcp_server.outputs.dynamodb_kv_table_name
    artifacts_bucket   = data.terraform_remote_state.mcp_server.outputs.s3_bucket_artifacts
    timeline_bucket    = data.terraform_remote_state.timeline_store.outputs.bucket_name
    subtasks_queue_url = data.terraform_remote_state.workflow.outputs.subtasks_queue_url
    event_bus_name     = data.terraform_remote_state.mcp_server.outputs.event_bus_name
    message_queue_url  = data.terraform_remote_state.mcp_server.outputs.message_queue_url
    security_group_id  = var.security_group_id
    subnets            = jsonencode(var.subnets)
  })

  tags = local.tags
}