import { Firestore, QueryDocumentSnapshot, DocumentData } from '@google-cloud/firestore';

// Lazy-initialized Firestore client
// In development, uses GOOGLE_APPLICATION_CREDENTIALS env variable
// In production on Cloud Run, uses default service account
let firestoreInstance: Firestore | null = null;

function getFirestore(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      // Optional fields left undefined (e.g. no courtesy name) are omitted instead of rejected
      ignoreUndefinedProperties: true,
    });
  }
  return firestoreInstance;
}

// Collection names
export const COLLECTIONS = {
  USER: 'User',
  PERSON: 'Person',
  RELATIONSHIP: 'Relationship',
  /** Faces saved for later, not yet assigned to a person */
  AVATAR: 'Avatar',
  /** Personal access tokens for the MCP endpoint; only a hash of each token is stored */
  API_TOKEN: 'ApiToken',
  /** One-time avatar upload codes for curl, stored under the hash of the code */
  AVATAR_UPLOAD: 'AvatarUpload',
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

export async function deleteEntity(collection: string, id: string): Promise<void> {
  const firestore = getFirestore();
  const docRef = firestore.collection(collection).doc(id);
  await docRef.delete();
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
