data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name = "agent-mesh-${var.env}-${var.agent_name}"
  tags = {
    app       = "agent-mesh"
    component = "agent-compute"
    env       = var.env
    agent     = var.agent_name
    lane      = var.lane
  }
}

# Data source to get MCP server infrastructure outputs
data "terraform_remote_state" "mcp_server" {
  count = var.mcp_server_state_path != "" ? 1 : 0
  config = {
    path = var.mcp_server_state_path
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
  # MCP Server infrastructure access
  dynamic "statement" {
    for_each = var.mcp_server_state_path != "" ? [1] : []
    content {
      sid    = "MCPServerAccess"
      effect = "Allow"
      actions = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "events:PutEvents",
        "secretsmanager:GetSecretValue"
      ]
      resources = [
        data.terraform_remote_state.mcp_server[0].outputs.dynamodb_kv_table_arn,
        data.terraform_remote_state.mcp_server[0].outputs.s3_bucket_artifacts,
        "${data.terraform_remote_state.mcp_server[0].outputs.s3_bucket_artifacts}/*",
        data.terraform_remote_state.mcp_server[0].outputs.message_queue_arn,
        data.terraform_remote_state.mcp_server[0].outputs.event_bus_arn,
        "${data.terraform_remote_state.mcp_server[0].outputs.secrets_kms_key_arn}*"
      ]
    }
  }

  # Fallback permissions when MCP server state is not available
  dynamic "statement" {
    for_each = var.mcp_server_state_path == "" ? [1] : []
    content {
      sid    = "BasicAgentAccess"
      effect = "Allow"
      actions = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "sqs:SendMessage",
        "events:PutEvents",
        "secretsmanager:GetSecretValue"
      ]
      resources = ["*"]
    }
  }

  # Lane-specific permissions for execute lane
  dynamic "statement" {
    for_each = var.lane == "execute" ? [1] : []
    content {
      sid    = "ExecuteLaneAccess"
      effect = "Allow"
      actions = [
        "iam:PassRole",
        "ecs:RunTask",
        "lambda:InvokeFunction"
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
          "awslogs-region"        = data.aws_region.current.id
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