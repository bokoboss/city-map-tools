import type { Page } from '@playwright/test';

export interface ActiveProjectRecord {
  projectId: string;
  value: unknown;
}

export async function readProjectRecord(page: Page, key: string): Promise<unknown> {
  return page.evaluate(recordKey => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('Could not open the project database.'));
    request.onsuccess = () => {
      const database = request.result;
      let value: unknown;
      const transaction = database.transaction('project-state', 'readonly');
      const get = transaction.objectStore('project-state').get(recordKey);
      get.onsuccess = () => { value = get.result; };
      transaction.onerror = () => reject(new Error('Could not read the project record.'));
      transaction.onabort = () => reject(new Error('Project record read was aborted.'));
      transaction.oncomplete = () => { database.close(); resolve(value); };
    };
  }), key);
}

export async function readActiveProjectRecord(page: Page): Promise<ActiveProjectRecord> {
  return page.evaluate(() => new Promise<ActiveProjectRecord>((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('Could not open the project database.'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('project-state', 'readonly');
      const store = transaction.objectStore('project-state');
      let projectId: string | null = null;
      let value: unknown;
      store.get('active-project-id').onsuccess = event => {
        const activeId = (event.target as IDBRequest).result;
        if (typeof activeId !== 'string') return;
        projectId = activeId;
        store.get(`project:${activeId}`).onsuccess = projectEvent => {
          value = (projectEvent.target as IDBRequest).result;
        };
      };
      transaction.onerror = () => reject(new Error('Could not read the active project.'));
      transaction.onabort = () => reject(new Error('Active project read was aborted.'));
      transaction.oncomplete = () => {
        database.close();
        if (projectId === null) reject(new Error('There is no active project id.'));
        else resolve({ projectId, value });
      };
    };
  }));
}

export async function readProjectRecords(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => new Promise<Record<string, unknown>>((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('Could not open the project database.'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('project-state', 'readonly');
      const records: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      const cursorRequest = transaction.objectStore('project-state').openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (typeof cursor.key === 'string') {
          Object.defineProperty(records, cursor.key, {
            value: cursor.value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
        cursor.continue();
      };
      transaction.onerror = () => reject(new Error('Could not enumerate project records.'));
      transaction.onabort = () => reject(new Error('Project catalogue read was aborted.'));
      transaction.oncomplete = () => { database.close(); resolve(records); };
    };
  }));
}

export async function writeProjectRecord(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(({ recordKey, recordValue }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('Could not open the project database for a fixture.'));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('project-state')) request.result.createObjectStore('project-state');
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('project-state', 'readwrite');
      transaction.objectStore('project-state').put(recordValue, recordKey);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(new Error('Could not write the project fixture.'));
      transaction.onabort = () => reject(new Error('Project fixture write was aborted.'));
    };
  }), { recordKey: key, recordValue: value });
}

export async function writeLegacyProjectRecord(page: Page, value: unknown): Promise<void> {
  await writeProjectRecord(page, 'last-accepted-project', value);
}
