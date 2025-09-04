# Claude Agent Infrastructure

This directory contains Terraform modules and workspaces for deploying and managing Claude agents that work with the AWS AI Agent Bus.

## Architecture Overview

The Claude agent infrastructure is designed to work with the MCP (Model Context Protocol) server infrastructure to create a complete AI agent mesh system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Agent Infrastructure                   │
├─────────────────────────────────────────────────────────────────┤
│  Agent Orchestration  │  Agent Compute  │  Agent ML Features    │
│  (Step Functions)     │  (ECS Tasks)    │  (Aurora pgvector)    │
├─────────────────────────────────────────────────────────────────┤
│                    MCP Server Infrastructure                     │
│  KV Store  │  Artifacts  │  Events  │  Messaging  │  Secrets   │
│ (DynamoDB) │    (S3)     │(EventBridge)│  (SQS)    │(Secrets Mgr)│
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
infra/
├── modules/                       # Reusable Terraform modules
│   ├── agent_orchestration/       # Step Functions for agent coordination
│   ├── agent_compute/            # ECS tasks for agent execution
│   ├── agent_ml_features/        # Aurora pgvector for ML capabilities
│   ├── agent_integrations/       # Third-party service integrations
│   ├── cw_observability_min/     # CloudWatch monitoring
│   └── [legacy modules]/         # Original modules (being phased out)
└── workspaces/                   # Deployment configurations
    ├── small/                    # Basic agent deployment (~$30-100/month)
    ├── medium/                   # Full agent mesh (~$100-500/month)
    ├── large/                    # ML-enhanced agents (~$500-1000+/month)
    └── integrations/             # Third-party integrations
```

## Key Modules

### Agent Orchestration (`agent_orchestration/`)
Manages Step Functions workflows that coordinate Claude agents:
- **Conductor Agent**: Plans and coordinates multi-step tasks
- **Critic Agent**: Reviews and validates agent outputs
- **Sweeper Agent**: Cleans up resources and maintains system health

### Agent Compute (`agent_compute/`)
Provides ECS Fargate tasks for running Claude agents:
- Secure container execution with least-privilege IAM
- Automatic scaling based on workload
- Integration with MCP server infrastructure
- Support for different "lanes" (read-only, dry-run, execute)

### Agent ML Features (`agent_ml_features/`)
Optional Aurora PostgreSQL with pgvector for ML capabilities:
- Vector similarity search
- Embedding storage and retrieval
- Semantic search across agent artifacts
- ML model metadata storage

### Agent Integrations (`agent_integrations/`)
Third-party service integrations:
- **Stripe**: Payment processing workflows
- **Supabase**: Database and auth integration
- **Vercel**: Deployment pipeline integration

## Deployment Sizes

Choose your deployment size based on requirements:

### Small Workspace (~$30-100/month)
- Basic agent compute (3 agents: conductor, critic, sweeper)
- Simple orchestration workflows
- CloudWatch monitoring
- Perfect for development and small teams

### Medium Workspace (~$100-500/month) 
- Full agent orchestration with Step Functions
- Enhanced monitoring and alerting
- Multiple agent lanes (read-only, dry-run, execute)
- Suitable for production workloads

### Large Workspace (~$500-1000+/month)
- All medium features plus ML capabilities
- Aurora pgvector for semantic search
- Advanced analytics and reporting
- High-performance agent execution
- Enterprise-grade monitoring

## Quick Start

### Prerequisites
1. Deploy MCP server infrastructure first:
   ```bash
   cd ../mcp-server/terraform/workspaces/core
   terraform init && terraform apply
   ```

2. Get MCP server outputs:
   ```bash
   terraform output mcp_server_config
   ```

### Deploy Agents

#### Small Deployment
```bash
cd workspaces/small/agents
terraform init
terraform apply \
  -var="env=dev" \
  -var="mcp_server_state_path=../../../../mcp-server/terraform/workspaces/core/terraform.tfstate"
