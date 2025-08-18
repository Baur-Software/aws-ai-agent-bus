module "kv_store" {
  source = "../../../modules/dynamodb_kv"

  env = var.env
}