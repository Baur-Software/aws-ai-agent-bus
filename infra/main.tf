module "dashboard_service" {
  source                    = "./modules/dashboard_service"
  dashboard_lambda_role_arn = aws_iam_role.dashboard_lambda_role.arn
  // ...other variables...
}