```

#### Medium Deployment
```bash
cd workspaces/medium/mesh_agents
terraform init
terraform apply \
  -var="env=staging" \
  -var="mcp_server_state_path=../../../../mcp_server/terraform/workspaces/core/terraform.tfstate"
```

## Agent Configuration

### Environment Variables
Agents automatically receive MCP server configuration:
```bash
AGENT_MESH_KV_TABLE=agent-mesh-dev-kv
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-dev-artifacts-abc123
AGENT_MESH_EVENT_BUS=agent-mesh-dev
AGENT_MESH_QUEUE_URL=https://sqs.us-west-2.amazonaws.com/.../agent-mesh-dev-subtasks
```

### Agent Lanes
Agents operate in different "lanes" with increasing permissions:

- **read_only**: Can read from MCP services, no write access
- **dry_run**: Can simulate changes but not execute them
- **execute**: Full read/write access to make changes

### Agent Coordination
Agents coordinate through the MCP server infrastructure:
1. **State Storage**: DynamoDB for coordination state
2. **Artifacts**: S3 for files and large data
3. **Events**: EventBridge for async communication
4. **Tasks**: SQS for work distribution

## Integration with Specialized Agents

The infrastructure supports the specialized Claude agents defined in `.claude/agents/specialized/`:

- **CloudFront Expert**: Uses agent infrastructure to deploy CDN configurations
- **Lambda Expert**: Orchestrates serverless function deployments
- **S3 Expert**: Manages complex storage architectures
- **DynamoDB Expert**: Designs and optimizes database schemas
- And 9 more specialized agents...

Each specialized agent can be deployed using the agent compute module with specific configurations.

## Monitoring and Observability

### CloudWatch Integration
- Automatic log aggregation for all agents
- Custom metrics for agent performance
- Alarms for failure conditions
- Dashboards for operational visibility

### Tracing and Debugging
- X-Ray integration for distributed tracing
- Agent execution timelines in S3
- Event correlation across services
- Performance profiling

## Security

### IAM Security Model
- Least-privilege access policies
- Lane-based permission escalation
- Secure secrets management
- Audit logging for all actions

### Network Security
- VPC isolation (optional)
- Security groups with minimal access
- Encryption in transit and at rest
- Private subnet deployment options

## Cost Optimization

### Resource Right-sizing
- Fargate Spot for non-critical workloads
- Automatic scaling based on demand
- Scheduled scaling for predictable patterns
- Reserved capacity for baseline workloads

### Storage Optimization
- S3 Intelligent Tiering for artifacts
- DynamoDB on-demand billing
- CloudWatch log retention policies
- Lifecycle policies for temporary data

## Best Practices

### Agent Development
1. Start with read-only lane for testing
2. Use dry-run lane for validation
3. Graduate to execute lane for production
4. Implement proper error handling
5. Use structured logging

### Infrastructure Management
1. Use separate environments (dev/staging/prod)
2. Version your agent containers
3. Monitor resource utilization
4. Implement proper backup strategies
5. Test disaster recovery procedures

## Troubleshooting

### Common Issues
- **Permission Errors**: Check IAM roles and lane configuration
- **Connectivity Issues**: Verify VPC and security group settings
- **Performance Problems**: Review resource allocation and scaling
- **Cost Overruns**: Implement budget alerts and right-sizing

### Debug Tools
- CloudWatch Logs for agent output
- X-Ray for distributed tracing  
- Step Functions execution history
- EventBridge event monitoring

## Migration from Legacy Modules

If migrating from the original module structure:

1. **stepfn_lanes** → **agent_orchestration**
2. **ecs_task_agent** → **agent_compute**  
3. **aurora_pgvector** → **agent_ml_features**
4. **cw_observability_min** → (unchanged)

The new modules provide better separation of concerns and cleaner integration with the MCP server infrastructure.