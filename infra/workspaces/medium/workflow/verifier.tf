# Execute lane verifier - ensures approval is required for production execute operations
resource "null_resource" "execute_lane_verifier" {
  count = var.env == "prod" ? 1 : 0
  
  triggers = {
    approval_arn = var.approval_change_arn
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      if [[ "${var.approval_change_arn}" == *"dummy"* ]]; then
        echo "ERROR: Production environment requires valid approval_change_arn, not dummy value"
        exit 1
      fi
    EOT
  }
}