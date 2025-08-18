#!/bin/bash
set -e

echo "Running terraform fmt check..."
terraform fmt -check -recursive || (echo "Run 'make fmt' to fix formatting" && exit 1)

echo "Running tflint..."
if command -v tflint >/dev/null 2>&1; then
    tflint --recursive --minimum-failure-severity=error
else
    echo "tflint not installed, skipping"
fi

echo "Linting passed!"