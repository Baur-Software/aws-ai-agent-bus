export default {
  preset: 'default',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js', '.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  testMatch: [
    '**/test/**/*.test.mjs',
    '**/test/**/*.test.js',
    '**/test/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts'
  ]
};