import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const parsedProjectPort = Number.parseInt(process.env.PROJECT_PORT || '', 10);
const projectPort = Number.isNaN(parsedProjectPort) ? 3002 : parsedProjectPort;

const resolvePath = (target) => path.join(dirname, target);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: projectPort,
  },
  preview: {
    host: '0.0.0.0',
    port: projectPort,
  },
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
});
