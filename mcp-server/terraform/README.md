# MCP Server Infrastructure

This directory contains the Terraform modules and workspaces for the core MCP (Model Context Protocol) server infrastructure.

## Architecture

The MCP server infrastructure provides the foundational AWS services that enable Claude agents to coordinate and share state through standardized interfaces.

### Core Services

- **DynamoDB KV Store**: Key-value storage for agent state, coordination, and temporary data
- **S3 Artifacts**: Object storage for files, documents, and large data artifacts
- **EventBridge Bus**: Event-driven communication channel between agents and services
- **SQS Subtasks**: Message queuing for asynchronous task processing
- **Secrets Manager**: Secure storage for credentials and sensitive configuration

## Directory Structure

```
mcp-server/terraform/
├── modules/                    # Reusable Terraform modules
│   ├── dynamodb_kv/           # Key-value storage
│   ├── s3_bucket_artifacts/   # Artifact storage  
│   ├── eventbridge_bus/       # Event communication
│   ├── sqs_subtasks/         # Message queuing
│   └── secrets_min/          # Secrets management
└── workspaces/
    └── core/                 # Core MCP server deployment
        ├── main.tf           # Module orchestration
        ├── variables.tf      # Input configuration
        ├── outputs.tf        # Infrastructure outputs
        └── providers.tf      # AWS provider config
```

## Quick Start

Deploy the core MCP server infrastructure:

```bash
cd mcp-server/terraform/workspaces/core
terraform init
terraform plan -var="env=dev"
terraform apply -var="env=dev"
```

## Environment Configuration

The infrastructure supports multiple environments:

- **dev**: Development environment with minimal resources
- **staging**: Staging environment for testing
- **prod**: Production environment with enhanced security and monitoring

## Integration with Agent Infrastructure

The MCP server infrastructure outputs are consumed by the agent infrastructure in `/infra/modules/`. This creates a clean separation:

1. **MCP Server** (`mcp-server/terraform/`): Core services for agent coordination
2. **Agent Infrastructure** (`infra/modules/`): Specialized infrastructure for Claude agents

## Usage

### Deploy Core Infrastructure

```bash
# Development environment
terraform apply -var="env=dev" -var="aws_region=us-west-2"

# Production environment  
terraform apply -var="env=prod" -var="aws_region=us-east-1"
```

### Access Outputs

The infrastructure outputs provide connection details for the MCP server:

```bash
# Get all MCP server configuration
terraform output mcp_server_config

# Get specific service details
terraform output kv_store_table_name
terraform output artifacts_bucket_name
terraform output event_bus_name
```

### Environment Variables

Set these environment variables for the MCP server:

```bash
export AGENT_MESH_KV_TABLE=$(terraform output -raw kv_store_table_name)
export AGENT_MESH_ARTIFACTS_BUCKET=$(terraform output -raw artifacts_bucket_name)
export AGENT_MESH_EVENT_BUS=$(terraform output -raw event_bus_name)
export AGENT_MESH_QUEUE_URL=$(terraform output -raw message_queue_url)
```

## Cost Optimization

The core MCP server infrastructure is designed to be cost-effective:

- **DynamoDB**: Pay-per-request billing
- **S3**: Standard storage tier with lifecycle policies
- **EventBridge**: Pay-per-event pricing
- **SQS**: First 1M requests per month free

Estimated monthly cost: **$5-15** for development, **$20-50** for production depending on usage.

## Security

Security features included:

- **Encryption**: All data encrypted at rest and in transit
- **IAM**: Least-privilege access policies
- **VPC**: Optional VPC deployment for network isolation
- **Secrets**: Automatic rotation and encryption for sensitive data

## Monitoring

Basic monitoring is included:

- **CloudWatch**: Metrics and logs for all services
- **Alarms**: Basic alerting for service health
- **Dashboards**: Infrastructure overview (optional)

For advanced monitoring, deploy the observability workspace in the agent infrastructure.