module "artifacts_bucket" {
  source = "../../../modules/s3_bucket_artifacts"
  
  env = var.env
}