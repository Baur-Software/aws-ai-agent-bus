data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  tags = {
    app       = "agent-mesh"
    workspace = "dynamodb_agents"
    env       = var.env
  }
}

# Agents table for storing agent metadata
resource "aws_dynamodb_table" "agents" {
  name         = "agent-mesh-${var.env}-agents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "agentId"

  attribute {
    name = "agentId"
    type = "S"
  }

  attribute {
    name = "ownerType"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "name"
    type = "S"
  }

  # Global secondary index for querying by owner (organization or user)
  global_secondary_index {
    name            = "owner-index"
    hash_key        = "ownerType"
    range_key       = "ownerId"
    projection_type = "ALL"
  }

  # Global secondary index for querying by creation time within owner context
  global_secondary_index {
    name            = "owner-created-index"
    hash_key        = "ownerId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global secondary index for searching by name within owner context
  global_secondary_index {
    name            = "owner-name-index"
    hash_key        = "ownerId"
    range_key       = "name"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}

# Agent versions table for storing version history metadata
resource "aws_dynamodb_table" "agent_versions" {
  name         = "agent-mesh-${var.env}-agent-versions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "agentId"
  range_key    = "version"

  attribute {
    name = "agentId"
    type = "S"
  }

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "isActive"
    type = "S"
  }

  # Global secondary index for querying versions by creation time
  global_secondary_index {
    name            = "agent-created-index"
    hash_key        = "agentId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global secondary index for finding active version
  global_secondary_index {
    name            = "agent-active-index"
    hash_key        = "agentId"
    range_key       = "isActive"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}