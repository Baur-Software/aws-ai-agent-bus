# Test Debt Tracker

This document tracks skipped tests that need remediation before production deployment.

**Last Updated:** 2026-01-01
**Total Skipped Tests:** 9

## Summary

| File | Skipped | Root Cause |
|------|---------|------------|
| WorkflowManager.test.tsx | 2 | Context provider issues |
| AgentModelConfiguration.test.tsx | 7 | Context provider issues |

## Skipped Tests Detail

### WorkflowManager.test.tsx (2 skipped)

**Root Cause:** SolidJS context provider setup issues in test environment

| Test Name | Line | Reason | Priority |
|-----------|------|--------|----------|
| `renders workflow manager with header` | 166 | Context provider issues - component renders but context not available | High |
| `shows loading state initially` | 506 | Context provider issues - timing/async state not captured correctly | Medium |

**Remediation Plan:**
1. Create proper test wrapper with all required context providers (KVStore, WebSocket, etc.)
2. Use `@solidjs/testing-library` async utilities correctly
3. Consider extracting a `TestProviders` component for reuse

### AgentModelConfiguration.test.tsx (7 skipped)

**Root Cause:** Component integration tests require complex context setup that wasn't implemented

| Test Name | Line | Reason | Priority |
|-----------|------|--------|----------|
| `displays current model selection` | 400 | Context provider issues | High |
| `shows temperature slider with current value` | 404 | Context provider issues | High |
| `updates model configuration when changed` | 408 | Context provider issues | High |
| `shows privacy warning for sensitive agents` | 412 | Medium |
| `validates configuration before saving` | 416 | Context provider issues | High |
| `shows upgrade message for unavailable models` | 437 | Context provider issues | Medium |
| `handles model API failures gracefully` | 459 | Context provider issues | Medium |

**Remediation Plan:**
1. Create mock context providers for AgentModelConfiguration tests
2. Implement proper component mounting with all dependencies
3. The service logic is already tested - these tests cover UI integration only

## Known Issues

### Timer Logic Bug (High Priority)

**Location:** Needs investigation
**Impact:** Could cause data loss in production
**Status:** Not yet identified in codebase

### Component Integration Gaps

The skipped tests represent critical UI flows that lack coverage:
- Model selection and configuration UI
- Workflow loading states
- Error handling in UI components

## Remediation Priority

1. **Immediate (Before Production):**
   - Fix context provider setup for all 9 skipped tests
   - Investigate and fix timer logic bug

2. **Short-term:**
   - Create reusable `TestProviders` wrapper component
   - Add integration test utilities to test setup

3. **Long-term:**
   - Establish test patterns documentation
   - Add CI check to prevent new `.skip()` additions without tracking

## How to Fix Context Provider Issues

```tsx
// Example test wrapper pattern for SolidJS
import { render } from '@solidjs/testing-library';
import { KVStoreProvider } from '../../context/KVStoreContext';
import { WebSocketProvider } from '../../context/WebSocketContext';

const TestProviders = (props: { children: any }) => (
  <KVStoreProvider value={mockKVStore}>
    <WebSocketProvider value={mockWebSocket}>
      {props.children}
    </WebSocketProvider>
  </KVStoreProvider>
);

// Usage in tests
render(() => (
  <TestProviders>
    <ComponentUnderTest />
  </TestProviders>
));
```

## Tracking

- [ ] Context provider wrapper implemented
- [ ] WorkflowManager tests unskipped and passing
- [ ] AgentModelConfiguration tests unskipped and passing
- [ ] Timer logic bug identified and fixed
- [ ] All 9 tests passing without `.skip()`
