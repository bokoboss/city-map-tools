import {
  createEmptyProjectDocument,
  parseProjectDocumentJson,
  serializeProjectDocument,
  type ProjectDocumentV1,
} from './projectDocument';

export const LEGACY_PROJECT_RECORD_KEY = 'last-accepted-project';
export const ACTIVE_PROJECT_ID_KEY = 'active-project-id';
export const PROJECT_RECORD_PREFIX = 'project:';

export function projectRecordKey(projectId: string): string {
  return `${PROJECT_RECORD_PREFIX}${projectId}`;
}

export interface ProjectCatalogStorageAdapter {
  readAll(): Promise<ReadonlyMap<string, unknown>>;
  /** Copy the validated legacy text, set the active pointer, and delete the legacy key in one transaction. */
  migrateLegacy(serializedProject: string, projectId: string): Promise<boolean>;
  /** Add a project record and set the active pointer in one transaction. */
  createAndActivate(projectId: string, serializedProject: string): Promise<void>;
  /** Recheck the validated record, then set the active pointer in one transaction. */
  activateProject(projectId: string, expectedSerializedProject: string): Promise<void>;
}

export interface ProjectCatalogItem {
  id: string;
  name: string;
  openable: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  message?: string;
}

export interface StoredProject {
  document: ProjectDocumentV1;
  serialized: string;
  projects: ProjectCatalogItem[];
  activeProjectId: string;
  legacyRecordPresent: boolean;
}

export type ProjectCatalogBootstrap =
  | ({ kind: 'ready' } & StoredProject & { warnings: string[] })
  | {
    kind: 'recovery';
    message: string;
    projects: ProjectCatalogItem[];
    activeProjectId: string | null;
    legacyRecordPresent: boolean;
    recoveryRecordId: string | null;
  };

export class ProjectCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectCatalogError';
  }
}

export interface ProjectCatalogIdentity {
  createId: () => string;
  now: () => string;
}

