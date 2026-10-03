import { defineConfig } from '@playwright/test';

const previewUrl = 'http://127.0.0.1:4173/city-map-tools/';
const chromiumExecutable = process.env.CITY_MAP_TOOLS_CHROMIUM_EXECUTABLE;
export default defineConfig({
  globalTeardown: './tests/browser-smoke-teardown.mjs',
  testDir: './tests',
  testMatch: ['ci-browser-smoke.spec.ts', 'project-workflow-browser.spec.ts', 'geodesic-bundle-browser.spec.ts', 'snap-browser.spec.ts', 'provider-browser.spec.ts', 'directional-browser.spec.ts'],
  outputDir: './output/playwright/browser-smoke',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: previewUrl,
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: [
    {
      command: 'node tests/browser-smoke-server.mjs',
      url: previewUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  ],
});
