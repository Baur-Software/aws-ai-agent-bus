data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Get default VPC if not specified
data "aws_vpc" "default" {
  count   = var.vpc_id == "" ? 1 : 0
  default = true
}

# Get default subnets if not specified
data "aws_subnets" "default" {
  count = length(var.subnet_ids) == 0 ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

locals {
  name       = "agent-mesh-${var.env}-${var.service_name}"
  vpc_id     = var.vpc_id != "" ? var.vpc_id : data.aws_vpc.default[0].id
  subnet_ids = length(var.subnet_ids) > 0 ? var.subnet_ids : data.aws_subnets.default[0].ids

  # Cost estimation (Fargate pricing US East)
  cpu_cost_per_hour    = (var.cpu_units / 1024) * 0.04048  # $0.04048 per vCPU hour
  memory_cost_per_hour = (var.memory_mb / 1024) * 0.004445 # $0.004445 per GB hour
  spot_discount        = var.enable_spot ? 0.3 : 1.0       # 70% savings with Spot
  base_hourly_cost     = (local.cpu_cost_per_hour + local.memory_cost_per_hour) * local.spot_discount
  estimated_cost       = format("$%.2f", local.base_hourly_cost * 24 * 30) # Monthly estimate

  tags = {
    app       = "agent-mesh"
    component = "dashboard-service"
    env       = var.env
    workspace = "ecs_dashboard_service"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "disabled" # Disabled for cost optimization
  }

  tags = local.tags
}

# ECS Cluster Capacity Providers (Fargate + Spot)
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = var.enable_spot ? ["FARGATE", "FARGATE_SPOT"] : ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = var.enable_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }
}

# IAM Role for Task Execution
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

# IAM Role for Task (Runtime permissions)
resource "aws_iam_role" "task_role" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json
  tags               = local.tags
}

# Task role policy - dashboard server + embedded MCP server permissions
data "aws_iam_policy_document" "task_role_policy" {
  # DynamoDB KV access
  statement {
    sid    = "DynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [var.kv_table_arn]
  }

  # EventBridge access
  statement {
    sid    = "EventBridgeAccess"
    effect = "Allow"
    actions = [
      "events:PutEvents"
    ]
    resources = [var.event_bus_arn]
  }

  # Bedrock Runtime access for AI chat
  statement {
    sid    = "BedrockRuntimeAccess"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:foundation-model/anthropic.claude-*"
    ]
  }

  # Secrets Manager access
  statement {
    sid    = "SecretsManagerAccess"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue"
    ]
    resources = [var.secrets_arn]
  }

  # CloudWatch Logs (minimal for cost control)
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task_role_policy" {
  name   = "${local.name}-task-policy"
  role   = aws_iam_role.task_role.id
  policy = data.aws_iam_policy_document.task_role_policy.json
}

# Security Group
resource "aws_security_group" "dashboard" {
  name_prefix = "${local.name}-"
  vpc_id      = local.vpc_id

  # When ALB is used, only allow traffic from ALB security group
  # When no ALB, use explicitly configured CIDR blocks (empty by default for security)
  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    cidr_blocks     = var.create_alb ? [] : var.allowed_cidr_blocks
    security_groups = var.create_alb ? [aws_security_group.alb[0].id] : []
    description     = var.create_alb ? "Allow traffic from ALB only" : "Allow traffic from configured CIDR blocks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.tags, {
    Name = "${local.name}-sg"
  })

  lifecycle {
    # Prevent accidental exposure - validate CIDR blocks are not 0.0.0.0/0 in production
    precondition {
      condition     = var.env != "prod" || var.create_alb || !contains(var.allowed_cidr_blocks, "0.0.0.0/0")
      error_message = "Production environments must use ALB or restrict allowed_cidr_blocks (0.0.0.0/0 not allowed)."
    }
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "dashboard" {
  name              = "/ecs/${local.name}"
  retention_in_days = 7 # Short retention for cost optimization

  tags = local.tags
}

# ECS Task Definition
resource "aws_ecs_task_definition" "dashboard" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu_units
  memory                   = var.memory_mb
  execution_role_arn       = aws_iam_role.task_execution_role.arn
  task_role_arn            = aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name  = "dashboard-server"
      image = var.container_image

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.dashboard.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      environment = [
        {
          name  = "NODE_ENV"
          value = var.env
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        },
        {
          name  = "AGENT_MESH_KV_TABLE"
          value = var.kv_table_name
        },
        {
          name  = "AGENT_MESH_EVENT_BUS"
          value = var.event_bus_name
        },
        {
          name  = "AWS_REGION"
          value = data.aws_region.current.name
        },
        {
          name  = "MCP_SERVER_BINARY"
          value = "/app/bin/mcp-server" # Path to embedded Rust binary
        }
      ]

      # Health check
      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:${var.container_port}/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
    }
  ])

  tags = local.tags
}

# ECS Service
resource "aws_ecs_service" "dashboard" {
  name            = local.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.dashboard.arn
  desired_count   = var.desired_count
  launch_type     = var.enable_spot ? null : "FARGATE"

  # Use capacity provider strategy for Spot instances
  dynamic "capacity_provider_strategy" {
    for_each = var.enable_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 1
    }
  }

  network_configuration {
    subnets          = local.subnet_ids
    security_groups  = [aws_security_group.dashboard.id]
    assign_public_ip = true # Needed for internet access to pull container images
  }

  # Load balancer configuration (if ALB is created)
  dynamic "load_balancer" {
    for_each = var.create_alb ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.main[0].arn
      container_name   = "dashboard-server"
      container_port   = var.container_port
    }
  }

  # Ignore desired_count changes for autoscaling
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_iam_role_policy.task_role_policy]

  tags = local.tags
}

# Application Load Balancer (optional, for external access)
resource "aws_security_group" "alb" {
  count       = var.create_alb ? 1 : 0
  name_prefix = "${local.name}-alb-"
  vpc_id      = local.vpc_id

  # HTTP ingress (for redirect to HTTPS or non-TLS environments)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP traffic (redirects to HTTPS when certificate configured)"
  }

  # HTTPS ingress (when certificate is configured)
  dynamic "ingress" {
    for_each = var.certificate_arn != "" ? [1] : []
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "Allow HTTPS traffic"
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.tags, {
    Name = "${local.name}-alb-sg"
  })
}

resource "aws_lb" "main" {
  count              = var.create_alb ? 1 : 0
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = local.subnet_ids

  enable_deletion_protection = false

  tags = local.tags
}

resource "aws_lb_target_group" "main" {
  count       = var.create_alb ? 1 : 0
  name        = "${local.name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }

  tags = local.tags
}

# HTTP Listener - redirects to HTTPS when certificate is configured
resource "aws_lb_listener" "http" {
  count             = var.create_alb ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"

  # Redirect to HTTPS when certificate is provided and https_only is enabled
  dynamic "default_action" {
    for_each = var.certificate_arn != "" && var.enable_https_only ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  # Forward to target group when no certificate or https_only disabled
  dynamic "default_action" {
    for_each = var.certificate_arn == "" || !var.enable_https_only ? [1] : []
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.main[0].arn
    }
  }
}

# HTTPS Listener - only created when ACM certificate is provided
resource "aws_lb_listener" "https" {
  count             = var.create_alb && var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main[0].arn
  }
}