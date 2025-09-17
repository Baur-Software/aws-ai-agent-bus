# Integration System Guide for AI Agents

## Overview

The AWS AI Agent Bus integration system supports multiple user connections per service, enabling users to connect work accounts, personal accounts, and backup credentials for each supported service.

## Architecture Patterns

### App Configuration vs User Connections

**App Configurations** (`integration-<service>` keys):
- Shared templates containing OAuth2 metadata, UI field definitions, and workflow capabilities
- Stored once per service, used by all users
- Contains public configuration like OAuth URLs, scopes, field schemas

**User Connections** (`user-{userId}-integration-{service}-{connectionId}` keys):
- Individual user credentials and settings
- Encrypted and isolated per user
- Supports multiple named connections per service

### KV Store Key Patterns

```bash
# App configuration (shared)
integration-google-analytics
integration-slack
integration-github

# User connections (individual)
user-{userId}-integration-{service}-{connectionId}
user-demo-user-123-integration-google-analytics-default
user-demo-user-123-integration-google-analytics-work
user-demo-user-123-integration-slack-personal
```

## Data Structures

### App Configuration Structure
```javascript
{
  id: 'google-analytics',
  name: 'Google Analytics',
  icon: BarChart3,
  color: 'bg-orange-500',
  description: 'Connect Google Analytics for website metrics and reporting',
  type: 'oauth2',
  oauth2_config: {
    auth_url: 'https://accounts.google.com/o/oauth2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    redirect_uri: 'http://localhost:3000/oauth/callback'
  },
  ui_fields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    { key: 'property_id', label: 'GA4 Property ID', type: 'text', required: true }
  ],
  workflow_capabilities: [
    'ga-top-pages', 'ga-search-data', 'ga-opportunities', 'ga-calendar'
  ]
}
```

### User Connection Structure
```javascript
{
  user_id: 'demo-user-123',
  service: 'google-analytics',
  connection_id: 'work',
  connection_name: 'Google Analytics (Work Account)',
  connected_at: '2025-01-15T10:30:00Z',
  status: 'active',
  credentials: {
    client_id: 'xxx',
    client_secret: 'xxx', // Encrypted in production
    property_id: '12345'
  },
  settings: {
    last_used: '2025-01-15T14:20:00Z',
    user_preferences: {},
    enabled_workflows: ['ga-top-pages', 'ga-search-data']
  }
}
```

## UI Components

### IntegrationsSettings Component

**File**: `dashboard-ui/src/components/IntegrationsSettings.tsx`

**Key Features**:
- Multiple connections per service support
- Connection naming and management
- Individual test/disconnect actions
- Automatic legacy connection migration
- Expandable connection cards

**Usage Patterns**:
```tsx
// Component shows multiple connections per service
const connections = userConnections().get(integrationId) || [];
const isConnected = () => connections.length > 0;
const hasMultipleConnections = () => connections.length > 1;

// Connection management actions
onConnect(integrationId, credentials, connectionName)
onDisconnect(integrationId, connectionId) 
onTest(integrationId, connectionId)
```

### WorkflowBuilder Integration

**File**: `dashboard-ui/src/components/WorkflowBuilder.tsx`

**Connection Detection**:
- Checks both legacy and new connection patterns
- Workflow nodes become available when ANY connection exists
- Supports automatic migration during detection

```javascript
// Checks for connections in both formats
const legacyConnection = await kvStore.get(`user-${userId}-integration-${service}`);
const newConnections = await Promise.all(
  commonConnectionIds.map(id => 
    kvStore.get(`user-${userId}-integration-${service}-${id}`)
  )
);
```

## Development Guidelines for Agents

### When Working with Integration Features

1. **Connection Creation**: Always support connection naming for multiple accounts
2. **Migration Handling**: Check for and migrate legacy connections when found
3. **Workflow Availability**: Ensure nodes become available with any valid connection
4. **Error Handling**: Provide clear messages for connection failures
5. **Security**: Never log or expose credentials in plaintext

### Key Files to Understand

- `dashboard-ui/src/components/IntegrationsSettings.tsx` - Main integration management UI
- `dashboard-ui/src/components/WorkflowBuilder.tsx` - Workflow node availability logic
- `dashboard-ui/src/hooks/useKVStore.js` - KV store operations
- `mcp-server/src/modules/mcp/handlers/` - MCP tool handlers for integrations

### Common Agent Tasks

**Adding New Integration Support**:
1. Add service to `APP_CONFIGS` in IntegrationsSettings
2. Add workflow node mappings to `NODE_INTEGRATION_MAPPING` 
3. Update WorkflowBuilder integration detection logic
4. Create MCP tool handlers for service API calls

**Debugging Connection Issues**:
1. Check KV store for both legacy and new connection patterns
2. Verify app configuration exists in `integration-<service>` key
3. Validate user connection structure and credentials
4. Test workflow node availability logic

**UI/UX Improvements**:
1. Enhance connection management interface
2. Add better error states and loading indicators
3. Improve connection naming and organization
4. Add bulk connection management features

## Migration Notes

### Legacy to New Format

Legacy connections (`user-{userId}-integration-{service}`) are automatically migrated to the new format (`user-{userId}-integration-{service}-default`) when detected. The migration:

1. Adds `connection_id: 'default'`
2. Adds `connection_name: '{ServiceName} (Default)'`
3. Preserves all existing credentials and settings
4. Removes the legacy key after successful migration

### Backward Compatibility

The system maintains backward compatibility by:
- Checking legacy patterns first during connection detection
- Migrating legacy connections on-demand
- Supporting both connection formats in workflow detection
- Preserving existing user workflows and configurations

This ensures a seamless upgrade experience for existing users while enabling new multiple connection features.