// jest.config.js
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/*.test.js'],  // Match any .test.js file
    testPathIgnorePatterns: ['/node_modules/', '/config/'],  // Ignore node_modules and config directories
    collectCoverage: true,
    coverageDirectory: 'coverage',
    testTimeout: 10000
  };