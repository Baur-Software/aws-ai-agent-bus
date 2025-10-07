# Technical Debt Tracking

## Skipped Tests - HIGH PRIORITY

These tests are currently skipped but need to be fixed for true production readiness:

### AutoSave Timer Reset Logic

**File:** `src/components/__tests__/AutoSave.test.tsx:170`
**Status:** NEEDS FIX
**Issue:** Timer reset logic has subtle timing issue with vitest fake timers
**Impact:** Medium - affects auto-save reliability in edge cases
**Next Steps:**

1. Research vitest fake timer behavior with clearTimeout
2. Consider using real timers for this specific test
3. Investigate alternative timer cancellation patterns
**Assignee:** TBD
**Deadline:** Before v1.0 release

### Component Integration Tests

**Files:**

- `src/components/__tests__/AgentModelConfiguration.test.tsx` (8 skipped tests)
- `src/components/__tests__/WorkflowManager.test.tsx` (2 skipped tests)
**Status:** NEEDS FIX
**Issue:** SolidJS context provider mocking not working correctly
**Impact:** High - these test critical UI functionality
**Root Cause:** vi.mock not intercepting context hooks properly
**Next Steps:**

1. Research SolidJS testing best practices
2. Consider using @solidjs/testing-library's renderWithProviders
3. Implement proper test wrapper components
4. Update component tests to use integration testing approach
**Assignee:** TBD
**Deadline:** Before v1.0 release

## Test Framework Issues

### Context Provider Mocking

**Pattern:** Multiple test files struggle with context provider mocking
**Solution Needed:** Standardized test utility for SolidJS context mocking
**Files Affected:** 3+ test files
**Priority:** High

### Fake Timer Edge Cases

**Pattern:** vitest fake timers have edge cases with setTimeout/clearTimeout
**Solution Needed:** Timer testing utility or real timer fallback
**Files Affected:** AutoSave tests
**Priority:** Medium

## Action Items

- [ ] Create standardized SolidJS test utilities
- [ ] Research vitest timer behavior documentation
- [ ] Set up test infrastructure improvements sprint
- [ ] Document testing patterns and best practices
- [ ] Schedule regular technical debt review meetings

## Metrics

- Total Skipped Tests: 11
- Critical UI Tests Skipped: 10
- Timer Edge Case Tests: 1
- Target: 0 skipped tests by v1.0

---
*Last Updated:* 2024-12-19
*Next Review:* TBD
