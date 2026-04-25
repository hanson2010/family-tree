import type { Person, Relationship, Gender } from '@/types';
import { RelationshipType, Gender as GenderEnum } from '@/types';
import type { RelationshipPath, RelationshipEdge } from './types';
import { KinshipRelationshipType } from './types';
import { analyzeRelationshipPath } from './path-analyzer';

export function getGenderKey(gender: Gender): 'MALE' | 'FEMALE' | 'UNKNOWN' {
  if (gender === GenderEnum.MALE) return 'MALE';
  if (gender === GenderEnum.FEMALE) return 'FEMALE';
  return 'UNKNOWN';
}

export function findRelationshipPath(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): RelationshipPath | null {
  const personMap = new Map(persons.map(p => [p.id, p]));
  const fromPerson = personMap.get(fromPersonId);
  const toPerson = personMap.get(toPersonId);

  if (!fromPerson || !toPerson) return null;

  const directRel = relationships.find(
    r => (r.personAId === fromPersonId && r.personBId === toPersonId) ||
         (r.personAId === toPersonId && r.personBId === fromPersonId)
  );

  if (directRel) {
    return buildDirectRelationshipPath(directRel, fromPersonId);
  }

  const siblingInfo = findDerivedSiblingRelationship(fromPersonId, toPersonId, relationships, personMap);
  if (siblingInfo) {
    return siblingInfo;
  }

  return findIndirectRelationshipPath(fromPersonId, toPersonId, persons, relationships);
}

function buildDirectRelationshipPath(
  rel: Relationship,
  fromPersonId: string
): RelationshipPath {
  const type = rel.type;
  const isFromA = rel.personAId === fromPersonId;

  switch (type) {
    case RelationshipType.PARENT_CHILD:
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: isFromA ? KinshipRelationshipType.PARENT : KinshipRelationshipType.CHILD,
      };
    case RelationshipType.SIBLING:
      return {
        type: 'COLLATERAL',
        generations: 0,
        isOlder: false,
        relationshipType: KinshipRelationshipType.SIBLING,
      };
    case RelationshipType.HALF_SIBLING:
      return {
        type: 'COLLATERAL',
        generations: 0,
        relationshipType: KinshipRelationshipType.HALF_SIBLING,
      };
    case RelationshipType.SPOUSE:
      return {
        type: 'DIRECT',
        generations: 0,
        relationshipType: KinshipRelationshipType.SPOUSE,
      };
    case RelationshipType.CONCUBINE:
      return {
        type: 'DIRECT',
        generations: 0,
        relationshipType: KinshipRelationshipType.CONCUBINE,
      };
    case RelationshipType.BETROTHED:
      return {
        type: 'DIRECT',
        generations: 0,
        relationshipType: KinshipRelationshipType.BETROTHED,
      };
    case RelationshipType.ADOPTIVE_PARENT:
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: isFromA ? KinshipRelationshipType.ADOPTED_CHILD : KinshipRelationshipType.ADOPTIVE_PARENT,
      };
    case RelationshipType.FOSTER_PARENT:
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: isFromA ? KinshipRelationshipType.FOSTER_CHILD : KinshipRelationshipType.FOSTER_PARENT,
      };
    case RelationshipType.SWORN_SIBLING:
      return {
        type: 'COLLATERAL',
        generations: 0,
        relationshipType: KinshipRelationshipType.SWORN_SIBLING,
      };
    default:
      return {
        type: 'DIRECT',
        generations: 0,
        relationshipType: type,
      };
  }
}

function findDerivedSiblingRelationship(
  fromPersonId: string,
  toPersonId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): RelationshipPath | null {
  const fromParents = new Set(
    relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === fromPersonId)
      .map(r => r.personAId)
  );

  const toParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
    .map(r => r.personAId);

  const sharedParents = toParents.filter(parentId => fromParents.has(parentId));

  if (sharedParents.length > 0) {
    const isHalfSibling = sharedParents.length < 2 && fromParents.size > 0 && toParents.length > 0;

    let isOlder: boolean | undefined;
    const fromPerson = personMap.get(fromPersonId);
    const toPerson = personMap.get(toPersonId);
    if (fromPerson && toPerson && fromPerson.birthYear && toPerson.birthYear) {
      isOlder = toPerson.birthYear < fromPerson.birthYear;
    }

    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: isHalfSibling ? KinshipRelationshipType.HALF_SIBLING : KinshipRelationshipType.SIBLING,
      isOlder,
    };
  }

  return null;
}

function findIndirectRelationshipPath(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): RelationshipPath | null {
  const personMap = new Map(persons.map(p => [p.id, p]));

  const adjacency = new Map<string, RelationshipEdge[]>();
  persons.forEach(p => adjacency.set(p.id, []));

  relationships.forEach(rel => {
    const aList = adjacency.get(rel.personAId);
    const bList = adjacency.get(rel.personBId);
    if (aList) aList.push({ personId: rel.personBId, relationship: rel, isPersonA: true });
    if (bList) bList.push({ personId: rel.personAId, relationship: rel, isPersonA: false });
  });

  const visited = new Set<string>();
  const queue: { personId: string; path: RelationshipEdge[] }[] = [{ personId: fromPersonId, path: [] }];
  visited.add(fromPersonId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.personId === toPersonId && current.path.length > 0) {
      return analyzeRelationshipPath(current.path, fromPersonId, toPersonId, personMap);
    }

    const edges = adjacency.get(current.personId) || [];
    for (const edge of edges) {
      if (!visited.has(edge.personId)) {
        visited.add(edge.personId);
        queue.push({
          personId: edge.personId,
          path: [...current.path, edge],
        });
      }
    }
  }

  return null;
}
