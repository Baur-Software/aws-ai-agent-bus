data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}-subtasks"
  tags = {
    app       = "agent-mesh"
    workspace = "sqs_subtasks"
    env       = var.env
  }
}

resource "aws_sqs_queue" "subtasks_dlq" {
  name                      = "${local.name}-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = local.tags
}

resource "aws_sqs_queue" "subtasks" {
  name                       = local.name
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600 # 14 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.subtasks_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.tags
}

data "aws_iam_policy_document" "sqs_policy" {
  statement {
    sid    = "AllowStepFunctionsAccess"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }

    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueAttributes"
    ]

    resources = [aws_sqs_queue.subtasks.arn]
  }
}

resource "aws_sqs_queue_policy" "subtasks" {
  queue_url = aws_sqs_queue.subtasks.id
  policy    = data.aws_iam_policy_document.sqs_policy.json
}