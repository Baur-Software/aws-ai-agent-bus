module "timeline_store" {
  source = "../../../modules/s3_bucket_artifacts"

  env = var.env
}