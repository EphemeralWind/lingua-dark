import { defineConfig, type Plugin } from 'vitest/config';
import { validateBundled } from './src/content/validate';

/** Fails `vite build` (and dev-server start) when the content JSON is invalid (CLAUDE.md). */
function validateContentPlugin(): Plugin {
  return {
    name: 'lingua-dark:validate-content',
    buildStart() {
      const errors = validateBundled();
      if (errors.length > 0) this.error(`content validation failed:\n  ${errors.join('\n  ')}`);
    },
  };
}

export default defineConfig({
  plugins: [validateContentPlugin()],
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
