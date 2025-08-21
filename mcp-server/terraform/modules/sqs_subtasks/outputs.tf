output "queue_url" {
  description = "SQS queue URL"
  value       = aws_sqs_queue.subtasks.url
}

output "queue_arn" {
  description = "SQS queue ARN"
  value       = aws_sqs_queue.subtasks.arn
}

output "dlq_url" {
  description = "SQS DLQ URL"
  value       = aws_sqs_queue.subtasks_dlq.url
}

output "dlq_arn" {
  description = "SQS DLQ ARN"
  value       = aws_sqs_queue.subtasks_dlq.arn
}