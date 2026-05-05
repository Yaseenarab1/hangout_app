/**
 * Babel configuration.
 *
 * - babel-preset-expo: required by Expo (handles JSX, TS, RN-specific transforms).
 * - module-resolver: lets us write `import { Button } from '@/components/ui'` instead of
 *   `import { Button } from '../../../components/ui'`.
 * - react-native-reanimated/plugin: REQUIRED by Reanimated 3. MUST be last.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            // The @ alias maps to the src/ folder.
            // Anything inside src/ — including src/config/, src/components/, etc. —
            // is reached as @/<subpath>. So @/config/app.config -> src/config/app.config.ts
            '@': './src',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // KEEP THIS LAST. Reanimated requirement.
      'react-native-reanimated/plugin',
    ],
  };
};
