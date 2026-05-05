module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'jest-)?react-native' +
      '|@react-native(-community)?' +
      '|expo(nent)?|@expo(nent)?/.*' +
      '|@expo-google-fonts/.*' +
      '|react-clone-referenced-element' +
      '|@react-navigation' +
      '|@unimodules/.*|unimodules' +
      '|sentry-expo' +
      '|native-base' +
      '|react-native-svg' +
      '|@supabase/.*' +
      ')/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/services/supabase/types.gen.ts',
  ],
};
