import { defineConfig } from '@playwright/test';

const chromiumExecutable = process.env.CITY_MAP_TOOLS_CHROMIUM_EXECUTABLE;

export default defineConfig({
  globalTeardown: './tests/project-bootstrap-dev-teardown.mjs',
  testDir: './tests',
  testMatch: ['project-bootstrap-dev.spec.ts'],
  outputDir: './output/playwright/project-bootstrap-dev',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:4336/city-map-tools/',
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'node tests/project-bootstrap-dev-server.mjs',
    url: 'http://127.0.0.1:4336/city-map-tools/',
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
