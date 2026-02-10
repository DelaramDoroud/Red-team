import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const resolvePath = (target) => path.join(dirname, target);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '#components': resolvePath('assets/components'),
      '#constants': resolvePath('assets/constants'),
      '#js': resolvePath('assets/js'),
      '#img': resolvePath('assets/img'),
      '#modules': resolvePath('assets/modules'),
      '#css': resolvePath('assets/css'),
      '#config': resolvePath('config'),
    },
  },
  define: {
    IS_REACT_ACT_ENVIRONMENT: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.globals.js', './vitest.setup.js'],
    pool: 'forks',
    maxThreads: 1,
    minThreads: 1,
    isolate: true,
    sequence: {
      concurrent: false,
    },
    watch: false,
  },
});
