import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './'),
      '#components': path.resolve(dirname, './assets/components'),
      '#img': path.resolve(dirname, './assets/img'),
      '#js': path.resolve(dirname, './assets/js'),
      '#modules': path.resolve(dirname, './assets/modules'),
      '#scss': path.resolve(dirname, './assets/scss'),
      '#config': path.resolve(dirname, './config'),
      '#lib': path.resolve(dirname, './lib'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
  },
});
