data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  tags = {
    app       = "agent-mesh"
    workspace = "dynamodb_events"
    env       = var.env
  }
}

# Events table for storing event history
resource "aws_dynamodb_table" "events" {
  name         = "agent-mesh-${var.env}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventId"

  attribute {
    name = "eventId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "source"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  # Global secondary index for querying by timestamp (most recent first)
  global_secondary_index {
    name            = "TimestampIndex"
    hash_key        = "source"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # Global secondary index for querying by user
  global_secondary_index {
    name            = "user-index"
    hash_key        = "userId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}

# Subscriptions table for storing alert subscriptions
resource "aws_dynamodb_table" "subscriptions" {
  name         = "agent-mesh-${var.env}-subscriptions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "subscriptionId"

  attribute {
    name = "subscriptionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  # Global secondary index for querying by user
  global_secondary_index {
    name            = "user-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}

# Event rules table for storing monitoring rules metadata
resource "aws_dynamodb_table" "event_rules" {
  name         = "agent-mesh-${var.env}-event-rules"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ruleId"

  attribute {
    name = "ruleId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  # Global secondary index for querying by user
  global_secondary_index {
    name            = "user-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = false
  }

  tags = local.tags
}