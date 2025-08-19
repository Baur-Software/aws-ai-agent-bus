package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestDynamoDBModule(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../modules/dynamodb_kv",
		Vars: map[string]interface{}{
			"env": "test",
		},
		NoColor: true,
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test outputs
	tableName := terraform.Output(t, terraformOptions, "table_name")
	assert.Contains(t, tableName, "agent-mesh-test-kv")

	tableArn := terraform.Output(t, terraformOptions, "table_arn")
	assert.Contains(t, tableArn, "arn:aws:dynamodb")
}

func TestS3Module(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../modules/s3_bucket_artifacts",
		Vars: map[string]interface{}{
			"env": "test",
		},
		NoColor: true,
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test outputs
	bucketName := terraform.Output(t, terraformOptions, "bucket_name")
	assert.Contains(t, bucketName, "agent-mesh-test-artifacts")

	bucketArn := terraform.Output(t, terraformOptions, "bucket_arn")
	assert.Contains(t, bucketArn, "arn:aws:s3")
}

func TestEventBridgeModule(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../modules/eventbridge_bus",
		Vars: map[string]interface{}{
			"env": "test",
		},
		NoColor: true,
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test outputs
	busName := terraform.Output(t, terraformOptions, "bus_name")
	assert.Contains(t, busName, "agent-mesh-test")

	busArn := terraform.Output(t, terraformOptions, "bus_arn")
	assert.Contains(t, busArn, "arn:aws:events")
}