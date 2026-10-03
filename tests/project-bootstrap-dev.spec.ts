import { expect, test } from '@playwright/test';
import { parseProjectDocumentJson } from '../src/project/projectDocument';
import { readProjectRecords } from './project-browser-helpers';

test('development StrictMode startup creates one initial browser-local project', async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4336' || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  await page.goto('/');
  await expect(page.getByLabel('Current project name')).toHaveText('Untitled project', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  // Let the StrictMode effect replay and its IndexedDB transactions settle before inspecting the catalogue.
  await page.waitForTimeout(150);

  const records = await readProjectRecords(page);
  const projectKeys = Object.keys(records).filter(key => key.startsWith('project:'));
  expect(projectKeys).toHaveLength(1);
  expect(Object.keys(records).filter(key => key === 'active-project-id')).toHaveLength(1);
  expect(records['last-accepted-project']).toBeUndefined();

  const activeProjectId = records['active-project-id'];
  expect(activeProjectId).toBe(projectKeys[0].slice('project:'.length));
  const serialized = records[`project:${activeProjectId}`];
  expect(serialized).toEqual(expect.any(String));
  const document = parseProjectDocumentJson(serialized as string);
  expect(document.metadata.id).toBe(activeProjectId);
  expect(document.metadata.name).toBe('Untitled project');
});
