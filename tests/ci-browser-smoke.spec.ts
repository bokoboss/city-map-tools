import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readActiveProjectRecord, readProjectRecord, writeProjectRecord } from './project-browser-helpers';

const tileServerUrl = 'http://127.0.0.1:4175/tile.png';
const tileHost = 'tile.openstreetmap.org';

test('hosted app commits authored Point drags once and preserves history and recovery across reload', async ({ page, request }) => {
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  const unexpectedExternalRequests: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === tileHost && url.protocol === 'https:') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
      return;
    }
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.continue();
      return;
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
      return;
    }
    unexpectedExternalRequests.push(url.href);
    await route.abort();
  });

  const readStoredProject = async () => (await readActiveProjectRecord(page)).value;
  const pointCoordinates = (record: unknown, name: string): number[] => {
    expect(typeof record).toBe('string');
    const document = JSON.parse(record as string) as { features: Array<{ type: string; name: string; coordinates: number[] }> };
    const point = document.features.find(feature => feature.type === 'Point' && feature.name === name);
    expect(point).toBeDefined();
    return point!.coordinates;
  };
  const bufferStatus = (record: unknown): string | undefined => {
    expect(typeof record).toBe('string');
    const document = JSON.parse(record as string) as { features: Array<{ lineage: string; validationStatus: string }> };
    return document.features.find(feature => feature.lineage === 'derived')?.validationStatus;
  };
  const dragMarker = async (marker: ReturnType<typeof page.locator>, deltaX: number, deltaY: number) => {
    const box = await marker.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
    await page.mouse.up();
  };
  const dragMarkerBackToOrigin = async (marker: ReturnType<typeof page.locator>) => {
    const box = await marker.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 64, startY + 38, { steps: 8 });
    await page.mouse.move(startX, startY, { steps: 8 });
    await page.mouse.up();
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await expect(page).toHaveURL('http://127.0.0.1:4173/city-map-tools/');

  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width * 0.48, bounds!.y + bounds!.height * 0.48);
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');

  const undo = page.getByRole('button', { name: 'Undo project edit', exact: true });
  const redo = page.getByRole('button', { name: 'Redo project edit', exact: true });
  await expect(undo).toBeEnabled();
  const pointMarker = page.locator('.point-marker').first();
  const authoredBaselineRecord = await readStoredProject();
  const authoredBaselineCoordinates = pointCoordinates(authoredBaselineRecord, 'Point 1');

  // A click-sized gesture must remain a no-op: no timestamp or autosave and no
  // extra history entry before the authored Point creation.
  const markerBox = await pointMarker.boundingBox();
  expect(markerBox).not.toBeNull();
  await page.mouse.move(markerBox!.x + markerBox!.width / 2, markerBox!.y + markerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect(await readStoredProject()).toBe(authoredBaselineRecord);
  await undo.click();
  await expect(page.locator('.feature-row')).toHaveCount(0);
  await redo.click();
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await page.locator('.feature-row').first().click();

  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const projectBeforeDrag = await readStoredProject();
  const originalCoordinates = pointCoordinates(projectBeforeDrag, 'Point 1');
  const originalBufferStatus = bufferStatus(projectBeforeDrag);

  // A real drag that returns to the exact starting screen position remains a
  // no-op: no IndexedDB write, no history entry, and no buffer status change.
  await dragMarkerBackToOrigin(page.locator('.point-marker').first());
  await page.waitForTimeout(600);
  expect(await readStoredProject()).toBe(projectBeforeDrag);
  expect(bufferStatus(await readStoredProject())).toBe(originalBufferStatus);
  await undo.click();
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await redo.click();
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const projectBeforeDragAfterNoOp = await readStoredProject();

  // Destroying a controller during an active drag cancels the transaction and
  // leaves the last committed IndexedDB record byte-for-byte unchanged.
  const dragStartBox = await page.locator('.point-marker').first().boundingBox();
  expect(dragStartBox).not.toBeNull();
  const dragStartX = dragStartBox!.x + dragStartBox!.width / 2;
  const dragStartY = dragStartBox!.y + dragStartBox!.height / 2;
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragStartX + 80, dragStartY + 45, { steps: 8 });
  await expect(undo).toBeDisabled();
  await page.waitForTimeout(600);
  expect(await readStoredProject()).toBe(projectBeforeDragAfterNoOp);
  await page.getByRole('button', { name: 'Reload map', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await page.mouse.up();
  await expect(page.locator('.point-marker')).toHaveCount(1);
  await expect(undo).toBeEnabled();
  expect(await readStoredProject()).toBe(projectBeforeDragAfterNoOp);
  expect(pointCoordinates(await readStoredProject(), 'Point 1')).toEqual(originalCoordinates);

  // Repeated geographic marker positions stay draft-only until release.
  const authoredMarker = page.locator('.point-marker').first();
  const activeDragBox = await authoredMarker.boundingBox();
  expect(activeDragBox).not.toBeNull();
  const activeDragX = activeDragBox!.x + activeDragBox!.width / 2;
  const activeDragY = activeDragBox!.y + activeDragBox!.height / 2;
  await page.mouse.move(activeDragX, activeDragY);
  await page.mouse.down();
  await page.mouse.move(activeDragX + 55, activeDragY + 28, { steps: 4 });
  await page.mouse.move(activeDragX + 95, activeDragY + 50, { steps: 4 });
  await expect(undo).toBeDisabled();
  await page.waitForTimeout(600);
  expect(await readStoredProject()).toBe(projectBeforeDragAfterNoOp);
  const exportDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Points GeoJSON', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  const exportDownload = await exportDownloadPromise;
  const exportPath = await exportDownload.path();
  expect(exportPath).not.toBeNull();
  const exportedProject = JSON.parse(await readFile(exportPath!, 'utf8')) as {
    features: Array<{ properties: { name: string }; geometry: { coordinates: number[] } }>;
  };
  const exportedPoint = exportedProject.features.find(feature => feature.properties.name === 'Point 1');
  expect(exportedPoint).toBeDefined();
  expect(exportedPoint!.geometry.coordinates).toEqual(originalCoordinates);
  expect(await readStoredProject()).toBe(projectBeforeDragAfterNoOp);
  await expect(undo).toBeDisabled();
  await page.mouse.up();
  await expect(undo).toBeEnabled();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const movedRecord = await readStoredProject();
  const movedCoordinates = pointCoordinates(movedRecord, 'Point 1');
  expect(movedCoordinates).not.toEqual(originalCoordinates);
  expect(bufferStatus(movedRecord)).toBe('Stale');

  await undo.click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const undoneRecord = await readStoredProject();
  expect(pointCoordinates(undoneRecord, 'Point 1')).toEqual(originalCoordinates);
  expect(bufferStatus(undoneRecord)).toBe(originalBufferStatus);
  await redo.click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const redoneRecord = await readStoredProject();
  expect(pointCoordinates(redoneRecord, 'Point 1')).toEqual(movedCoordinates);
  expect(bufferStatus(redoneRecord)).toBe('Stale');

  // Imported Points stay fixed even though authored Points are draggable.
  const importedGeoJson = JSON.stringify({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { name: 'Imported control' }, geometry: { type: 'Point', coordinates: [100.5018, 13.7563] } }],
  });
  await page.locator('input[type=file]').evaluate((input, text) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'imported-point.geojson', { type: 'application/geo+json' }));
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, importedGeoJson);
  await expect(page.locator('.feature-row')).toHaveCount(3);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const importedBaselineRecord = await readStoredProject();
  const importedMarker = page.locator('.point-marker[aria-label="Select point Imported control"]');
  await expect(importedMarker).toHaveCount(1);
  await dragMarker(importedMarker, 65, 35);
  await page.waitForTimeout(600);
  expect(await readStoredProject()).toBe(importedBaselineRecord);
  expect(pointCoordinates(importedBaselineRecord, 'Imported control')).toEqual(pointCoordinates(await readStoredProject(), 'Imported control'));
  await undo.click();
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');

  // Switching out of Select makes existing authored markers fixed. Hiding a
  // Point also removes its marker; restoring visibility restores it.
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Point tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const modeBaselineRecord = await readStoredProject();
  await dragMarker(page.locator('.point-marker').first(), 70, 40);
  await page.waitForTimeout(600);
  expect(await readStoredProject()).toBe(modeBaselineRecord);
  await page.getByRole('button', { name: 'Select tool', exact: true }).click();
  const pointVisibility = page.locator('.feature-visibility').first();
  await pointVisibility.click();
  await expect(page.locator('.point-marker')).toHaveCount(0);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await pointVisibility.click();
  await expect(page.locator('.point-marker')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const finalSavedRecord = await readStoredProject();

  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Select tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Point tool', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Feature inspector' })).toHaveCount(0);
  const reloadedRecord = await readStoredProject();
  expect(reloadedRecord).toBe(finalSavedRecord);
  expect(pointCoordinates(reloadedRecord, 'Point 1')).toEqual(movedCoordinates);
  expect(bufferStatus(reloadedRecord)).toBe('Stale');
  const savedRecord = await readStoredProject();
  expect(typeof savedRecord).toBe('string');
  const corruptRecords = [
    '{corrupt project',
    JSON.stringify({ ...(JSON.parse(savedRecord as string) as object), schemaVersion: 2 }),
  ];
  for (const invalidRecord of corruptRecords) {
    const recoveryProjectId = (await readActiveProjectRecord(page)).projectId;
    await writeProjectRecord(page, `project:${recoveryProjectId}`, invalidRecord);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Browser-local project recovery' })).toBeVisible();
    await expect(page.locator('.project-recovery-panel')).toContainText(/not overwritten or deleted/i);
    expect(await readProjectRecord(page, `project:${recoveryProjectId}`)).toBe(invalidRecord);
    await page.getByLabel('New local project name', { exact: true }).fill('Recovery project');
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await expect(page.getByLabel('Current project name')).toHaveText('Recovery project');
    await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
    expect((await readActiveProjectRecord(page)).projectId).not.toBe(recoveryProjectId);
    expect(await readProjectRecord(page, `project:${recoveryProjectId}`)).toBe(invalidRecord);
  }

  expect(unexpectedExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleProblems).toEqual([]);
});
