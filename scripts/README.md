# Scripts Directory

## Test Debt Prevention

### `pre-commit-check.js`

Detects skipped tests and prevents commits that would introduce test debt.

**Usage:**

```bash
# Manual check
npm run check:test-debt

# Part of full test suite
npm run test:all
```

### `install-hooks.sh`

Installs git pre-commit hooks to automatically run test debt checks.

**Usage:**

```bash
# Install hooks (one-time setup)
npm run install:hooks

# Hooks will then run automatically on every commit
git commit -m "your change"
```

**Hook behavior:**

- ✅ Allows commit if no skipped tests
- ❌ Blocks commit if any `it.skip()` found
- 🔧 Bypass with `git commit --no-verify` (not recommended)

## Why This Matters

Skipped tests are technical debt that teams forget about. They represent:

- Unfinished functionality
- Potential production bugs
- Missing test coverage
- Edge cases that aren't handled

This automation ensures test debt is visible and addressed, not forgotten.

## Files Created for Tracking

- `dashboard-ui/TECHNICAL_DEBT.md` - Strategic overview
- `dashboard-ui/TODO_TESTS.md` - Specific issues and fixes
- `TEST_DEBT_SUMMARY.md` - Current status and metrics
- `CLAUDE.md` - Project-wide visibility

The goal: **Zero skipped tests in production.**
