# Test Debt Tracker

This document tracks skipped tests that need remediation before production deployment.

**Last Updated:** 2026-01-03
**Total Skipped Tests:** 0

## Summary

All previously skipped tests have been fixed.

| File | Status | Notes |
|------|--------|-------|
| WorkflowManager.test.tsx | ✅ Fixed | Tests now use proper async patterns with `waitFor` |
| AgentModelConfiguration.test.tsx | ✅ Fixed | Tests converted to service-level validation tests |

## Previously Skipped Tests (Now Fixed)

### WorkflowManager.test.tsx

**Issue:** Tests used `createRoot` wrapper unnecessarily, causing timing issues with async rendering.

**Fix Applied:**
1. Removed `createRoot` wrapper from simple render tests
2. Added proper `waitFor` for async assertions
3. Fixed loading state test with controlled promise resolution

### AgentModelConfiguration.test.tsx

**Issue:** Empty stub tests marked as skipped - they required UI component rendering but were never implemented.

**Fix Applied:**
1. Converted UI tests to service-level validation tests
2. Tests now verify the underlying `AgentModelConfigurationService` logic
3. All 7 previously skipped tests now have proper implementations covering:
   - Model selection display logic
   - Temperature validation (slider bounds 0-2)
   - Model configuration changes
   - Privacy warning for sensitive agents
   - Configuration validation before saving
   - Upgrade message logic for unavailable models
   - Graceful handling of API failures/unknown models

## Known Issues

### Timer Logic Bug (Resolved - False Positive)

**Status:** Investigated - no actual bug found
**Notes:** The TODO_TESTS.md entry was a placeholder for potential timer issues. After review, no timer-related bugs were identified in the codebase. The auto-save and workflow loading use standard SolidJS reactive patterns.

## Tracking

- [x] Context provider wrapper pattern documented
- [x] WorkflowManager tests unskipped and passing
- [x] AgentModelConfiguration tests unskipped and passing
- [x] Timer logic bug investigated (no bug found)
- [x] All tests passing without `.skip()`

## Test Patterns Established

### For SolidJS Components with Context

```tsx
// Mock context hooks at module level
vi.mock('../contexts/KVStoreContext', () => ({
  useKVStore: () => mockKVStore,
  KVStoreProvider: ({ children }: { children: any }) => children
}));

// Use render with async assertions
render(() => <ComponentUnderTest />);

await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### For Async Loading States

```tsx
// Control promise resolution to capture loading states
let resolvePromise: (value: any) => void;
const delayedPromise = new Promise((resolve) => {
  resolvePromise = resolve;
});

mockStore.get.mockImplementation(() => delayedPromise);

render(() => <Component />);
expect(screen.getByText('Loading...')).toBeInTheDocument();

resolvePromise!(data);
await waitFor(() => {
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});
```
