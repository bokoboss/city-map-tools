import { ProjectStorageError, type ProjectStorageAdapter } from './projectPersistence';
import {
  ACTIVE_PROJECT_ID_KEY,
  LEGACY_PROJECT_RECORD_KEY,
  PROJECT_RECORD_PREFIX,
  projectRecordKey,
  type ProjectCatalogStorageAdapter,
} from './projectCatalog';

export const PROJECT_DATABASE_NAME = 'city-map-tools';
export const PROJECT_DATABASE_VERSION = 1;
export const PROJECT_STORE_NAME = 'project-state';
// Kept as a named compatibility constant for #5C fixtures. Runtime writes use
// projectRecordKey(projectId), and legacy code only reads this key for migration.
export const PROJECT_RECORD_KEY = LEGACY_PROJECT_RECORD_KEY;

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
  private readonly key: string;

  constructor(projectId: string) {
    this.key = projectRecordKey(projectId);
  }

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
          const request = store.get(this.key);
          const count = store.count(this.key);
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
          const request = transaction.objectStore(PROJECT_STORE_NAME).put(serializedProject, this.key);
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

export class IndexedDbProjectCatalogStorage implements ProjectCatalogStorageAdapter {
  async readAll(): Promise<ReadonlyMap<string, unknown>> {
    const database = await openDatabase();
    try {
      return await new Promise<ReadonlyMap<string, unknown>>((resolve, reject) => {
        const records = new Map<string, unknown>();
        let transaction: IDBTransaction;
        try {
          transaction = database.transaction(PROJECT_STORE_NAME, 'readonly');
          const request = transaction.objectStore(PROJECT_STORE_NAME).openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            if (typeof cursor.key === 'string') records.set(cursor.key, cursor.value);
            cursor.continue();
          };
        } catch {
          reject(new ProjectStorageError('read'));
          return;
        }
        transaction.oncomplete = () => resolve(records);
        transaction.onerror = () => reject(transactionError(transaction));
        transaction.onabort = () => reject(transactionError(transaction));
      });
    } finally {
      database.close();
    }
  }

  async migrateLegacy(serializedProject: string, projectId: string): Promise<boolean> {
    const database = await openDatabase();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        let transaction: IDBTransaction;
        let migrated = false;
        let unchanged = true;
        try {
          transaction = database.transaction(PROJECT_STORE_NAME, 'readwrite');
          const store = transaction.objectStore(PROJECT_STORE_NAME);
          const keysRequest = store.getAllKeys();
          const recordRequest = store.get(LEGACY_PROJECT_RECORD_KEY);
          const recordCountRequest = store.count(LEGACY_PROJECT_RECORD_KEY);
          let keysReady = false;
          let recordReady = false;
          let countReady = false;
          const commitMigration = () => {
            if (!keysReady || !recordReady || !countReady || !unchanged) return;
            unchanged = false;
            const hasProject = keysRequest.result.some(key =>
              typeof key === 'string' && key.startsWith(PROJECT_RECORD_PREFIX));
            if (hasProject || recordCountRequest.result === 0 || recordRequest.result !== serializedProject) return;
            const legacy = recordRequest.result;
            if (typeof legacy !== 'string') return;
            store.add(legacy, projectRecordKey(projectId));
            store.put(projectId, ACTIVE_PROJECT_ID_KEY);
            store.delete(LEGACY_PROJECT_RECORD_KEY);
            migrated = true;
          };
          keysRequest.onsuccess = () => { keysReady = true; commitMigration(); };
          recordRequest.onsuccess = () => { recordReady = true; commitMigration(); };
          recordCountRequest.onsuccess = () => { countReady = true; commitMigration(); };
          keysRequest.onerror = () => { unchanged = false; };
          recordRequest.onerror = () => { unchanged = false; };
          recordCountRequest.onerror = () => { unchanged = false; };
        } catch {
          reject(new ProjectStorageError('write'));
          return;
        }
        transaction.oncomplete = () => resolve(migrated);
        transaction.onerror = () => reject(transactionError(transaction));
        transaction.onabort = () => reject(transactionError(transaction));
      });
    } finally {
      database.close();
    }
  }

  async createAndActivate(projectId: string, serializedProject: string): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        let transaction: IDBTransaction;
        try {
          transaction = database.transaction(PROJECT_STORE_NAME, 'readwrite');
          const store = transaction.objectStore(PROJECT_STORE_NAME);
          store.add(serializedProject, projectRecordKey(projectId));
          store.put(projectId, ACTIVE_PROJECT_ID_KEY);
        } catch {
          reject(new ProjectStorageError('write'));
          return;
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transactionError(transaction));
        transaction.onabort = () => reject(transactionError(transaction));
      });
    } finally {
      database.close();
    }
  }

  async activateProject(projectId: string, expectedSerializedProject: string): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        let transaction: IDBTransaction;
        let recordChanged = false;
        try {
          transaction = database.transaction(PROJECT_STORE_NAME, 'readwrite');
          const store = transaction.objectStore(PROJECT_STORE_NAME);
          const request = store.get(projectRecordKey(projectId));
          request.onsuccess = () => {
            if (request.result !== expectedSerializedProject) {
              recordChanged = true;
              transaction.abort();
              return;
            }
            store.put(projectId, ACTIVE_PROJECT_ID_KEY);
          };
        } catch {
          reject(new ProjectStorageError('write'));
          return;
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(recordChanged
          ? new ProjectStorageError('invalid-record')
          : transactionError(transaction));
        transaction.onabort = () => reject(recordChanged
          ? new ProjectStorageError('invalid-record')
          : transactionError(transaction));
      });
    } finally {
      database.close();
    }
  }
}
