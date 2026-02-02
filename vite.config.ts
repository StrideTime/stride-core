import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      tsconfigPath: './tsconfig.json',
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'StrideCore',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@stridetime/db'],
      output: {
        globals: {
          '@stridetime/db': 'StrideDb',
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
