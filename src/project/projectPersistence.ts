import {
  parseProjectDocumentJson,
  serializeProjectDocument,
  type ProjectDocumentV1,
} from './projectDocument';

export interface ProjectStorageAdapter {
  load(): Promise<string | null>;
  save(serializedProject: string): Promise<void>;
}

export type ProjectStorageErrorCode = 'unavailable' | 'blocked' | 'open' | 'read' | 'invalid-record' | 'quota' | 'abort' | 'write';

export class ProjectStorageError extends Error {
  constructor(readonly code: ProjectStorageErrorCode) {
    super(`Project storage ${code} failure.`);
    this.name = 'ProjectStorageError';
  }
}

export interface PersistenceScheduler {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export type SaveState = 'Loading' | 'Saved' | 'Saving' | 'Unsaved' | 'Error';

export interface PersistenceStatus {
  state: SaveState;
  message: string;
}

const browserScheduler: PersistenceScheduler = {
  set: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: handle => window.clearTimeout(handle as number),
};

const ERROR_RECOVERY = 'Stored project could not be loaded. Autosave is paused to preserve the recovery record. This session is in memory only.';
const ERROR_READ = 'Project storage could not be read. Autosave is paused to preserve any recovery record. This session is in memory only.';
const ERROR_WRITE = 'Project could not be saved. Your current work remains in memory; another project edit will retry.';

function readErrorMessage(error: unknown): string {
  if (error instanceof ProjectStorageError) {
    if (error.code === 'invalid-record') return ERROR_RECOVERY;
    if (error.code === 'blocked') return 'Project storage is blocked by another tab. Close other City Map Tools tabs and reload; autosave is paused to preserve the recovery record.';
    if (error.code === 'unavailable') return 'IndexedDB is unavailable. Enable browser storage and reload; this session is in memory only.';
    if (error.code === 'open') return 'IndexedDB could not be opened. Check browser storage permissions and reload; autosave is paused to preserve the recovery record.';
    if (error.code === 'read') return 'IndexedDB project record could not be read. Reload after checking browser storage; autosave is paused to preserve the recovery record.';
  }
  return ERROR_READ;
}

function writeErrorMessage(error: unknown): string {
  if (error instanceof ProjectStorageError) {
    if (error.code === 'quota') return 'Browser storage quota was exceeded. Current work remains in memory; free browser storage before making another edit to retry.';
    if (error.code === 'blocked') return 'Project storage is blocked by another tab. Current work remains in memory; close the other tab before making another edit to retry.';
    if (error.code === 'abort') return 'Project storage transaction was aborted. Current work remains in memory; another edit will retry.';
    if (error.code === 'open') return 'IndexedDB could not be opened for saving. Current work remains in memory; check browser storage before making another edit to retry.';
    if (error.code === 'write') return 'IndexedDB project record could not be written. Current work remains in memory; another edit will retry.';
  }
  return ERROR_WRITE;
}

export class ProjectPersistence {
  private current: ProjectDocumentV1;
  private currentText: string;
  private savedText: string | null = null;
  private bootstrapPromise: Promise<ProjectDocumentV1> | null = null;
  private timer: unknown = null;
  private inFlight = false;
  private drainPromise: Promise<void> | null = null;
  private readyToWrite = false;
  private paused = false;
  private disposed = false;
  private readFailure: unknown = null;
  private writeFailure: unknown = null;
  private listeners = new Set<(status: PersistenceStatus) => void>();
  private status: PersistenceStatus = { state: 'Loading', message: 'Restoring the last saved project.' };

  constructor(
    initial: ProjectDocumentV1,
    private readonly storage: ProjectStorageAdapter,
    private readonly scheduler: PersistenceScheduler = browserScheduler,
  ) {
    this.current = initial;
    this.currentText = serializeProjectDocument(initial);
  }

  getStatus(): PersistenceStatus { return this.status; }
  getCurrent(): ProjectDocumentV1 { return this.current; }

  /** Adopt a record already read and strictly validated by the project catalogue. */
  restoreStored(serializedProject: string): ProjectDocumentV1 {
    if (this.bootstrapPromise) throw new Error('Project persistence has already been started.');
    const restored = parseProjectDocumentJson(serializedProject);
    if (restored.metadata.id !== this.current.metadata.id) {
      throw new Error('Stored Project Document id does not match its project-bound storage adapter.');
    }
    this.current = restored;
    this.currentText = serializedProject;
    this.savedText = serializedProject;
    this.bootstrapPromise = Promise.resolve(restored);
    this.report('Saved', 'Current project is saved.');
    return restored;
  }

