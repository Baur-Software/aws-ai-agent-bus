# Test Issues Tracker

## 🚨 IMMEDIATE ACTION REQUIRED

These tests are skipped and represent real gaps in our test coverage:

## AutoSave Timer Reset Logic
```typescript
// File: src/components/__tests__/AutoSave.test.tsx:170
it.skip('resets timer on subsequent changes', async () => {
```
**Problem:** Timer cancellation logic not working as expected with vitest fake timers
**Real-world impact:** Auto-save might not reset properly when users make rapid changes
**Fix required:** YES - this is a production bug waiting to happen

## Component Integration Tests (10 tests)
```typescript
// Files with skipped tests:
// - AgentModelConfiguration.test.tsx (8 tests)
// - WorkflowManager.test.tsx (2 tests)
```
**Problem:** Context provider mocking failing
**Real-world impact:** No test coverage for critical UI interactions
**Fix required:** YES - these test user-facing functionality

## Specific Failing Tests

### AgentModelConfiguration.test.tsx
1. `renders agent configuration tab for agent nodes`
2. `displays current model selection`
3. `shows temperature slider with current value`
4. `updates model configuration when changed`
5. `shows privacy warning for sensitive agents`
6. `validates configuration before saving`
7. `shows upgrade message for unavailable models`
8. `handles model API failures gracefully`

### WorkflowManager.test.tsx
1. `renders workflow manager with header`
2. `shows loading state initially`

## SOLUTIONS NEEDED

### 1. Fix SolidJS Context Mocking
Current approach using `vi.mock()` isn't working. Need to:
- Research @solidjs/testing-library best practices
- Create proper test wrapper components
- Use dependency injection pattern for tests

### 2. Fix Timer Edge Cases
Timer reset logic needs:
- Better understanding of vitest fake timer behavior
- Potentially use real timers for complex timing tests
- Alternative timer cancellation strategy

### 3. Test Infrastructure
Need standardized:
- Test utilities for context providers
- Mock factories for common dependencies
- Testing patterns documentation

## PRIORITY LEVELS

**P0 (Critical):** AutoSave timer logic - affects data safety
**P1 (High):** Component integration tests - affects user experience
**P2 (Medium):** Test infrastructure improvements

## ACCEPTANCE CRITERIA

✅ All tests pass without `.skip()`
✅ Timer reset logic works correctly in all scenarios
✅ Component tests cover full user interaction flows
✅ Test utilities are documented and reusable

---
**Status:** 11 tests skipped out of 87 total
**Goal:** 0 skipped tests before production deployment
**Owner:** Development Team
**Due Date:** Before v1.0 release