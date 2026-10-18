import { isRecord } from '../features/featureModel';
import {
  createEmptyProjectDocument as createEmptyV1,
  decodeProjectDocument as decodeV1,
  decodeProjectDocumentBase,
  parseProjectDocumentJson as parseV1,
  PROJECT_DOCUMENT_MAX_TEXT_LENGTH as V1_MAX_TEXT_LENGTH,
  ProjectDocumentValidationError,
  type ProjectDocumentV1,
  type CreateEmptyProjectDocumentInput,
  type CreateProjectDocumentInput,
} from './projectDocumentV1';
import { cloneTrafficMovements, type TrafficMovementV2 } from './trafficMovement';

export * from './projectDocumentV1';
export const PROJECT_DOCUMENT_SCHEMA_VERSION = 2 as const;
export const PROJECT_DOCUMENT_MAX_TEXT_LENGTH = 2_500_000;
export const PROJECT_DOCUMENT_V1_MAX_TEXT_LENGTH = V1_MAX_TEXT_LENGTH;
export { decodeV1 as decodeProjectDocumentV1, parseV1 as parseProjectDocumentV1Json };

export interface ProjectDocumentV2 extends Omit<ProjectDocumentV1, 'schemaVersion'> {
  schemaVersion: 2;
  trafficMovements: Record<string, TrafficMovementV2>;
}

export interface CreateProjectDocumentV2Input extends CreateProjectDocumentInput {
  trafficMovements?: Readonly<Record<string, TrafficMovementV2>>;
}

function assertSize(text: string, limit: number): void {
  if (text.length > limit) {
    throw new ProjectDocumentValidationError(`Project document JSON exceeds the ${limit}-character limit; input was not parsed or truncated.`);
  }
}

export function decodeProjectDocument(value: unknown): ProjectDocumentV2 {
  if (!isRecord(value) || !Object.hasOwn(value, 'schemaVersion')) {
    throw new ProjectDocumentValidationError('schemaVersion: missing or invalid project version.');
  }
  if (value.schemaVersion === 1) {
    return { ...decodeV1(value), schemaVersion: 2, trafficMovements: Object.create(null) };
  }
  if (value.schemaVersion !== 2) {
    throw new ProjectDocumentValidationError('schemaVersion: unsupported or future schema version; upgrade City Map Tools before loading this file.');
  }
  if (!Object.hasOwn(value, 'trafficMovements')) {
    throw new ProjectDocumentValidationError('trafficMovements: missing required property.');
  }
  // All other fields pass the same strict geometry/provenance decoder.
  const { trafficMovements, ...base } = value;
  const decoded = decodeProjectDocumentBase({ ...base, schemaVersion: 1 }, PROJECT_DOCUMENT_MAX_TEXT_LENGTH);
  const document: ProjectDocumentV2 = {
    ...decoded, schemaVersion: 2,
    trafficMovements: cloneTrafficMovements(trafficMovements, decoded.features),
  };
  if (JSON.stringify(document).length > PROJECT_DOCUMENT_MAX_TEXT_LENGTH) {
    throw new ProjectDocumentValidationError(`project document: normalized serialized JSON exceeds the ${PROJECT_DOCUMENT_MAX_TEXT_LENGTH}-character limit; the document was rejected without truncation.`);
  }
  return document;
}

export function parseProjectDocumentJson(text: string): ProjectDocumentV2 {
  if (typeof text !== 'string') throw new ProjectDocumentValidationError('Project document JSON must be a string.');
  assertSize(text, PROJECT_DOCUMENT_MAX_TEXT_LENGTH);
  let value: unknown;
  try { value = JSON.parse(text) as unknown; }
  catch { throw new ProjectDocumentValidationError('Project document JSON is malformed; the current project was not changed.'); }
  if (isRecord(value) && value.schemaVersion === 1) assertSize(text, V1_MAX_TEXT_LENGTH);
  return decodeProjectDocument(value);
}

export function serializeProjectDocument(document: ProjectDocumentV2): string {
  return JSON.stringify(decodeProjectDocument(document));
}

export function createProjectDocument(input: CreateProjectDocumentV2Input): ProjectDocumentV2 {
  return decodeProjectDocument({
    format: 'city-map-tools-project', schemaVersion: 2, metadata: input.metadata,
    spatialReference: { crs: 'EPSG:4326', axisOrder: 'longitude-latitude', units: 'degrees' },
    layers: input.layers, features: input.features,
    presentation: { points: input.pointPresentations ?? Object.create(null) },
    trafficMovements: input.trafficMovements ?? Object.create(null),
  });
}

export function createEmptyProjectDocument(input: CreateEmptyProjectDocumentInput): ProjectDocumentV2 {
  return decodeProjectDocument(createEmptyV1(input));
}
