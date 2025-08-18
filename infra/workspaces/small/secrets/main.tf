module "secrets" {
  source = "../../../modules/secrets_min"
  
  env          = var.env
  secret_names = ["api-key", "webhook-secret", "claude-api-key"]
}