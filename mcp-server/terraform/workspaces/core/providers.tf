provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "aws-ai-agent-bus"
      Component   = "mcp-server"
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS region for MCP server infrastructure"
  type        = string
  default     = "us-west-2"
}