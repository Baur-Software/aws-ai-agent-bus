# MCP Rust Server Deployment Guide

Production deployment guide for the MCP Rust server.

## Prerequisites

### System Requirements

- **Rust**: 1.70+ (for building)
- **AWS Account**: With appropriate IAM permissions
- **AWS CLI**: Configured with credentials

### AWS Resources Required

| Resource | Purpose | Required |
|----------|---------|----------|
| DynamoDB Table | Key-value storage | Yes |
| S3 Bucket | Artifact storage | Yes |
| EventBridge Bus | Event publishing | Yes |
| Secrets Manager | Credential storage | Yes (for integrations) |

## Building for Production

### From Source

```bash
cd mcp-rust

# Release build with optimizations
cargo build --release

# Binary location
ls -la target/release/mcp-multi-tenant
```

### Install Globally

```bash
cargo install --path .

# Verify installation
which use_aws_mcp
use_aws_mcp --version
```

### Cross-Compilation

For deploying to different platforms:

```bash
# For Linux (from macOS)
rustup target add x86_64-unknown-linux-gnu
cargo build --release --target x86_64-unknown-linux-gnu

# For ARM64 (AWS Graviton)
rustup target add aarch64-unknown-linux-gnu
cargo build --release --target aarch64-unknown-linux-gnu
```

## Environment Configuration

### Required Environment Variables

```bash
# AWS Configuration
export AWS_REGION=us-west-2
export AWS_ACCESS_KEY_ID=AKIA...        # Or use IAM roles
export AWS_SECRET_ACCESS_KEY=...         # Or use IAM roles

# Resource Names
export AGENT_MESH_KV_TABLE=agent-mesh-kv
export AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts
export AGENT_MESH_EVENT_BUS=agent-mesh-events

# Event System Tables (optional)
export AGENT_MESH_EVENTS_TABLE=agent-mesh-dev-events
export AGENT_MESH_EVENT_RULES_TABLE=agent-mesh-dev-event-rules
export AGENT_MESH_SUBSCRIPTIONS_TABLE=agent-mesh-dev-subscriptions
```

### Optional Environment Variables

```bash
# Logging
export RUST_LOG=info                     # Log level: trace, debug, info, warn, error
export LOG_LEVEL=info                    # Alternative log level

# Development Mode (DO NOT USE IN PRODUCTION)
export DEV_MODE=true                     # Creates demo tenant
export DEFAULT_TENANT_ID=demo-tenant     # Default tenant for requests without tenant_id
export DEFAULT_USER_ID=demo-user         # Default user for requests without user_id
```

## AWS Infrastructure Setup

### IAM Policy

