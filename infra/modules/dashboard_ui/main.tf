resource "aws_s3_bucket" "dashboard_ui" {
  bucket = "dashboard-ui-artifacts"
}

resource "aws_s3_bucket_website_configuration" "dashboard_ui" {
  bucket = aws_s3_bucket.dashboard_ui.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_policy" "dashboard_ui_upload" {
  bucket = aws_s3_bucket.dashboard_ui.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          AWS = "arn:aws:iam::<YOUR_AWS_ACCOUNT_ID>:role/github-actions-oidc-role"
        },
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ],
        Resource = "${aws_s3_bucket.dashboard_ui.arn}/*"
      }
    ]
  })
}
