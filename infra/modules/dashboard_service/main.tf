resource "aws_lambda_function" "dashboard" {
  function_name = "dashboard-server"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  role          = var.dashboard_lambda_role_arn
  filename      = "lambda.zip"
}
