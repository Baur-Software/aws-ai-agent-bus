module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.mjs', '**/test/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov']
};
