import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Pure-logic modules must not touch the browser (CLAUDE.md, Architecture rules).
const PURE_DIRS = ['src/combat/**', 'src/content/**', 'src/learning/**', 'src/save/**'];
const BROWSER_GLOBALS = ['window', 'document', 'performance', 'navigator', 'localStorage', 'requestAnimationFrame'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in src/content/rng.ts.' },
      ],
    },
  },
  {
    files: PURE_DIRS,
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({ name, message: 'Pure-logic modules must not touch the browser.' })),
      ],
    },
  },
  {
    // Tests index into fixtures they just built; non-null assertions are fine there.
    files: ['**/*.test.ts', 'e2e/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
