data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}-lanes"
  tags = {
    app       = "agent-mesh"
    workspace = "stepfn_lanes"
    env       = var.env
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
    sid    = "PassRole"
    effect = "Allow"
    actions = ["iam:PassRole"]
    resources = var.task_role_arns
  }

  statement {
    sid    = "SQSAccess"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [var.subtasks_queue_arn]
  }

  statement {
    sid    = "S3TimelineWrite"
    effect = "Allow"
    actions = [
      "s3:PutObject"
    ]
    resources = ["${var.timeline_bucket_arn}/*"]
  }

  statement {
    sid    = "EventBridgePublish"
    effect = "Allow"
    actions = [
      "events:PutEvents"
    ]
    resources = [var.event_bus_arn]
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

resource "aws_sfn_state_machine" "lanes" {
  name     = local.name
  role_arn = aws_iam_role.stepfn_role.arn

  definition = templatefile("${path.module}/state_machine.json", {
    conductor_task_arn = var.conductor_task_arn
    critic_task_arn    = var.critic_task_arn
    sweeper_task_arn   = var.sweeper_task_arn
    subtasks_queue_url = var.subtasks_queue_url
    timeline_bucket    = var.timeline_bucket_name
    event_bus_name     = var.event_bus_name
    security_group_id  = var.security_group_id
    subnets            = jsonencode(var.subnets)
  })

  tags = local.tags
}