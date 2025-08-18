# Agent Mesh Cloud Backing

Production-grade agent mesh with modular cloud infrastructure using small/medium/large workspaces.

## Architecture

- **Small workspaces**: Fine-grained, cheap, safe to iterate (DynamoDB, S3, EventBridge)
- **Medium workspaces**: Domain stacks composing small workspaces (ECS agents, Step Functions)  
- **Large workspaces**: Optional, costlier components (Aurora pgvector, analytics)

## Lanes

- `read_only`: Denies mutating APIs, allows queries
- `dry_run`: Allows planning, staging writes
- `execute`: Minimal prod writes with approval gates

## Quick Start

```bash
# Deploy small workspace
make init WS=small/kv_store ENV=dev
make apply WS=small/kv_store ENV=dev

# Deploy artifacts bucket
make apply WS=small/artifacts_bucket ENV=dev

# Deploy medium workflow (composes small workspaces)
make apply WS=medium/workflow ENV=dev
```

## Workspaces

### Small
- `kv_store`: DynamoDB table with TTL
- `artifacts_bucket`: Versioned S3 bucket with encryption
- `timeline_store`: S3 bucket for timeline events
- `secrets`: Secrets Manager entries
- `event_bus`: EventBridge bus and rules

### Medium  
- `mesh_agents`: ECS task definitions (conductor/critic/sweeper)
- `workflow`: Step Functions lanes with SQS queues
- `observability`: CloudWatch logs and dashboards

### Large (Optional)
- `vector_pg`: Aurora PostgreSQL with pgvector
- `timeline_analytics`: Firehose to S3 Parquet with Athena
- `edge_artifacts`: CloudFront with private OAI