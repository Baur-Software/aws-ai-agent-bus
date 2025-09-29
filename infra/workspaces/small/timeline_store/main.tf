module "timeline_store" {
  source = "../../../modules/timestream"

  env            = var.env
  database_name  = "${var.env}-timeline-store"
  table_name     = "${var.env}-timeline-table"
  retention_days = 365
}