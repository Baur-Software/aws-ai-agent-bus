# AWS AI Agent Bus - Examples & Use Cases

A comprehensive guide showcasing practical applications of the AWS AI Agent Bus infrastructure and MCP server integration.

## Table of Contents

- [Overview](#overview)
- [Specialized Agent Examples](#specialized-agent-examples)
- [Quick Start Examples](#quick-start-examples)
- [Use Cases by Domain](#use-cases-by-domain)
- [Integration Patterns](#integration-patterns)
- [Workflow Examples](#workflow-examples)
- [Cost-Effective Deployments](#cost-effective-deployments)

## Overview

The AWS AI Agent Bus provides a complete infrastructure for running AI agent meshes with standardized interfaces. The infrastructure modules in `infra/` provide AWS services that support the MCP server, while specialized Claude agents coordinate through the MCP server to orchestrate these services. This document demonstrates real-world applications across different scales and domains.

## Specialized Agent Examples

The AWS AI Agent Bus includes specialized Claude agents that orchestrate AWS services through the MCP server. The underlying infrastructure is provided by Terraform modules, while the agents coordinate to build complete solutions.

### Architecture Foundation

The AWS AI Agent Bus uses a two-layer architecture:

#### MCP Server Infrastructure (`mcp-server/terraform/`)
Core services that provide standardized interfaces for agent coordination:

- **DynamoDB KV Store**: Key-value storage for agent state and coordination
- **S3 Artifacts Bucket**: Object storage for files and artifacts  
- **EventBridge Bus**: Event-driven communication between agents
- **SQS Message Queue**: Asynchronous task processing
- **Secrets Manager**: Secure credential storage

#### Claude Agent Infrastructure (`infra/`)
Specialized infrastructure for running and orchestrating Claude agents:

- **Agent Orchestration**: Step Functions for coordinating conductor, critic, and sweeper agents
- **Agent Compute**: ECS Fargate tasks for containerized agent execution
- **Agent ML Features**: Aurora pgvector for vector similarity search and embeddings
- **Agent Integrations**: Third-party service connections (Stripe, Supabase, Vercel)
- **Agent Monitoring**: CloudWatch observability for agent performance

### Deployment Strategy

1. **Deploy MCP Server First**:
   ```bash
   cd mcp-server/terraform/workspaces/core
   terraform apply -var="env=dev"
   ```

2. **Deploy Agent Infrastructure**:
   ```bash
   cd infra/workspaces/small/agents  
   terraform apply -var="env=dev"
   ```

### Deployment Sizes

Choose your deployment size based on requirements:

#### MCP Server Core (~$5-15/month)
- Essential services for agent coordination
- Pay-per-use pricing model
- Scales automatically with demand

#### Agent Infrastructure Options:
- **Small** (`infra/workspaces/small/`): Basic agent execution (~$30-100/month)
- **Medium** (`infra/workspaces/medium/`): Full orchestration with monitoring (~$100-500/month) 
- **Large** (`infra/workspaces/large/`): ML-enhanced with vector database (~$500-1000+/month)
- **Integrations** (`infra/workspaces/integrations/`): Third-party service integrations

### Available Specialized Agents

- **CloudFront Distribution Expert**: CDN optimization, security, and global content delivery
- **CloudWatch Monitoring Expert**: Comprehensive monitoring, logging, and alerting
- **DynamoDB Database Expert**: NoSQL database design, optimization, and scaling
- **EKS Kubernetes Expert**: Container orchestration and Kubernetes management
- **EventBridge Events Expert**: Event-driven architecture and integration patterns
- **GitHub Integration Expert**: CI/CD workflows and repository management
- **IAM Security Expert**: Identity and access management, security policies
- **Lambda Serverless Expert**: Serverless function development and optimization
- **S3 Storage Expert**: Object storage, data lakes, and content management
- **Slack Integration Expert**: Team collaboration and notification workflows
- **SNS Messaging Expert**: Pub/sub messaging and notification delivery
- **SQS Queue Expert**: Message queuing and asynchronous processing
- **Stripe Payments Expert**: Payment processing and financial workflows

### Multi-Agent Coordination Example

**Scenario**: E-commerce platform with monitoring, payments, and notifications

```javascript
// 1. S3 Agent: Set up product catalog storage
await mcp.call('mesh_artifacts_put', {
  key: 'products/catalog/electronics.json',
  content: JSON.stringify(productCatalog),
  content_type: 'application/json'
});

// 2. DynamoDB Agent: Store user session data
await mcp.call('mesh_kv_set', {
  key: 'session:user123:cart',
  value: JSON.stringify({
    items: [{ sku: 'laptop-pro', quantity: 1, price: 1299 }],
    total: 1299,
    session_start: '2024-01-15T10:00:00Z'
  }),
  ttl_hours: 24
});

// 3. Stripe Agent: Process payment (coordinated via events)
await mcp.call('mesh_event_send', {
  detail_type: 'PaymentRequested',
  detail: {
    user_id: 'user123',
    amount: 1299,
    currency: 'USD',
    payment_method: 'card_xyz'
  },
  source: 'e-commerce-platform'
});

// 4. SNS Agent: Send confirmation (triggered by payment success)
await mcp.call('mesh_event_send', {
  detail_type: 'OrderConfirmation',
  detail: {
    user_id: 'user123',
    order_id: 'ord-456',
    notification_channels: ['email', 'sms']
  },
  source: 'order-processor'
});

// 5. CloudWatch Agent: Track metrics and performance
await mcp.call('mesh_event_send', {
  detail_type: 'MetricUpdate',
  detail: {
    metric_name: 'OrdersProcessed',
    value: 1,
    unit: 'Count',
    dimensions: {
      Platform: 'Web',
      PaymentMethod: 'Stripe'
    }
  },
  source: 'metrics-collector'
});
```

### Agent Mesh Orchestration

**Pattern**: Conductor agent coordinating specialized agents

```javascript
// Conductor coordinates multiple specialized agents
const conductorPlan = {
  goal: 'Deploy secure e-commerce platform',
  agents: {
    iam_security: {
      task: 'Set up secure IAM roles and policies',
      dependencies: []
    },
    s3_storage: {
      task: 'Configure product catalog and asset storage',
      dependencies: ['iam_security']
    },
    cloudfront_cdn: {
      task: 'Set up global CDN with security headers',
      dependencies: ['s3_storage']
    },
    dynamodb_database: {
      task: 'Design user and order database schemas',
      dependencies: ['iam_security']
    },
    lambda_serverless: {
      task: 'Implement order processing functions',
      dependencies: ['dynamodb_database']
    },
    stripe_payments: {
      task: 'Configure payment processing',
      dependencies: ['lambda_serverless']
    },
    cloudwatch_monitoring: {
      task: 'Set up comprehensive monitoring',
      dependencies: ['lambda_serverless', 'cloudfront_cdn']
    }
  }
};

// Store orchestration plan
await mcp.call('mesh_kv_set', {
  key: 'orchestration:ecommerce-deploy:plan',
  value: JSON.stringify(conductorPlan),
  ttl_hours: 48
});

// Trigger agent coordination
await mcp.call('mesh_event_send', {
  detail_type: 'OrchestrationStarted',
  detail: {
    plan_id: 'ecommerce-deploy',
    coordinator: 'conductor-agent',
    priority: 'high'
  },
  source: 'agent-mesh'
});
```

## Quick Start Examples

### 1. Personal AI Assistant with Memory

**Scenario**: Build a personal AI assistant that remembers conversations and learns preferences.

**Architecture**: MCP Server + Small Agent Workspace (~$35-50/month)

**Step 1: Deploy MCP Server Core**
```bash
cd mcp-server/terraform/workspaces/core
terraform init
terraform apply -var="env=personal"
```

**Step 2: Deploy Small Agent Workspace**
```bash 
cd infra/workspaces/small/kv_store
terraform apply -var="env=personal"

cd ../artifacts_bucket  
terraform apply -var="env=personal"

cd ../event_bus
terraform apply -var="env=personal"
```

**Note**: The small workspace uses the existing structure but now connects to the MCP server infrastructure for coordination.

**MCP Usage**:

```javascript
// Store conversation context
await mcp.call('mesh_kv_set', {
  key: 'user:john:preferences',
  value: JSON.stringify({
    communication_style: 'casual',
    preferred_topics: ['tech', 'music'],
    timezone: 'PST'
  }),
  ttl_hours: 720 // 30 days
});

// Store file attachment
await mcp.call('mesh_artifacts_put', {
  key: 'conversations/2024/resume.pdf',
  content: pdfContent,
  content_type: 'application/pdf'
});
```

### 2. Document Processing Pipeline

**Scenario**: Automated document analysis and extraction pipeline.

**Architecture**: MCP Server + Medium Agent Workspace (~$150-200/month)

**Step 1: Deploy MCP Server Core**
```bash
cd mcp-server/terraform/workspaces/core
terraform apply -var="env=production"
```

**Step 2: Deploy Medium Agent Workspace**
```bash
# Deploy workflow orchestration
cd infra/workspaces/medium/workflow
terraform apply -var="env=production"

# Deploy agent mesh with ECS tasks
cd ../mesh_agents
terraform apply -var="env=production"

# Deploy observability
cd ../observability  
terraform apply -var="env=production"
```

**Features**: Full Step Functions orchestration, ECS agent tasks, and comprehensive monitoring

**Event-Driven Processing**:

```javascript
// Trigger document processing
await mcp.call('mesh_event_send', {
  detail_type: 'DocumentUploaded',
  detail: {
    document_id: 'doc-123',
    bucket: 'agent-mesh-artifacts',
    key: 'documents/contract.pdf',
    processing_type: 'legal_review'
  },
  source: 'document-processor'
});
```

## Use Cases by Domain

### Healthcare & Medical

**Scenario**: Medical record analysis and patient care coordination.

**Components**:

- Secure document storage (HIPAA-compliant S3)
- Patient timeline tracking
- Care team coordination via events

**Example**:

```javascript
// Store patient timeline event
await mcp.call('mesh_kv_set', {
  key: 'patient:12345:timeline:2024-01-15',
  value: JSON.stringify({
    event_type: 'lab_result',
    results: { glucose: 95, cholesterol: 180 },
    provider: 'Dr. Smith',
    timestamp: '2024-01-15T10:30:00Z'
  })
});

// Notify care team
await mcp.call('mesh_event_send', {
  detail_type: 'LabResultsAvailable',
  detail: {
    patient_id: '12345',
    critical: false,
    provider: 'Dr. Smith'
  }
});
```

### Legal & Compliance

**Scenario**: Contract analysis and compliance monitoring.

**Components**:

- Document version control
- Compliance rule engine
- Audit trail via timeline

**Example**:

```javascript
// Store contract version
await mcp.call('mesh_artifacts_put', {
  key: 'contracts/client-abc/v2.1/agreement.pdf',
  content: contractContent,
  content_type: 'application/pdf'
});

// Track compliance check
await mcp.call('mesh_kv_set', {
  key: 'compliance:contract:abc:gdpr',
  value: JSON.stringify({
    status: 'compliant',
    checked_at: '2024-01-15T14:00:00Z',
    requirements_met: ['data_protection', 'right_to_erasure'],
    next_review: '2024-07-15'
  })
});
```

### Financial Services

**Scenario**: Trading algorithm backtesting and risk management.

**Components**:

- High-performance Aurora pgvector for market data
- Real-time event processing
- Risk calculation workflows

**Example**:

```javascript
// Store risk calculation result
await mcp.call('mesh_kv_set', {
  key: 'risk:portfolio:tech-fund:var',
  value: JSON.stringify({
    value_at_risk: 0.15,
    confidence: 0.95,
    time_horizon: '1d',
    calculated_at: '2024-01-15T16:00:00Z'
  }),
  ttl_hours: 1 // Refresh hourly
});

// Trigger rebalancing workflow
await mcp.call('mesh_event_send', {
  detail_type: 'RiskThresholdExceeded',
  detail: {
    portfolio: 'tech-fund',
    current_var: 0.15,
    threshold: 0.10,
    action: 'rebalance'
  }
});
```

### E-commerce & Retail

**Scenario**: Product recommendation and inventory management.

**Components**:

- Customer preference storage
- Product catalog in S3
- Purchase event tracking

**Example**:

```javascript
// Update customer preferences
await mcp.call('mesh_kv_set', {
  key: 'customer:user123:preferences',
  value: JSON.stringify({
    categories: ['electronics', 'books'],
    price_range: { min: 10, max: 500 },
    brands: ['apple', 'samsung'],
    last_updated: '2024-01-15T12:00:00Z'
  })
});

// Process purchase event
await mcp.call('mesh_event_send', {
  detail_type: 'PurchaseCompleted',
  detail: {
    customer_id: 'user123',
    order_id: 'ord-456',
    items: [{ sku: 'iphone-15', quantity: 1, price: 999 }],
    total: 999
  }
});
```

## Integration Patterns

### 1. Agent Mesh Event-Driven Architecture

**Pattern**: Specialized agents communicating via EventBridge events with coordination.

```javascript
// EventBridge Expert: Configure event routing
await mcp.call('mesh_event_send', {
  detail_type: 'EventRuleCreated', 
  detail: {
    rule_name: 'order-processing-pipeline',
    event_pattern: {
      'detail-type': ['OrderCreated'],
      'source': ['e-commerce-platform']
    },
    targets: ['inventory-agent', 'shipping-agent', 'analytics-agent']
  },
  source: 'eventbridge-expert'
});

// Order service triggers the pipeline
await mcp.call('mesh_event_send', {
  detail_type: 'OrderCreated',
  detail: { 
    order_id: 'ord-123', 
    customer_id: 'cust-456',
    items: [{ sku: 'laptop', quantity: 1 }]
  },
  source: 'e-commerce-platform'
});

// SQS Expert: Handle high-volume order processing
await mcp.call('mesh_event_send', {
  detail_type: 'QueueMessageReceived',
  detail: {
    queue_name: 'order-processing',
    message_body: { order_id: 'ord-123', priority: 'standard' },
    processing_agent: 'lambda-expert'
  },
  source: 'sqs-expert'
});

// Lambda Expert: Process the order
await mcp.call('mesh_event_send', {
  detail_type: 'OrderProcessed',
  detail: {
    order_id: 'ord-123',
    status: 'confirmed',
    processing_time_ms: 250,
    next_steps: ['inventory_check', 'payment_capture']
  },
  source: 'lambda-expert'
});
```

### 2. Agent Mesh CQRS with Event Sourcing

**Pattern**: Specialized agents managing separate read/write models with event history.

```javascript
// DynamoDB Expert: Handle write commands
await mcp.call('mesh_event_send', {
  detail_type: 'UserProfileUpdateRequested',
  detail: { 
    user_id: 'user123', 
    field: 'email', 
    new_value: 'new@email.com',
    requested_by: 'user-service'
  },
  source: 'user-management'
});

// Lambda Expert: Process the command
await mcp.call('mesh_kv_set', {
  key: 'user:user123:profile',
  value: JSON.stringify({
    user_id: 'user123',
    email: 'new@email.com',
    updated_at: '2024-01-15T14:00:00Z'
  })
});

// S3 Expert: Store event history for sourcing
await mcp.call('mesh_artifacts_put', {
  key: 'events/user/user123/2024-01-15T14:00:00Z-profile-updated.json',
  content: JSON.stringify({
    event_type: 'UserProfileUpdated',
    user_id: 'user123',
    changes: { email: { old: 'old@email.com', new: 'new@email.com' } },
    timestamp: '2024-01-15T14:00:00Z',
    version: 15
  }),
  content_type: 'application/json'
});

// CloudWatch Expert: Track command processing metrics
await mcp.call('mesh_event_send', {
  detail_type: 'MetricUpdate',
  detail: {
    metric_name: 'UserProfileUpdates',
    value: 1,
    unit: 'Count',
    dimensions: { Service: 'UserManagement', Field: 'email' }
  },
  source: 'cloudwatch-expert'
});

// Query side: Get current user state (read model)
const profile = await mcp.call('mesh_kv_get', {
  key: 'user:user123:profile'
});

// Event sourcing: Reconstruct user history from S3
const eventHistory = await mcp.call('mesh_artifacts_list', {
  prefix: 'events/user/user123/'
});
```

### 3. Agent Mesh Saga Pattern for Distributed Transactions

**Pattern**: Specialized agents coordinating long-running transactions across services.

```javascript
// Lambda Expert: Initiate booking saga
await mcp.call('mesh_event_send', {
  detail_type: 'BookingRequested',
  detail: {
    saga_id: 'saga-789',
    flight_id: 'fl-123',
    hotel_id: 'ht-456',
    user_id: 'user123',
    orchestrator: 'lambda-booking-saga'
  },
  source: 'booking-service'
});

// DynamoDB Expert: Store saga state with TTL
await mcp.call('mesh_kv_set', {
  key: 'saga:saga-789:state',
  value: JSON.stringify({
    status: 'flight_reserved',
    steps_completed: ['reserve_flight'],
    steps_remaining: ['reserve_hotel', 'charge_payment'],
    rollback_actions: ['cancel_flight'],
    timeout_at: '2024-01-15T16:00:00Z'
  }),
  ttl_hours: 2
});

// Stripe Expert: Handle payment processing
await mcp.call('mesh_event_send', {
  detail_type: 'PaymentRequested',
  detail: {
    saga_id: 'saga-789',
    amount: 1200,
    currency: 'USD',
    payment_method: 'card_xyz',
    hold_funds: true  // Authorization only
  },
  source: 'stripe-expert'
});

// SNS Expert: Send status notifications
await mcp.call('mesh_event_send', {
  detail_type: 'NotificationRequested',
  detail: {
    user_id: 'user123',
    message: 'Your booking is being processed',
    channel: 'email',
    saga_id: 'saga-789'
  },
  source: 'sns-expert'
});

// CloudWatch Expert: Monitor saga timeouts and failures
await mcp.call('mesh_event_send', {
  detail_type: 'SagaMetricUpdate',
  detail: {
    saga_id: 'saga-789',
    step: 'payment_processing',
    duration_ms: 1500,
    status: 'in_progress'
  },
  source: 'cloudwatch-expert'
});

// SQS Expert: Handle saga compensation (if failure occurs)
await mcp.call('mesh_event_send', {
  detail_type: 'SagaCompensationTriggered',
  detail: {
    saga_id: 'saga-789',
    failed_step: 'hotel_reservation',
    compensation_actions: ['cancel_flight', 'refund_payment']
  },
  source: 'sqs-expert'
});
```

## Workflow Examples

### 1. Content Moderation Pipeline

**Step Functions Workflow**: Automated content review process.

```json
{
  "Comment": "Content moderation workflow",
  "StartAt": "ExtractContent",
  "States": {
    "ExtractContent": {
      "Type": "Task",
      "Resource": "arn:aws:states:::ecs:runTask.sync",
      "Parameters": {
        "TaskDefinition": "content-extractor",
        "Input.$": "$"
      },
      "Next": "CheckPolicy"
    },
    "CheckPolicy": {
      "Type": "Task",
      "Resource": "arn:aws:states:::ecs:runTask.sync",
      "Parameters": {
        "TaskDefinition": "policy-checker"
      },
      "Next": "IsContentSafe"
    },
    "IsContentSafe": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.policy_result",
          "StringEquals": "safe",
          "Next": "PublishContent"
        }
      ],
      "Default": "FlagForReview"
    }
  }
}
```

**MCP Integration**:

```javascript
// Store moderation result
await mcp.call('mesh_kv_set', {
  key: `moderation:${content_id}:result`,
  value: JSON.stringify({
    status: 'approved',
    confidence: 0.95,
    flags: [],
    reviewed_at: '2024-01-15T10:00:00Z'
  })
});
```

### 2. ML Model Training Pipeline

**Workflow**: Automated model training and deployment.

```javascript
// Store training job metadata
await mcp.call('mesh_kv_set', {
  key: 'ml:training:job-123:metadata',
  value: JSON.stringify({
    model_type: 'classification',
    dataset_version: 'v2.1',
    hyperparameters: { learning_rate: 0.001, epochs: 100 },
    status: 'training'
  })
});

// Store model artifacts
await mcp.call('mesh_artifacts_put', {
  key: 'models/classification/v2.1/model.pkl',
  content: modelBinary,
  content_type: 'application/octet-stream'
});

// Trigger deployment event
await mcp.call('mesh_event_send', {
  detail_type: 'ModelTrainingCompleted',
  detail: {
    job_id: 'job-123',
    model_version: 'v2.1',
    accuracy: 0.94,
    ready_for_deployment: true
  }
});
```

## Cost-Effective Deployments

### Small Deployment ($35-50/month)

**Use Case**: Personal AI assistant, simple automation, development/testing.

**Architecture**: MCP Server Core + Small Agent Workspace

**Deployment**:
```bash
# 1. Deploy MCP Server Core (~$5-15/month)
cd mcp-server/terraform/workspaces/core
terraform apply -var="env=dev"

# 2. Deploy Small Agent Infrastructure (~$30-35/month) 
cd infra/workspaces/small/kv_store
terraform apply -var="env=dev"

cd ../artifacts_bucket  
terraform apply -var="env=dev"

cd ../event_bus
terraform apply -var="env=dev"
```

**Features**:
- Basic agent coordination
- Simple key-value storage
- File artifact management
- Event-driven communication

### Medium Deployment ($150-300/month)

**Use Case**: Production workflows, team collaboration, business automation.

**Architecture**: MCP Server Core + Medium Agent Workspace

**Deployment**:
```bash
# 1. Deploy MCP Server Core
cd mcp-server/terraform/workspaces/core
terraform apply -var="env=prod"

# 2. Deploy Medium Agent Infrastructure
cd infra/workspaces/medium/workflow
terraform apply -var="env=prod"

cd ../mesh_agents
terraform apply -var="env=prod"

cd ../observability
terraform apply -var="env=prod"
```

**Features**:
- Step Functions orchestration
- ECS containerized agents
- Comprehensive monitoring
- Multi-agent coordination

### Large Deployment ($500-1000+/month)

**Use Case**: Enterprise-scale AI operations, ML-enhanced agents, high-volume processing.

**Architecture**: MCP Server Core + Large Agent Workspace

**Deployment**:
```bash
# 1. Deploy MCP Server Core
cd mcp-server/terraform/workspaces/core
terraform apply -var="env=enterprise"

# 2. Deploy Large Agent Infrastructure
cd infra/workspaces/large/vector_pg
terraform apply -var="env=enterprise"

# 3. Include medium workspace features
cd ../medium/workflow
terraform apply -var="env=enterprise"

cd ../mesh_agents  
terraform apply -var="env=enterprise"

cd ../observability
terraform apply -var="env=enterprise"
```

**Features**:
- Aurora pgvector for vector similarity search
- ML-enhanced agent capabilities  
- Semantic search across artifacts
- Advanced analytics and reporting
- High-performance agent execution
- Enterprise-grade security and compliance

### Integration Deployments (Add-on costs)

**Use Case**: Connect with third-party services like Stripe, Supabase, or Vercel.

**Deployment**:
```bash
# Deploy Stripe integration
cd infra/workspaces/integrations/stripe
terraform apply -var="env=prod"

# Deploy Supabase integration  
cd ../supabase
terraform apply -var="env=prod"

# Deploy Vercel integration
cd ../vercel
terraform apply -var="env=prod"
```

**Features**:
- Webhook handling for external services
- Secure credential management
- Event-driven integration patterns
- Automated deployment pipelines

## Advanced Patterns

### 1. Multi-Tenant Architecture

```javascript
// Tenant-scoped operations
const tenantId = 'tenant-abc';

// Store tenant-scoped data
await mcp.call('mesh_kv_set', {
  key: `${tenantId}:user:123:profile`,
  value: JSON.stringify(userProfile)
});

// Tenant-scoped events
await mcp.call('mesh_event_send', {
  detail_type: 'UserAction',
  detail: { tenant_id: tenantId, user_id: '123', action: 'login' }
});
```

### 2. A/B Testing Framework

```javascript
// Store experiment configuration
await mcp.call('mesh_kv_set', {
  key: 'experiment:checkout-flow:config',
  value: JSON.stringify({
    variants: { A: 0.5, B: 0.5 },
    start_date: '2024-01-15',
    metrics: ['conversion_rate', 'revenue']
  })
});

// Track experiment event
await mcp.call('mesh_event_send', {
  detail_type: 'ExperimentEvent',
  detail: {
    experiment: 'checkout-flow',
    variant: 'A',
    user_id: 'user123',
    event: 'conversion'
  }
});
```

### 3. Real-Time Analytics

```javascript
// Store real-time metrics
await mcp.call('mesh_kv_set', {
  key: 'metrics:hourly:2024-01-15-14',
  value: JSON.stringify({
    active_users: 1250,
    page_views: 5000,
    conversions: 85,
    revenue: 12500
  }),
  ttl_hours: 168 // Keep for 1 week
});
```

## Next Steps

1. **Choose Your Use Case**: Select the most relevant example above
2. **Deploy Infrastructure**: Start with small workspace, scale as needed  
3. **Integrate MCP Server**: Use stdio for development, HTTP for production
4. **Build Your Application**: Leverage the event-driven patterns
5. **Monitor & Scale**: Add observability workspace for production

For implementation details, see:

- [Infrastructure Setup](README.md#quick-start)
- [MCP Server Documentation](mcp-server/README.md)
- [Terraform Modules](infra/)
