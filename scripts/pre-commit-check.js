#!/usr/bin/env node

/**
 * Pre-commit hook to prevent commits with skipped tests
 * Add to .git/hooks/pre-commit or use with husky
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function checkForSkippedTests() {
  const testFiles = [
    'dashboard-ui/src/components/__tests__/**/*.test.tsx',
    'dashboard-ui/src/components/__tests__/**/*.test.ts'
  ];

  let hasSkippedTests = false;
  const skippedTests = [];

  // Check for .skip in test files
  try {
    const grepResult = execSync(
      `grep -r "it\\.skip\\|describe\\.skip\\|test\\.skip" dashboard-ui/src/components/__tests__/ || true`,
      { encoding: 'utf-8' }
    );

    if (grepResult.trim()) {
      hasSkippedTests = true;
      skippedTests.push(...grepResult.trim().split('\n'));
    }
  } catch (error) {
    console.warn('Could not check for skipped tests:', error.message);
  }

  if (hasSkippedTests) {
    console.error('\n🚨 COMMIT BLOCKED: Skipped tests detected!\n');
    console.error('The following tests are skipped:');
    skippedTests.forEach(test => console.error(`  - ${test}`));
    console.error('\nSkipped tests represent unfinished work and potential production bugs.');
    console.error('Please fix these tests before committing.');
    console.error('\nSee dashboard-ui/TODO_TESTS.md for details on fixing these issues.\n');
    process.exit(1);
  }

  console.log('✅ No skipped tests found - commit allowed');
}

// Only run check if we're in the correct directory and have test files
if (fs.existsSync('dashboard-ui') && fs.existsSync('dashboard-ui/src/components/__tests__')) {
  checkForSkippedTests();
}