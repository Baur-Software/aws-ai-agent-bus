data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  tags = {
    app       = "agent-mesh"
    workspace = "dynamodb_mcp_registry"
    env       = var.env
  }
}

# MCP servers registry for discovery and capabilities
resource "aws_dynamodb_table" "mcp_servers" {
  name         = "agent-mesh-${var.env}-mcp-servers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "serverId"
  range_key    = "version"

  attribute {
    name = "serverId"
    type = "S"
  }

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  attribute {
    name = "isLatest"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # Global secondary index for querying by category
  global_secondary_index {
    name            = "category-index"
    hash_key        = "category"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global secondary index for finding latest versions
  global_secondary_index {
    name            = "latest-version-index"
    hash_key        = "serverId"
    range_key       = "isLatest"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}

# User/org connected MCP servers for tenant context
resource "aws_dynamodb_table" "mcp_connections" {
  name         = "agent-mesh-${var.env}-mcp-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
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
    name = "serverId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  # Global secondary index for querying by owner (user/org)
  global_secondary_index {
    name            = "owner-index"
    hash_key        = "ownerType"
    range_key       = "ownerId"
    projection_type = "ALL"
  }

  # Global secondary index for querying by server
  global_secondary_index {
    name            = "server-index"
    hash_key        = "serverId"
    range_key       = "status"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}

# Published workflows registry
resource "aws_dynamodb_table" "published_workflows" {
  name         = "agent-mesh-${var.env}-published-workflows"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "workflowId"
  range_key    = "version"

  attribute {
    name = "workflowId"
    type = "S"
  }

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  attribute {
    name = "publisherId"
    type = "S"
  }

  attribute {
    name = "isPublic"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # Global secondary index for browsing by category
  global_secondary_index {
    name            = "category-index"
    hash_key        = "category"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global secondary index for publisher workflows
  global_secondary_index {
    name            = "publisher-index"
    hash_key        = "publisherId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Global secondary index for public workflows
  global_secondary_index {
    name            = "public-index"
    hash_key        = "isPublic"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}