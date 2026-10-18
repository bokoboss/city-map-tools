import { defineConfig } from 'vite';

export default defineConfig({
  base: '/city-map-tools/',
  build: {
    lib: { entry: 'tests/project-v2-fixture.ts', formats: ['es'], fileName: '__project_v2_probe' },
    outDir: 'dist', emptyOutDir: false,
  },
});
