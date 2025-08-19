# AWS AI Agent Bus - Examples & Use Cases

A comprehensive guide showcasing practical applications of the AWS AI Agent Bus infrastructure and MCP server integration.

## Table of Contents

- [Overview](#overview)
- [Quick Start Examples](#quick-start-examples)
- [Use Cases by Domain](#use-cases-by-domain)
- [Integration Patterns](#integration-patterns)
- [Workflow Examples](#workflow-examples)
- [Cost-Effective Deployments](#cost-effective-deployments)

## Overview

The AWS AI Agent Bus provides a complete infrastructure for running AI agent meshes with standardized interfaces. This document demonstrates real-world applications across different scales and domains.

## Quick Start Examples

### 1. Personal AI Assistant with Memory

**Scenario**: Build a personal AI assistant that remembers conversations and learns preferences.

**Infrastructure**: Small workspace (~$10/month)

- DynamoDB for conversation memory
- S3 for file attachments
- EventBridge for notifications

```bash
# Deploy minimal infrastructure
npm run tf:apply -- --var WS=small/kv_store ENV=personal
npm run tf:apply -- --var WS=small/artifacts_bucket ENV=personal
npm run tf:apply -- --var WS=small/event_bus ENV=personal
```

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

**Infrastructure**: Medium workspace (~$50/month)
- Step Functions for workflow orchestration
- ECS tasks for document processing
- S3 for document storage

```bash
# Deploy workflow infrastructure
npm run tf:apply -- --var WS=medium/workflow ENV=production
npm run tf:apply -- --var WS=medium/mesh_agents ENV=production
```

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

### 1. Event-Driven Architecture

**Pattern**: Microservices communicating via EventBridge events.

```javascript
// Service A: Order processing
await mcp.call('mesh_event_send', {
  detail_type: 'OrderCreated',
  detail: { order_id: 'ord-123', customer_id: 'cust-456' }
});

// Service B: Inventory management (listens for OrderCreated)
// Service C: Shipping (listens for OrderCreated)
// Service D: Analytics (listens for all events)
```

### 2. CQRS with Event Sourcing

**Pattern**: Separate read/write models with event history.

```javascript
// Command: Update user profile
await mcp.call('mesh_event_send', {
  detail_type: 'UserProfileUpdated',
  detail: { user_id: 'user123', field: 'email', new_value: 'new@email.com' }
});

// Query: Get current user state
const profile = await mcp.call('mesh_kv_get', {
  key: 'user:user123:profile'
});

// Event sourcing: Get user history
const timeline = await mcp.call('mesh_timeline_get', {
  prefix: 'user/user123/',
  max_keys: 50
});
```

### 3. Saga Pattern for Distributed Transactions

**Pattern**: Long-running transactions across multiple services.

```javascript
// Start booking saga
await mcp.call('mesh_event_send', {
  detail_type: 'BookingRequested',
  detail: {
    saga_id: 'saga-789',
    flight_id: 'fl-123',
    hotel_id: 'ht-456',
    user_id: 'user123'
  }
});

// Store saga state
await mcp.call('mesh_kv_set', {
  key: 'saga:saga-789:state',
  value: JSON.stringify({
    status: 'flight_booked',
    steps_completed: ['reserve_flight'],
    steps_remaining: ['reserve_hotel', 'charge_payment'],
    rollback_actions: ['cancel_flight']
  })
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

### Startup/Small Business ($10-30/month)

**Use Case**: Customer support chatbot with memory.

**Components**:
- Small workspace only
- DynamoDB on-demand
- S3 standard tier
- EventBridge basic

**Configuration**:
```bash
# Minimal deployment
npm run tf:apply -- --var WS=small/kv_store ENV=startup
npm run tf:apply -- --var WS=small/artifacts_bucket ENV=startup

# Environment variables
AGENT_MESH_ENV=startup
AGENT_MESH_KV_TABLE=agent-mesh-kv-startup
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts-startup
```

### Mid-Scale Business ($100-500/month)

**Use Case**: Multi-tenant SaaS with workflow automation.

**Components**:
- Small + Medium workspaces
- Step Functions for workflows
- ECS for processing tasks
- Aurora Serverless for analytics

**Features**:
- Tenant isolation via key prefixes
- Automated workflows
- Real-time analytics
- Event-driven architecture

### Enterprise ($1000+/month)

**Use Case**: High-volume transaction processing.

**Components**:
- All workspaces (Small + Medium + Large)
- Aurora pgvector for ML features
- Advanced monitoring
- Multi-region deployment

**Features**:
- Vector similarity search
- Advanced analytics
- High availability
- Compliance features

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