  subscribe(listener: (status: PersistenceStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => { this.listeners.delete(listener); };
  }

  private report(state: SaveState, message: string): void {
    this.status = { state, message };
    for (const listener of this.listeners) listener(this.status);
  }

  bootstrap(): Promise<ProjectDocumentV1> {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = this.loadInitial();
    return this.bootstrapPromise;
  }

  private async loadInitial(): Promise<ProjectDocumentV1> {
    let stored: string | null;
    try {
      stored = await this.storage.load();
    } catch (error) {
      this.paused = true;
      this.readFailure = error;
      this.report('Error', readErrorMessage(error));
      return this.current;
    }

    if (stored === null) {
      this.report('Unsaved', 'New project has not been saved yet.');
      this.queueSave();
      return this.current;
    }

    try {
      // The adapter is an untrusted boundary even when TypeScript says string.
      this.current = parseProjectDocumentJson(stored);
      this.currentText = serializeProjectDocument(this.current);
      this.savedText = this.currentText;
      this.report('Saved', 'Last saved project restored.');
    } catch (error) {
      this.paused = true;
      this.readFailure = error;
      this.report('Error', ERROR_RECOVERY);
    }
    return this.current;
  }

  commit(document: ProjectDocumentV1): void {
    if (this.disposed) throw new Error('This project persistence session is closed.');
    if (!this.bootstrapPromise || this.status.state === 'Loading') {
      throw new Error('Project editing is unavailable until storage restoration finishes.');
    }
    const text = serializeProjectDocument(document);
    if (text === this.currentText) return;
    this.current = document;
    this.currentText = text;
    this.writeFailure = null;
    if (this.paused) return;
    this.report('Unsaved', 'Project edit is waiting to be saved.');
    this.queueSave();
  }

  private queueSave(): void {
    if (this.disposed || this.paused) return;
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.readyToWrite = false;
    this.timer = this.scheduler.set(() => {
      this.timer = null;
      this.readyToWrite = true;
      void this.writeReady().catch(() => undefined);
    }, 500);
  }

  private writeReady(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('This project persistence session is closed.'));
    if (this.paused) return Promise.reject(this.readFailure ?? new ProjectStorageError('read'));
    if (!this.readyToWrite) return Promise.resolve();
    if (this.drainPromise) return this.drainPromise;

    const draining = this.drainWrites();
    this.drainPromise = draining;
    void draining.then(
      () => this.finishDrain(draining),
      () => this.finishDrain(draining),
    );
    return draining;
  }

  private finishDrain(draining: Promise<void>): void {
    if (this.drainPromise !== draining) return;
    this.drainPromise = null;
    if (this.readyToWrite && !this.paused && !this.disposed) {
      void this.writeReady().catch(() => undefined);
    }
  }

  private async drainWrites(): Promise<void> {
    while (this.readyToWrite && !this.paused && !this.disposed) {
      this.readyToWrite = false;
      if (this.currentText === this.savedText) {
        this.report('Saved', 'Current project is saved.');
        continue;
      }
      const writing = this.currentText;
      this.inFlight = true;
      this.report('Saving', 'Saving the current project.');
      try {
        await this.storage.save(writing);
      } catch (error) {
        this.writeFailure = error;
        if (this.timer !== null) this.scheduler.clear(this.timer);
        this.timer = null;
        this.readyToWrite = false;
        this.report('Error', writeErrorMessage(error));
        throw error;
      } finally {
        this.inFlight = false;
      }
      this.savedText = writing;
      if (this.currentText === writing) {
        this.report('Saved', 'Current project is saved.');
      } else {
        this.report('Unsaved', 'A newer project edit is waiting to be saved.');
      }
    }
  }

  /** Persist the newest committed document and resolve only after its write transaction completes. */
  async flushNow(): Promise<void> {
    if (!this.bootstrapPromise || this.status.state === 'Loading') {
      throw new Error('Project storage is still loading. Wait for restoration before saving.');
    }
    if (this.disposed) throw new Error('This project persistence session is closed.');
    if (this.paused) throw this.readFailure ?? new ProjectStorageError('read');

    for (;;) {
      if (this.timer !== null) this.scheduler.clear(this.timer);
      this.timer = null;
      this.readyToWrite = false;
      if (this.drainPromise) await this.drainPromise;
      if (this.currentText === this.savedText && !this.inFlight) {
        this.report('Saved', 'Current project is saved.');
        return;
      }
      this.readyToWrite = true;
      try {
        await this.writeReady();
      } catch (error) {
        throw error;
      }
      if (this.paused) throw this.readFailure ?? this.writeFailure ?? new ProjectStorageError('write');
      if (this.currentText === this.savedText && !this.inFlight) {
        if (this.timer !== null) this.scheduler.clear(this.timer);
        this.timer = null;
        this.report('Saved', 'Current project is saved.');
        return;
      }
    }
  }

  /** Stop debounce/listener work after a successful project switch. */
  dispose(): void {
    if (this.timer !== null) this.scheduler.clear(this.timer);
    this.timer = null;
    this.readyToWrite = false;
    this.disposed = true;
    this.listeners.clear();
  }
}
