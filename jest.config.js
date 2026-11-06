export default {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['<rootDir>/testing/setup.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!main.ts',
    '!testing/**',
    '!database/migrations/**',
    '!database/seeds/**',
    '!database/cli/**',
  ],
  coverageDirectory: '../coverage',
};