Minimum required IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/agent-mesh-*",
        "arn:aws:dynamodb:*:*:table/agent-mesh-*/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::agent-mesh-artifacts",
        "arn:aws:s3:::agent-mesh-artifacts/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:PutEvents"
      ],
      "Resource": [
        "arn:aws:events:*:*:event-bus/agent-mesh-events"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:DeleteSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:mcp-credentials/*"
      ]
    }
  ]
}
```

### DynamoDB Table Configuration

**KV Store Table:**
```bash
aws dynamodb create-table \
  --table-name agent-mesh-kv \
  --attribute-definitions AttributeName=key,AttributeType=S \
  --key-schema AttributeName=key,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-west-2
```

**Events Table (with GSIs):**
```bash
aws dynamodb create-table \
  --table-name agent-mesh-dev-events \
  --attribute-definitions \
    AttributeName=eventId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=source,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema AttributeName=eventId,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "user-index",
        "KeySchema": [
          {"AttributeName": "userId", "KeyType": "HASH"},
          {"AttributeName": "timestamp", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      },
      {
        "IndexName": "timestamp-index",
        "KeySchema": [
          {"AttributeName": "source", "KeyType": "HASH"},
          {"AttributeName": "timestamp", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region us-west-2
```

### S3 Bucket Configuration

```bash
aws s3 mb s3://agent-mesh-artifacts --region us-west-2

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket agent-mesh-artifacts \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket agent-mesh-artifacts \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### EventBridge Bus Configuration

```bash
aws events create-event-bus \
  --name agent-mesh-events \
  --region us-west-2
```

## Deployment Options

### Option 1: Standalone Process

Run as a standalone stdio server:

```bash
# Start server
AWS_REGION=us-west-2 \
AGENT_MESH_KV_TABLE=agent-mesh-kv \
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts \
AGENT_MESH_EVENT_BUS=agent-mesh-events \
./target/release/mcp-multi-tenant
```

### Option 2: Claude Desktop Integration

Add to `~/.config/claude-desktop/settings.json`:

```json
{
  "mcpServers": {
    "agent-mesh": {
      "command": "/path/to/mcp-multi-tenant",
      "env": {
        "AWS_REGION": "us-west-2",
        "AGENT_MESH_KV_TABLE": "agent-mesh-kv",
        "AGENT_MESH_ARTIFACTS_BUCKET": "agent-mesh-artifacts",
        "AGENT_MESH_EVENT_BUS": "agent-mesh-events",
        "DEFAULT_TENANT_ID": "your-tenant-id",
        "DEFAULT_USER_ID": "your-user-id"
      }
    }
  }
}
```

### Option 3: Docker Container

**Dockerfile:**
```dockerfile
FROM rust:1.75-slim as builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/mcp-multi-tenant /usr/local/bin/

ENV RUST_LOG=info

ENTRYPOINT ["mcp-multi-tenant"]
```

**Build and run:**
```bash
docker build -t mcp-rust:latest .

docker run -it --rm \
  -e AWS_REGION=us-west-2 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AGENT_MESH_KV_TABLE=agent-mesh-kv \
  -e AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts \
  -e AGENT_MESH_EVENT_BUS=agent-mesh-events \
  mcp-rust:latest
```

### Option 4: ECS Fargate

**Task Definition:**
```json
{
  "family": "mcp-rust",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/mcpRustTaskRole",
  "containerDefinitions": [
    {
      "name": "mcp-rust",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/mcp-rust:latest",
      "essential": true,
      "environment": [
        {"name": "AWS_REGION", "value": "us-west-2"},
        {"name": "AGENT_MESH_KV_TABLE", "value": "agent-mesh-kv"},
        {"name": "AGENT_MESH_ARTIFACTS_BUCKET", "value": "agent-mesh-artifacts"},
        {"name": "AGENT_MESH_EVENT_BUS", "value": "agent-mesh-events"},
        {"name": "RUST_LOG", "value": "info"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mcp-rust",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "mcp"
        }
      }
    }
  ]
}
```

### Option 5: AWS Lambda (via Lambda Web Adapter)

For serverless deployment using AWS Lambda Web Adapter:

```yaml
# serverless.yml
service: mcp-rust

provider:
  name: aws
  runtime: provided.al2
  architecture: arm64
  region: us-west-2
  environment:
    AWS_REGION: us-west-2
    AGENT_MESH_KV_TABLE: agent-mesh-kv
    AGENT_MESH_ARTIFACTS_BUCKET: agent-mesh-artifacts
    AGENT_MESH_EVENT_BUS: agent-mesh-events

functions:
  mcp:
    handler: bootstrap
    timeout: 30
    memorySize: 256
    layers:
      - arn:aws:lambda:us-west-2:753240598075:layer:LambdaAdapterLayerArm64:17
    events:
      - http:
          path: /mcp
          method: POST
```

## Monitoring and Observability

### CloudWatch Logs

The server logs to stderr. Configure log aggregation:

```bash
# View logs (if using systemd)
journalctl -u mcp-rust -f

# Or if running in Docker
docker logs -f mcp-rust-container
```

### CloudWatch Metrics

Create custom metrics dashboard for:

- Request count per tenant
- Error rates by type
- AWS service latency
- Rate limit rejections

### Health Monitoring

Use the `events_health_check` tool periodically:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "events_health_check",
    "arguments": {}
  }
}
```

## Security Checklist

### Production Requirements

- [ ] **Disable DEV_MODE**: Ensure `DEV_MODE` is NOT set
- [ ] **Remove default credentials**: No `DEFAULT_TENANT_ID` or `DEFAULT_USER_ID`
- [ ] **Use IAM roles**: Avoid hardcoded AWS credentials
- [ ] **Enable encryption**: S3 bucket encryption, DynamoDB encryption at rest
- [ ] **VPC deployment**: Run in private subnets when possible
- [ ] **Secrets rotation**: Enable automatic rotation for Secrets Manager
- [ ] **Audit logging**: Enable CloudTrail for AWS API calls

### Network Security

```bash
# If running in VPC, ensure these endpoints are accessible:
# - dynamodb.us-west-2.amazonaws.com
# - s3.us-west-2.amazonaws.com
# - events.us-west-2.amazonaws.com
# - secretsmanager.us-west-2.amazonaws.com
```

### Rate Limiting Configuration

Adjust rate limits for production workloads:

```rust
// In rate_limiting.rs, modify AwsServiceLimits::default()
impl Default for AwsServiceLimits {
    fn default() -> Self {
        Self {
            dynamodb_read_units: 5000,    // Increase for production
            dynamodb_write_units: 5000,
            dynamodb_queries_per_sec: 500,
            s3_get_requests_per_sec: 2000,
            s3_put_requests_per_sec: 1000,
            s3_list_requests_per_sec: 50,
            eventbridge_put_events_per_sec: 5000,
            eventbridge_events_batch_size: 10,
            secrets_manager_requests_per_sec: 1000,
            aws_api_calls_per_sec: 500,
            aws_burst_capacity: 5000,
        }
    }
}
```

## Troubleshooting

### Common Issues

**Issue: "Tenant not found" errors**
- Ensure `DEFAULT_TENANT_ID` is set for development
- In production, verify tenant authentication flow

**Issue: AWS credential errors**
- Verify IAM role/policy attachments
- Check AWS region configuration
- Ensure credentials are not expired

**Issue: Rate limit exceeded**
- Check CloudWatch for request patterns
- Adjust `AwsServiceLimits` configuration
- Consider implementing request queuing

**Issue: High latency**
- Enable AWS SDK retries with exponential backoff
- Check DynamoDB capacity mode (use On-Demand for variable workloads)
- Consider regional replication for global deployments

### Debug Mode

Enable verbose logging:

```bash
RUST_LOG=debug ./mcp-multi-tenant 2>debug.log
```

### Performance Tuning

```bash
# Increase Tokio worker threads
TOKIO_WORKER_THREADS=8 ./mcp-multi-tenant

# Profile with flamegraph
cargo install flamegraph
cargo flamegraph --bin mcp-multi-tenant
```

## Backup and Recovery

### DynamoDB Backup

```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name agent-mesh-kv \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Create on-demand backup
aws dynamodb create-backup \
  --table-name agent-mesh-kv \
  --backup-name agent-mesh-kv-$(date +%Y%m%d)
```

### S3 Backup

```bash
# Enable versioning (already shown above)
# Consider cross-region replication for DR
aws s3api put-bucket-replication \
  --bucket agent-mesh-artifacts \
  --replication-configuration file://replication.json
```

## Scaling Considerations

### Horizontal Scaling

The MCP server is designed for horizontal scaling:

- Each instance is stateless (all state in AWS services)
- No inter-instance coordination required
- Use a load balancer for HTTP/WebSocket modes

### Vertical Scaling

For single-instance deployments:

| Workload | CPU | Memory | Notes |
|----------|-----|--------|-------|
| Light (< 100 req/min) | 0.25 vCPU | 512 MB | Development |
| Medium (< 1000 req/min) | 1 vCPU | 1 GB | Small team |
| Heavy (< 10000 req/min) | 2 vCPU | 2 GB | Production |
| Enterprise | 4+ vCPU | 4+ GB | High throughput |
