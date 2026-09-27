// Run before an existing browser fixture that assumes a fresh project.
async (page) => {
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await page.locator('.project-save-state strong').filter({ hasText: /^(Saved|Error)$/ }).waitFor({ timeout: 10000 });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('city-map-tools');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Could not clear the test database.'));
    request.onblocked = () => reject(new Error('Test database is blocked by an open connection.'));
  }));
  return { result: 'test database cleared' };
}
