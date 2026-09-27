import { ProjectStorageError, type ProjectStorageAdapter } from './projectPersistence';

export const PROJECT_DATABASE_NAME = 'city-map-tools';
export const PROJECT_DATABASE_VERSION = 1;
export const PROJECT_STORE_NAME = 'project-state';
export const PROJECT_RECORD_KEY = 'last-accepted-project';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new ProjectStorageError('unavailable'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(PROJECT_DATABASE_NAME, PROJECT_DATABASE_VERSION);
    } catch {
      reject(new ProjectStorageError('open'));
      return;
    }
    let settled = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE_NAME)) {
        database.createObjectStore(PROJECT_STORE_NAME);
      }
    };
    request.onblocked = () => {
      settled = true;
      reject(new ProjectStorageError('blocked'));
    };
    request.onerror = () => {
      settled = true;
      reject(new ProjectStorageError('open'));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (settled) database.close();
      else resolve(database);
    };
  });
}

function transactionError(transaction: IDBTransaction, requestError?: DOMException | null): ProjectStorageError {
  return requestError?.name === 'QuotaExceededError' || transaction.error?.name === 'QuotaExceededError'
    ? new ProjectStorageError('quota')
    : new ProjectStorageError('abort');
}

export class IndexedDbProjectStorage implements ProjectStorageAdapter {
  async load(): Promise<string | null> {
    const database = await openDatabase();
    try {
      return await new Promise<string | null>((resolve, reject) => {
        let value: unknown;
        let exists = false;
        let transaction: IDBTransaction;
        try {
          transaction = database.transaction(PROJECT_STORE_NAME, 'readonly');
          const store = transaction.objectStore(PROJECT_STORE_NAME);
          const request = store.get(PROJECT_RECORD_KEY);
          const count = store.count(PROJECT_RECORD_KEY);
          request.onsuccess = () => { value = request.result; };
          count.onsuccess = () => { exists = count.result > 0; };
        } catch {
          reject(new ProjectStorageError('read'));
          return;
        }
        transaction.oncomplete = () => {
          if (!exists) resolve(null);
          else if (typeof value === 'string') resolve(value);
          else reject(new ProjectStorageError('invalid-record'));
        };
        transaction.onerror = () => reject(transactionError(transaction));
        transaction.onabort = () => reject(transactionError(transaction));
      });
    } finally {
      database.close();
    }
  }

  async save(serializedProject: string): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        let transaction: IDBTransaction;
        let requestError: DOMException | null = null;
        try {
          transaction = database.transaction(PROJECT_STORE_NAME, 'readwrite');
          const request = transaction.objectStore(PROJECT_STORE_NAME).put(serializedProject, PROJECT_RECORD_KEY);
          request.onerror = () => { requestError = request.error; };
        } catch {
          reject(new ProjectStorageError('write'));
          return;
        }
        // A successful put request is not durable until its transaction completes.
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transactionError(transaction, requestError));
        transaction.onabort = () => reject(transactionError(transaction, requestError));
      });
    } finally {
      database.close();
    }
  }
}
