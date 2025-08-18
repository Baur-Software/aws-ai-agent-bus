# Optional large workspace - Aurora PostgreSQL with pgvector
# Uncomment to enable vector database capabilities

# data "aws_caller_identity" "current" {}
# data "aws_region" "current" {}

# locals {
#   name = "agent-mesh-${var.env}-vector"
#   tags = {
#     app       = "agent-mesh"
#     workspace = "aurora_pgvector"
#     env       = var.env
#   }
# }

# data "aws_vpc" "default" {
#   default = true
# }

# data "aws_subnets" "private" {
#   filter {
#     name   = "vpc-id"
#     values = [data.aws_vpc.default.id]
#   }
# }

# resource "aws_db_subnet_group" "vector" {
#   name       = local.name
#   subnet_ids = data.aws_subnets.private.ids
#   tags       = local.tags
# }

# resource "aws_security_group" "aurora" {
#   name_prefix = "${local.name}-"
#   vpc_id      = data.aws_vpc.default.id

#   ingress {
#     from_port   = 5432
#     to_port     = 5432
#     protocol    = "tcp"
#     cidr_blocks = [data.aws_vpc.default.cidr_block]
#   }

#   egress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"
#     cidr_blocks = ["0.0.0.0/0"]
#   }

#   tags = local.tags
# }

# resource "aws_rds_cluster" "vector" {
#   cluster_identifier     = local.name
#   engine                 = "aurora-postgresql"
#   engine_version         = "15.4"
#   database_name          = "vectordb"
#   master_username        = "postgres"
#   manage_master_user_password = true
#   
#   db_subnet_group_name   = aws_db_subnet_group.vector.name
#   vpc_security_group_ids = [aws_security_group.aurora.id]
#   
#   serverlessv2_scaling_configuration {
#     max_capacity = var.max_capacity
#     min_capacity = var.min_capacity
#   }
#   
#   skip_final_snapshot = var.env != "prod"
#   tags                = local.tags
# }

# resource "aws_rds_cluster_instance" "vector" {
#   identifier         = "${local.name}-instance"
#   cluster_identifier = aws_rds_cluster.vector.id
#   instance_class     = "db.serverless"
#   engine             = aws_rds_cluster.vector.engine
#   engine_version     = aws_rds_cluster.vector.engine_version
#   
#   tags = local.tags
# }

# Placeholder resource for disabled state
resource "null_resource" "aurora_disabled" {
  provisioner "local-exec" {
    command = "echo 'Aurora pgvector module is disabled. Uncomment resources to enable.'"
  }
}