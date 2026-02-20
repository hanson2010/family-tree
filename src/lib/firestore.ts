import { Firestore, WhereFilterOp, QueryDocumentSnapshot, DocumentData, Query } from '@google-cloud/firestore';

// Lazy-initialized Firestore client
// In development, uses GOOGLE_APPLICATION_CREDENTIALS env variable
// In production on Cloud Run, uses default service account
let firestoreInstance: Firestore | null = null;

function getFirestore(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return firestoreInstance;
}

// Collection names
export const COLLECTIONS = {
  USER: 'User',
  PERSON: 'Person',
  RELATIONSHIP: 'Relationship',
} as const;

// Keep KINDS as an alias for backward compatibility
export const KINDS = COLLECTIONS;

// Helper function to convert document to entity
function docToEntity<T>(doc: QueryDocumentSnapshot<DocumentData>): T {
  return { id: doc.id, ...doc.data() } as T;
}

// Helper functions for Firestore operations
export async function getEntity<T>(collection: string, id: string): Promise<T | null> {
  const firestore = getFirestore();
  const docRef = firestore.collection(collection).doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  return { id: doc.id, ...doc.data() } as T;
}

export async function saveEntity<T extends { id: string }>(collection: string, entity: T): Promise<void> {
  const firestore = getFirestore();
  const docRef = firestore.collection(collection).doc(entity.id);

  // Exclude id from the document data (it's stored as the document ID)
  const { id, ...data } = entity as { id: string; [key: string]: unknown };

  await docRef.set(data);
}

export async function deleteEntity(collection: string, id: string): Promise<void> {
  const firestore = getFirestore();
  const docRef = firestore.collection(collection).doc(id);
  await docRef.delete();
}

export async function queryEntities<T>(
  collection: string,
  filters?: Array<{ property: string; operator: WhereFilterOp; value: unknown }>
): Promise<T[]> {
  const firestore = getFirestore();
  const collectionRef = firestore.collection(collection);
  let query: Query<DocumentData> = collectionRef;

  if (filters && filters.length > 0) {
    for (const filter of filters) {
      query = query.where(filter.property, filter.operator, filter.value);
    }
  }

  const snapshot = await query.get();
  return snapshot.docs.map(docToEntity<T>);
}

export async function queryEntitiesByProperty<T>(
  collection: string,
  property: string,
  value: unknown
): Promise<T[]> {
  const firestore = getFirestore();
  const snapshot = await firestore.collection(collection).where(property, '==', value).get();
  return snapshot.docs.map(docToEntity<T>);
}

// Export the getter for advanced use cases
export { getFirestore };
export default getFirestore;
