module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.mjs', '**/test/**/*.test.js'],
  transform: {},
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov'],
  forceExit: true,
  detectOpenHandles: true
};
