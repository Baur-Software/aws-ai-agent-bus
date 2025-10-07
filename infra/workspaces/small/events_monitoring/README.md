# Event Monitoring Infrastructure

This Terraform workspace manages the DynamoDB tables for the event monitoring and management system.

## Architecture

The event monitoring system consists of 3 DynamoDB tables:

### 1. Events Table (`agent-mesh-dev-events`)

- **Purpose**: Store all event history with enhanced metadata
- **Hash Key**: `eventId` (String) - Unique identifier for each event
- **Attributes**:
  - `timestamp` (String) - ISO 8601 timestamp
  - `source` (String) - Event source identifier
  - `detailType` (String) - Type of event
  - `detail` (String) - Event payload as JSON string
  - `userId` (String) - User identifier for multi-tenant isolation
  - `priority` (String) - Event priority (info, warning, error, critical)
  - `metadata` (String) - Processing metadata as JSON string

**Global Secondary Indexes**:

- `timestamp-index`: `source` (hash) + `timestamp` (range) - For time-based queries by source
- `user-index`: `userId` (hash) + `timestamp` (range) - For user-specific event history

### 2. Subscriptions Table (`agent-mesh-dev-subscriptions`)

- **Purpose**: Manage alert subscriptions and notification preferences
- **Hash Key**: `subscriptionId` (String) - Unique subscription identifier
- **Attributes**:
  - `userId` (String) - User who created the subscription
  - `eventPatterns` (String) - EventBridge patterns as JSON
  - `notificationTargets` (String) - SNS/email targets as JSON
  - `status` (String) - active, paused, disabled

**Global Secondary Indexes**:

- `user-index`: `userId` (hash) - For querying user subscriptions

### 3. Event Rules Table (`agent-mesh-dev-event-rules`)

- **Purpose**: Store monitoring rules and alert configurations
- **Hash Key**: `ruleId` (String) - Unique rule identifier
- **Attributes**:
  - `userId` (String) - User who created the rule
  - `ruleName` (String) - Human-readable rule name
  - `eventPattern` (String) - EventBridge pattern as JSON
  - `actions` (String) - Actions to take as JSON array
  - `status` (String) - enabled, disabled

**Global Secondary Indexes**:

- `user-index`: `userId` (hash) - For querying user rules

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform installed
3. AWS SSO login: `aws sso login --profile your-profile`

### Infrastructure Deployment

```powershell
# Navigate to the workspace
cd infra/workspaces/small/events_monitoring

# Plan changes (review what will be created/modified)
powershell -ExecutionPolicy Bypass -File deploy.ps1

# Apply changes (deploy the infrastructure)
powershell -ExecutionPolicy Bypass -File apply.ps1
```

### Alternative Manual Commands

```powershell
# Set environment variables
$env:AWS_PROFILE = "your-profile"
$env:ENV = "dev"

# Terraform operations
terraform plan -var env=dev
terraform apply -var env=dev
terraform destroy -var env=dev  # Only if you need to tear down
```

## Integration

The event monitoring system integrates with:

1. **SNS Notifications**: Built on the existing `agent-mesh-notifications` topic
2. **EventBridge**: For advanced event routing and pattern matching
3. **MCP Server**: 6 event monitoring tools available via MCP protocol
4. **Multi-tenant Architecture**: User isolation and access controls

## MCP Tools Available

1. `event-monitoring.send` - Send events with monitoring capabilities
2. `event-monitoring.query` - Query event history with filters
3. `event-monitoring.analytics` - Get event analytics and insights
4. `event-monitoring.create-rule` - Create monitoring rules
5. `event-monitoring.create-alert` - Set up alert subscriptions
6. `event-monitoring.health-check` - System health and diagnostics

## Cost Optimization

All tables use:

- **Billing Mode**: PAY_PER_REQUEST (no fixed costs)
- **Point-in-Time Recovery**: Disabled (reduces costs)
- **Encryption**: AWS managed keys (no additional KMS costs)

Estimated monthly cost: ~$5-15 depending on usage patterns.

## Monitoring

Tables are tagged with:

- `app: agent-mesh`
- `env: dev`
- `workspace: dynamodb_events`
- `ManagedBy: terraform`
- `Project: agent-mesh`

Monitor via AWS CloudWatch metrics and the event monitoring health-check tool.
