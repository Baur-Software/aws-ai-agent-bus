data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}-${var.agent_name}"
  tags = {
    app       = "agent-mesh"
    workspace = "ecs_task_agent"
    env       = var.env
    agent     = var.agent_name
    lane      = var.lane
  }
}

data "aws_iam_policy_document" "task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution_role" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_role" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_role_policy" {
  # Read-only permissions
  statement {
    sid    = "ReadOnlyAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "secretsmanager:GetSecretValue",
      "events:PutEvents"
    ]
    resources = ["*"]
  }

  # Lane-specific permissions
  dynamic "statement" {
    for_each = var.lane == "execute" ? [1] : []
    content {
      sid    = "ExecuteLaneAccess"
      effect = "Allow"
      actions = [
        "s3:PutObject",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ]
      resources = ["*"]
    }
  }
}

resource "aws_iam_role" "task_role" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "task_role_policy" {
  name   = "${local.name}-task-policy"
  role   = aws_iam_role.task_role.id
  policy = data.aws_iam_policy_document.task_role_policy.json
}

resource "aws_security_group" "task" {
  name_prefix = "${local.name}-"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_ecs_task_definition" "agent" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution_role.arn
  task_role_arn            = aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name  = var.agent_name
      image = var.container_image

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/agent-mesh/${var.env}/${var.agent_name}"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      environment = [
        {
          name  = "AGENT_NAME"
          value = var.agent_name
        },
        {
          name  = "LANE"
          value = var.lane
        },
        {
          name  = "ENV"
          value = var.env
        }
      ]
    }
  ])

  tags = local.tags
}