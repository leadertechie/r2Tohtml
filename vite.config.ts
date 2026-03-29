import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'r2tohtml',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@leadertechie/md2html'],
    },
    minify: false,
    sourcemap: true,
  },
});
