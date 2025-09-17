@echo off
REM Set your AWS credentials via AWS CLI or environment variables
REM aws configure set aws_access_key_id YOUR_ACCESS_KEY
REM aws configure set aws_secret_access_key YOUR_SECRET_KEY
REM aws configure set region us-west-2
set AWS_REGION=us-west-2
set WS=small/events_monitoring
set ENV=dev

terraform plan