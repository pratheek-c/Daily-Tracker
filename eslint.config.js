import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // `android/app/build` holds Gradle's generated output (including a vendored
    // `native-bridge.js` that is not ours to lint); it is gitignored but ESLint
    // does not read .gitignore.
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      '.npm-cache',
      'coverage',
      '.tmp',
      'android/app/build',
      'android/build',
      'android/.gradle',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // The service worker is browser JavaScript, so it gets browser globals plus
    // the service-worker flavour of `self`.
    files: ['src/sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // These modules intentionally export a provider or router object alongside
    // helper values; Fast Refresh does not apply to app-entry modules.
    files: ['src/app/router.tsx', 'src/app/AppContext.tsx', 'src/app/CloudContext.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
)
