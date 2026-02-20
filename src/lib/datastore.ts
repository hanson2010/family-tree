import { Datastore, PropertyFilter, and } from '@google-cloud/datastore';

// Lazy-initialized Datastore client
// In development, uses GOOGLE_APPLICATION_CREDENTIALS env variable
// In production on Cloud Run, uses default service account
let datastoreInstance: Datastore | null = null;

function getDatastore(): Datastore {
  if (!datastoreInstance) {
    datastoreInstance = new Datastore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return datastoreInstance;
}

// Entity kinds
export const KINDS = {
  USER: 'User',
  PERSON: 'Person',
  RELATIONSHIP: 'Relationship',
} as const;

// Helper functions for Datastore operations
export async function getEntity<T>(kind: string, id: string): Promise<T | null> {
  const datastore = getDatastore();
  const key = datastore.key([kind, id]);
  const [entity] = await datastore.get(key);
  return entity as T | null;
}

export async function saveEntity<T extends { id: string }>(kind: string, entity: T): Promise<void> {
  const datastore = getDatastore();
  const key = datastore.key([kind, entity.id]);
  await datastore.save({
    key,
    data: entity,
    excludeFromIndexes: getExcludedProperties(kind),
  });
}

export async function deleteEntity(kind: string, id: string): Promise<void> {
  const datastore = getDatastore();
  const key = datastore.key([kind, id]);
  await datastore.delete(key);
}

export async function queryEntities<T>(
  kind: string,
  filters?: Array<{ property: string; operator: '=' | '<' | '>' | '<=' | '>='; value: unknown }>
): Promise<T[]> {
  const datastore = getDatastore();
  let query = datastore.createQuery(kind);

  if (filters && filters.length > 0) {
    const propertyFilters = filters.map(
      (f) => new PropertyFilter(f.property, f.operator, f.value)
    );
    query = query.filter(propertyFilters.length === 1 ? propertyFilters[0] : and(propertyFilters));
  }

  const [entities] = await datastore.runQuery(query);
  return entities as T[];
}

export async function queryEntitiesByProperty<T>(
  kind: string,
  property: string,
  value: unknown
): Promise<T[]> {
  const datastore = getDatastore();
  const query = datastore.createQuery(kind).filter(new PropertyFilter(property, '=', value));
  const [entities] = await datastore.runQuery(query);
  return entities as T[];
}

// Properties to exclude from indexing (for large fields like avatar)
function getExcludedProperties(kind: string): string[] {
  switch (kind) {
    case KINDS.PERSON:
      return ['avatar', 'notes'];
    default:
      return [];
  }
}

// Export the getter for advanced use cases
export { getDatastore };
export default getDatastore;
