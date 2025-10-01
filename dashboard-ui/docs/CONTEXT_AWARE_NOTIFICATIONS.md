# Context-Aware Notifications System

## 🎯 Overview

The Events panel now supports **context-aware notifications** that automatically filter and reload when users switch between **Personal** and **Organizational** contexts.

## 🔄 How Context Switching Works

### 1. User Switches Context
User selects organization from dropdown or switches to personal context:
```typescript
// OrganizationContext updates currentOrganization()
setCurrentOrganization(selectedOrg); // or null for personal
```

### 2. Events.tsx Reacts Automatically
```typescript
// Re-subscribe when context changes (personal ↔ organizational)
createEffect(() => {
  const org = currentOrganization();
  const currentUser = user();

  if (isConnected() && subscriptionActive()) {
    console.log(`🔄 Context switched to: ${org?.name || 'Personal'}`);

    // Reload data for new context
    loadHistoricalEvents();
    loadAnalytics();

    // Re-subscribe with new context filters
    subscribeToEvents();
  }
});
```

### 3. Backend Filters Events by Context
```typescript
// EventsHandler.matchesSubscription() in dashboard-server
private static matchesSubscription(event: EventMessage, subscription: EventSubscription): boolean {
  // Tenant isolation
  if (subscription.userId && event.userId !== subscription.userId) {
    return false;
  }

  if (subscription.organizationId && event.organizationId !== subscription.organizationId) {
    return false;
  }

  // Pattern matching
  // ...
}
```

### 4. WebSocket Subscription with Context
```typescript
sendMessage({
  type: 'subscribe_events',
  eventTypes: ['*'],
  filters: {
    userId: user()?.userId,
    organizationId: currentOrganization()?.id // Changes on context switch
  }
});
```

## 📊 Visual Context Indicator

The Events panel now displays the current context at the top:

```
┌─────────────────────────────────────────────────┐
│ Context: [Acme Corp] (Organization events)      │
│                                                  │
│ [Live Events] [Analytics]                       │
│ ───────────────────────────────────────────     │
│                                                  │
│ • workflow.started - Just now                   │
│ • mcp.tool.executed - 2 seconds ago             │
│ • integration.connected - 5 minutes ago         │
└─────────────────────────────────────────────────┘
```

**Personal Context**:
- Badge shows: `Personal (Your personal events)`
- Filters: `organizationId = null`

**Organizational Context**:
- Badge shows: `[Org Name] (Organization events)`
- Filters: `organizationId = 'org-id'`

## 🔐 Security & Isolation

### Tenant Isolation Guarantees

1. **User-level isolation**
   - Events tagged with `userId`
   - Only owner can see their events

2. **Organization-level isolation**
   - Events tagged with `organizationId`
   - Only org members can see org events

3. **RBAC enforcement**
   - Admin role: Can see all org events
   - Member role: Can see events they have access to
   - Resource ownership checked on every operation

### Context Switching Security

```typescript
// Backend validation in EventsHandler
if (subscription.organizationId) {
  // Verify user is member of organization
  const isMember = await verifyOrgMembership(
    subscription.userId,
    subscription.organizationId
  );

  if (!isMember) {
    throw new Error('Unauthorized: Not a member of this organization');
  }
}
```

## 📋 Event Types by Context

### Personal Context Events
- `user.workflow.started`
- `user.integration.connected`
- `user.mcp.tool.executed`
- `user.agent.task.completed`

### Organizational Context Events
- `org.workflow.started`
- `org.integration.connected`
- `org.team.member.added`
- `org.workflow.published`
- `org.agent.deployed`

## 🎨 UI/UX Features

### Auto-Refresh on Context Switch
- ✅ Historical events reload
- ✅ Analytics dashboard updates
- ✅ WebSocket re-subscribes with new filters
- ✅ Event count badges update

### Visual Feedback
- ✅ Context badge shows current context
- ✅ Loading spinner during context switch
- ✅ Toast notification: "Switched to [Context]"
- ✅ Event list smoothly updates

