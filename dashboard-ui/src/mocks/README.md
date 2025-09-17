# Mock Data System

This directory contains centralized mock data for development and testing of the AI Agent Bus dashboard.

## Overview

The mock data system provides:
- **Consistent data** across all components
- **Environment-based switching** between mock and real APIs
- **Testing utilities** for different scenarios
- **Performance simulation** for realistic development

## Usage

### Development Mode
Mock data is automatically used in development when `VITE_USE_MOCK_DATA=true` (default).

```typescript
import { mockWorkflows, MockDataGenerator } from '../mocks';

// Check if should use mock data
if (MockDataGenerator.shouldUseMockData('workflows')) {
  return mockWorkflows;
}
```

### Environment Variables

Control mock data via `.env.development`:

```bash
# Global mock data control
VITE_USE_MOCK_DATA=true

# Feature-specific controls
VITE_MOCK_WORKFLOWS=true
VITE_MOCK_CONTEXTS=true
VITE_MOCK_MCP=true
VITE_MOCK_OAUTH=true
VITE_MOCK_EVENTS=true
```

### Testing

```typescript
import { TestEnvironment, TestDataFactory, TestScenarios } from '../mocks/testing-utils';

// Test with empty dashboard
await TestScenarios.emptyDashboard();

// Create test data
const testWorkflow = TestDataFactory.createWorkflow({
  name: 'Test Workflow',
  description: 'A test workflow'
});

// Simulate network conditions
await MockPerformance.simulateSlowApi(2000);
```

## Mock Data Types

### Workflows
- `mockWorkflows` - Sample workflow definitions
- `mockWorkflowTemplates` - Marketplace templates
- Includes realistic metadata, stats, and definitions

### Contexts
- `mockContexts` - MCP contexts with permissions
- User vs organization contexts
- OAuth grant associations

### Users & Organizations
- `mockUsers` - Sample user profiles
- `mockOrganizations` - Sample organizations
- Realistic member counts and plans

### MCP Tools
- `mockMCPTools` - Available MCP tools
- Input/output schemas
- Categories and examples

### Events
- `mockRealtimeEvents` - Sample event stream
- Different event types and priorities
- Realistic timestamps and metadata

## Testing Scenarios

### Empty State
```typescript
await TestScenarios.emptyDashboard();
// Shows empty states, onboarding flows
```

### Loaded State
```typescript
await TestScenarios.loadedDashboard();
// Shows populated dashboard with sample data
```

### Offline Mode
```typescript
await TestScenarios.offlineMode();
// Simulates network failures, shows error states
```

### Performance Testing
```typescript
// Simulate slow API
await MockPerformance.simulateSlowApi(3000);

// Simulate network errors
await MockPerformance.simulateNetworkError();
```

## API Simulation

Mock APIs include realistic delays and error simulation:

```typescript
class DashboardClient {
  async getWorkflows() {
    if (MockDataGenerator.shouldUseMockData('workflows')) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockWorkflows;
    }
    // Real API call...
  }
}
```

## Best Practices

1. **Use centralized mock data** - Don't scatter mock data throughout components
2. **Include realistic delays** - Simulate real API response times
3. **Test error states** - Use mock system to test error handling
4. **Environment switching** - Easy toggle between mock and real data
5. **Consistent data** - Use same mock data across components for consistency

## Data Generation

```typescript
// Random data
const randomUser = MockDataGenerator.getRandomUser();
const randomWorkflow = MockDataGenerator.getRandomWorkflow();

// Custom data
const customEvent = MockDataGenerator.generateRealtimeEvent({
  detailType: 'CustomEvent',
  priority: 'high'
});
```

## Integration with Components

### Context Integration
```typescript
// DashboardContext.tsx
async getWorkflows() {
  if (MockDataGenerator.shouldUseMockData('workflows')) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockWorkflows;
  }
  return this.request('/api/workflows');
}
```

### Component Usage
```typescript
// WorkflowMarketplace.tsx
const loadTemplates = async () => {
  if (MockDataGenerator.shouldUseMockData('templates')) {
    setTemplates(mockWorkflowTemplates);
    return;
  }
  // Load from real API...
};
```

This system makes development faster, testing more reliable, and provides a consistent experience across the entire application.