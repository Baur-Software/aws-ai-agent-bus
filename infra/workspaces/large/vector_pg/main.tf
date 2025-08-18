# Optional large workspace - Vector database with Aurora PostgreSQL + pgvector
# Higher cost, enable only when vector capabilities are needed

module "vector_pg" {
  source = "../../modules/aurora_pgvector"

  env          = var.env
  min_capacity = var.env == "prod" ? 1 : 0.5
  max_capacity = var.env == "prod" ? 8 : 2
}