### Filter Persistence
- ❌ Search query clears on context switch
- ❌ Priority/source filters clear on context switch
- 💡 **Future**: Persist filters per context in localStorage

## 🔄 Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│                                                                  │
│  [Personal ▼]  ←→  [Acme Corp ▼]                               │
│        ↓                  ↓                                      │
│   Personal Context   Org Context                                │
│   userId: user-123   userId: user-123                           │
│   orgId: null        orgId: acme                                │
└─────────────┬────────────────────────────────────────────────────┘
              │
              ↓ (createEffect detects change)
              │
┌─────────────┴────────────────────────────────────────────────────┐
│                      Events.tsx                                  │
│                                                                  │
│  1. setSubscriptionActive(false)                                │
│  2. loadHistoricalEvents()  ← MCP events_query with new context │
│  3. loadAnalytics()        ← MCP events_analytics with new ctx  │
│  4. subscribeToEvents()    ← WebSocket subscribe with new ctx   │
└─────────────┬────────────────────────────────────────────────────┘
              │
              ↓
┌─────────────┴────────────────────────────────────────────────────┐
│                  Dashboard Server                                │
│                                                                  │
│  EventsHandler.subscribe({                                      │
│    clientId: 'ws_12345',                                        │
│    userId: 'user-123',                                          │
│    organizationId: 'acme',  ← Context filter                    │
│    eventTypes: ['*']                                            │
│  })                                                             │
└─────────────┬────────────────────────────────────────────────────┘
              │
              ↓
┌─────────────┴────────────────────────────────────────────────────┐
│                  Event Broadcasting                              │
│                                                                  │
│  Only broadcast events where:                                   │
│  - event.userId === subscription.userId                         │
│  - event.organizationId === subscription.organizationId         │
│  - event.detailType matches subscription.eventTypes            │
└──────────────────────────────────────────────────────────────────┘
```

## 🚀 Usage Examples

### Example 1: Developer Workflow
```
1. User in Personal context
   - Sees: personal workflow executions, dev tool usage

2. User switches to "Engineering Team" context
   - Events reload → shows team workflows, shared integrations

3. User switches to "Acme Corp" context
   - Events reload → shows company-wide events, deployments
```

### Example 2: Admin Monitoring
```
1. Admin in "Acme Corp" context
   - Sees: all org events (admin role = full access)

2. Admin switches to "Marketing Team" context
   - Events reload → filtered to marketing team events only
```

### Example 3: Multi-Org User
```
1. User belongs to: Personal, Acme Corp, Beta Inc
   - Switch between 3 contexts seamlessly

2. Each context shows isolated events:
   - Personal: only user's events
   - Acme Corp: org events where user is member
   - Beta Inc: org events where user is member
```

## 📝 Implementation Checklist

- ✅ Context-aware event subscription
- ✅ Auto-reload on context switch
- ✅ Visual context indicator
- ✅ Tenant isolation (userId + organizationId)
- ✅ RBAC enforcement on WebSocket
- ✅ Historical events filter by context
- ✅ Analytics filter by context
- ⏳ Persist filters per context (localStorage)
- ⏳ Context switch animation/transition
- ⏳ "Switch Context" quick action in Events panel

## 🔗 Related Files

- [dashboard-ui/src/pages/Events.tsx](../src/pages/Events.tsx) - Context-aware event UI
- [dashboard-server/src/handlers/events.ts](../../dashboard-server/src/handlers/events.ts) - Event filtering logic
- [dashboard-server/src/middleware/auth.ts](../../dashboard-server/src/middleware/auth.ts) - RBAC enforcement
- [dashboard-ui/src/contexts/OrganizationContext.tsx](../src/contexts/OrganizationContext.tsx) - Context management

## 🎯 Next Steps

1. **Add context selector to Events panel** (currently in Header only)
2. **Persist filter state per context** using localStorage
3. **Add "Recent Contexts" dropdown** for quick switching
4. **Show event count badges** per context in org dropdown
5. **Add export/download** filtered by current context