const browserIdentity: ProjectCatalogIdentity = {
  createId: () => globalThis.crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

function documentFromRecord(projectId: string, value: unknown): { document: ProjectDocumentV1; serialized: string } {
  if (typeof value !== 'string') {
    throw new ProjectCatalogError(`Stored project "${projectId}" is not a Project Document v1 JSON string.`);
  }
  let document: ProjectDocumentV1;
  try {
    document = parseProjectDocumentJson(value);
  } catch (error) {
    throw new ProjectCatalogError(error instanceof Error ? error.message : 'Stored project could not be validated.');
  }
  if (document.metadata.id !== projectId) {
    throw new ProjectCatalogError(`Stored project key "${projectRecordKey(projectId)}" does not match its document id.`);
  }
  return { document, serialized: value };
}

function projectItems(records: ReadonlyMap<string, unknown>, activeProjectId: string | null): ProjectCatalogItem[] {
  const result: ProjectCatalogItem[] = [];
  for (const [key, value] of records) {
    if (!key.startsWith(PROJECT_RECORD_PREFIX)) continue;
    const id = key.slice(PROJECT_RECORD_PREFIX.length);
    try {
      const { document } = documentFromRecord(id, value);
      result.push({
        id,
        name: document.metadata.name,
        openable: true,
        active: id === activeProjectId,
        createdAt: document.metadata.createdAt,
        updatedAt: document.metadata.updatedAt,
      });
    } catch (error) {
      result.push({
        id: id || '(missing project id)',
        name: id ? `Unavailable project (${id})` : 'Unavailable project record',
        openable: false,
        active: id !== '' && id === activeProjectId,
        message: error instanceof Error ? error.message : 'Stored project could not be validated.',
      });
    }
  }
  result.sort((left, right) =>
    (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id));
  return result;
}

function readyFromStored(
  records: ReadonlyMap<string, unknown>,
  activeProjectId: string,
): ProjectCatalogBootstrap {
  const stored = documentFromRecord(activeProjectId, records.get(projectRecordKey(activeProjectId)));
  const legacyRecordPresent = records.has(LEGACY_PROJECT_RECORD_KEY);
  const projects = projectItems(records, activeProjectId);
  const warnings = projects.some(project => !project.openable)
    ? ['One or more local project records could not be read. They were not overwritten or deleted.']
    : [];
  if (legacyRecordPresent) {
    warnings.push('A legacy recovery record remains in browser storage and was left untouched.');
  }
  return {
    kind: 'ready',
    ...stored,
    projects,
    activeProjectId,
    legacyRecordPresent,
    warnings,
  };
}

function recovery(
  message: string,
  records: ReadonlyMap<string, unknown>,
  recoveryRecordId: string | null,
): ProjectCatalogBootstrap {
  const rawActive = records.get(ACTIVE_PROJECT_ID_KEY);
  return {
    kind: 'recovery',
    message,
    projects: projectItems(records, typeof rawActive === 'string' ? rawActive : null),
    activeProjectId: typeof rawActive === 'string' ? rawActive : null,
    legacyRecordPresent: records.has(LEGACY_PROJECT_RECORD_KEY),
    recoveryRecordId,
  };
}

export class ProjectCatalog {
  constructor(
    private readonly storage: ProjectCatalogStorageAdapter,
    private readonly identity: ProjectCatalogIdentity = browserIdentity,
  ) {}

  async bootstrap(): Promise<ProjectCatalogBootstrap> {
    // A concurrent tab is not an accepted editing workflow, but re-reading a
    // changed snapshot once keeps migration fail-preserving if one appears.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const records = await this.storage.readAll();
      const projectKeys = [...records.keys()].filter(key => key.startsWith(PROJECT_RECORD_PREFIX));
      if (projectKeys.length > 0) {
        const rawActive = records.get(ACTIVE_PROJECT_ID_KEY);
        if (typeof rawActive !== 'string' || rawActive.length === 0) {
          return recovery(
            'The active local project could not be identified. Existing project records were not overwritten or deleted. Open a readable project or start a new local project while preserving the recovery records.',
            records,
            typeof rawActive === 'string' ? rawActive : null,
          );
        }
        try {
          return readyFromStored(records, rawActive);
        } catch (error) {
          const entry = projectItems(records, rawActive).find(item => item.id === rawActive);
          return recovery(
            `The active project could not be read${error instanceof Error ? `: ${error.message}` : '.'} Its stored record was not overwritten or deleted. Open a readable project or start a new local project while preserving the recovery record.`,
            records,
            entry && !entry.openable ? rawActive : null,
          );
        }
      }

      if (records.has(LEGACY_PROJECT_RECORD_KEY)) {
        const legacy = records.get(LEGACY_PROJECT_RECORD_KEY);
        if (typeof legacy !== 'string') {
          return recovery(
            'The legacy recovery record is not a Project Document v1 JSON string. It was not overwritten or deleted. You can start a new local project while preserving this recovery record.',
            records,
            null,
          );
        }
        let document: ProjectDocumentV1;
        try {
          document = parseProjectDocumentJson(legacy);
        } catch (error) {
          return recovery(
            `The legacy recovery record could not be read${error instanceof Error ? `: ${error.message}` : '.'} It was not overwritten or deleted. You can start a new local project while preserving this recovery record.`,
            records,
            null,
          );
        }
        const migrated = await this.storage.migrateLegacy(legacy, document.metadata.id);
        if (!migrated) continue;
        const migratedRecords = new Map<string, unknown>([
          [projectRecordKey(document.metadata.id), legacy],
          [ACTIVE_PROJECT_ID_KEY, document.metadata.id],
        ]);
        return readyFromStored(migratedRecords, document.metadata.id);
      }

      if (records.has(ACTIVE_PROJECT_ID_KEY)) {
        return recovery(
          'The active-project pointer refers to a project that is not present. Existing browser-local records were not overwritten or deleted. You can start a new local project; the pointer will change only after the new project is stored.',
          records,
          null,
        );
      }

      const created = this.makeProject('Untitled project');
      await this.storage.createAndActivate(created.document.metadata.id, created.serialized);
      const createdRecords = new Map<string, unknown>([
        [projectRecordKey(created.document.metadata.id), created.serialized],
        [ACTIVE_PROJECT_ID_KEY, created.document.metadata.id],
      ]);
      return readyFromStored(createdRecords, created.document.metadata.id);
    }

    throw new ProjectCatalogError('Project storage changed during startup. Reload to retry without changing its records.');
  }

  async createProject(name: string, flushCurrent?: () => Promise<void>): Promise<StoredProject> {
    if (flushCurrent) await flushCurrent();
    const records = await this.storage.readAll();
    const created = this.makeProject(name);
    const id = created.document.metadata.id;
    if (records.has(projectRecordKey(id))) {
      throw new ProjectCatalogError('A project with the generated id already exists. No stored project was changed. Try again.');
    }
    await this.storage.createAndActivate(id, created.serialized);
    const updatedRecords = new Map(records);
    updatedRecords.set(projectRecordKey(id), created.serialized);
    updatedRecords.set(ACTIVE_PROJECT_ID_KEY, id);
    return {
      ...created,
      projects: projectItems(updatedRecords, id),
      activeProjectId: id,
      legacyRecordPresent: updatedRecords.has(LEGACY_PROJECT_RECORD_KEY),
    };
  }

  async openProject(projectId: string, flushCurrent?: () => Promise<void>): Promise<StoredProject> {
    if (flushCurrent) await flushCurrent();
    const records = await this.storage.readAll();
    const { document, serialized } = documentFromRecord(projectId, records.get(projectRecordKey(projectId)));
    await this.storage.activateProject(projectId, serialized);
    return {
      document,
      serialized,
      projects: projectItems(records, projectId),
      activeProjectId: projectId,
      legacyRecordPresent: records.has(LEGACY_PROJECT_RECORD_KEY),
    };
  }

  async listProjects(activeProjectId: string | null): Promise<{ projects: ProjectCatalogItem[]; legacyRecordPresent: boolean }> {
    const records = await this.storage.readAll();
    return {
      projects: projectItems(records, activeProjectId),
      legacyRecordPresent: records.has(LEGACY_PROJECT_RECORD_KEY),
    };
  }

  private makeProject(name: string): { document: ProjectDocumentV1; serialized: string } {
    const projectName = name.trim().length > 0 ? name : 'Untitled project';
    const createdAt = this.identity.now();
    const document = createEmptyProjectDocument({
      id: this.identity.createId(),
      createdAt,
      name: projectName,
    });
    return { document, serialized: serializeProjectDocument(document) };
  }
}
