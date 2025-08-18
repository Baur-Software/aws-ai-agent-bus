data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  tags = {
    app       = "agent-mesh"
    workspace = "secrets_min"
    env       = var.env
  }
}

resource "aws_secretsmanager_secret" "secrets" {
  for_each = toset(var.secret_names)
  
  name                    = "agent-mesh/${var.env}/${each.key}"
  description             = "Agent mesh secret: ${each.key}"
  recovery_window_in_days = var.env == "prod" ? 30 : 0
  
  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "secrets" {
  for_each = aws_secretsmanager_secret.secrets
  
  secret_id = each.value.id
  secret_string = jsonencode({
    value = "placeholder-${each.key}-value"
  })
}