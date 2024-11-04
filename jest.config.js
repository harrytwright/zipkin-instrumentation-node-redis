/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>'],
  globalSetup: '<rootDir>/jest/setup.js',
  // globalTeardown: '<rootDir>/_tests/teardown.ts',
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 85,
      lines: 85,
    }
  },
  coveragePathIgnorePatterns: [
    'node_modules',
    'jest',
  ]
}
