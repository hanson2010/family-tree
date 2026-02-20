import type { Person, Relationship, Gender } from '@/types';
import { RelationshipType, Gender as GenderEnum } from '@/types';
import type { RelationshipPath, RelationshipEdge } from './types';

/**
 * Get the gender key for lookup
 */
export function getGenderKey(gender: Gender): 'MALE' | 'FEMALE' | 'UNKNOWN' {
  if (gender === GenderEnum.MALE) return 'MALE';
  if (gender === GenderEnum.FEMALE) return 'FEMALE';
  return 'UNKNOWN';
}

/**
 * Find the relationship path between two persons
 * Supports both direct and indirect relationships through graph traversal
 */
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

  // Find direct relationship first
  const directRel = relationships.find(
    r => (r.personAId === fromPersonId && r.personBId === toPersonId) ||
         (r.personAId === toPersonId && r.personBId === fromPersonId)
  );

  if (directRel) {
    const type = directRel.type;
    const isFromA = directRel.personAId === fromPersonId;

    // Determine relationship direction using enum
    switch (type) {
      case RelationshipType.PARENT_CHILD:
        // personA is the parent, personB is the child
        // If fromPerson is personA (isFromA=true), then fromPerson is the parent
        // So the relationshipType should be 'PARENT' (fromPerson is parent of toPerson)
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: isFromA ? 'PARENT' : 'CHILD',
        };
      case RelationshipType.SIBLING:
        return {
          type: 'COLLATERAL',
          generations: 0,
          isOlder: false, // Would need birth date to determine
          relationshipType: 'SIBLING',
        };
      case RelationshipType.HALF_SIBLING:
        return {
          type: 'COLLATERAL',
          generations: 0,
          relationshipType: 'HALF_SIBLING',
        };
      case RelationshipType.SPOUSE:
        return {
          type: 'DIRECT',
          generations: 0,
          relationshipType: 'SPOUSE',
        };
      case RelationshipType.CONCUBINE:
        return {
          type: 'DIRECT',
          generations: 0,
          relationshipType: 'CONCUBINE',
        };
      case RelationshipType.BETROTHED:
        return {
          type: 'DIRECT',
          generations: 0,
          relationshipType: 'BETROTHED',
        };
      case RelationshipType.ADOPTIVE_PARENT:
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: isFromA ? 'ADOPTED_CHILD' : 'ADOPTIVE_PARENT',
        };
      case RelationshipType.FOSTER_PARENT:
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: isFromA ? 'FOSTER_CHILD' : 'FOSTER_PARENT',
        };
      case RelationshipType.SWORN_SIBLING:
        return {
          type: 'COLLATERAL',
          generations: 0,
          relationshipType: 'SWORN_SIBLING',
        };
      default:
        return {
          type: 'DIRECT',
          generations: 0,
          relationshipType: type,
        };
    }
  }

  // Check for derived sibling relationship (share at least one parent)
  const siblingInfo = findDerivedSiblingRelationship(fromPersonId, toPersonId, relationships, personMap);
  if (siblingInfo) {
    return siblingInfo;
  }

  // No direct relationship - try to find indirect relationship through graph traversal
  // Use BFS to find the shortest path
  const indirectPath = findIndirectRelationshipPath(fromPersonId, toPersonId, persons, relationships);
  return indirectPath;
}

/**
 * Check if two persons are siblings based on shared parents
 * Returns sibling relationship info if they share at least one parent
 */
function findDerivedSiblingRelationship(
  fromPersonId: string,
  toPersonId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): RelationshipPath | null {
  // Find parents of fromPerson
  const fromParents = new Set(
    relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === fromPersonId)
      .map(r => r.personAId)
  );

  // Find parents of toPerson
  const toParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
    .map(r => r.personAId);

  // Check for shared parents
  const sharedParents = toParents.filter(parentId => fromParents.has(parentId));

  if (sharedParents.length > 0) {
    // They share at least one parent - they are siblings
    // If they share both parents, they are full siblings
    // If they share only one parent, they are half-siblings
    const isHalfSibling = sharedParents.length < 2 && fromParents.size > 0 && toParents.length > 0;

    // Determine if sibling is older based on birth year
    let isOlder: boolean | undefined;
    const fromPerson = personMap.get(fromPersonId);
    const toPerson = personMap.get(toPersonId);
    if (fromPerson && toPerson && fromPerson.birthYear && toPerson.birthYear) {
      isOlder = toPerson.birthYear < fromPerson.birthYear;
    }

    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: isHalfSibling ? 'HALF_SIBLING' : 'SIBLING',
      isOlder,
    };
  }

  return null;
}

/**
 * Find indirect relationship path through graph traversal
 * Uses BFS to find the shortest path between two persons
 */
function findIndirectRelationshipPath(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): RelationshipPath | null {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Build adjacency list with relationship info
  const adjacency = new Map<string, RelationshipEdge[]>();
  persons.forEach(p => adjacency.set(p.id, []));

  relationships.forEach(rel => {
    const aList = adjacency.get(rel.personAId);
    const bList = adjacency.get(rel.personBId);
    if (aList) aList.push({ personId: rel.personBId, relationship: rel, isPersonA: true });
    if (bList) bList.push({ personId: rel.personAId, relationship: rel, isPersonA: false });
  });

  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: { personId: string; path: RelationshipEdge[] }[] = [{ personId: fromPersonId, path: [] }];
  visited.add(fromPersonId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.personId === toPersonId && current.path.length > 0) {
      // Found a path - analyze it to determine relationship type
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

/**
 * Analyze a path of relationships to determine the overall relationship type
 */
function analyzeRelationshipPath(
  path: RelationshipEdge[],
  fromPersonId: string,
  toPersonId: string,
  personMap: Map<string, Person>
): RelationshipPath | null {
  if (path.length === 0) return null;

  // Calculate generation difference and track relationship types
  let generationDiff = 0;
  let hasCollateral = false;
  let hasSpouse = false;
  let hasSibling = false;
  let lastRelationshipType: string | null = null;
  let spouseCount = 0;  // Track number of spouse relationships for 连襟/妯娌 detection

  // Track the path pattern for detecting aunt/uncle/nephew/niece through common ancestor
  let upSteps = 0;  // Steps going up (to parent)
  let downSteps = 0;  // Steps going down (to child)

  // Track intermediate sibling for sibling-in-law relationships
  let intermediateSiblingId: string | null = null;
  // Track the person at the "bottom" of a U-shaped path (for derived sibling-in-law)
  let lastIntermediatePersonId: string | null = null;

  // Track the side (PATERNAL/MATERNAL) for aunt/uncle relationships
  let side: 'PATERNAL' | 'MATERNAL' | undefined;
  // Track the first parent we go up to (to determine paternal/maternal side)
  let firstParentId: string | null = null;

  for (const edge of path) {
    const rel = edge.relationship;
    const isFromA = edge.isPersonA;

    switch (rel.type) {
      case RelationshipType.PARENT_CHILD:
        // If we're personA, we're going to child (younger generation)
        // If we're personB, we're going to parent (older generation)
        if (isFromA) {
          generationDiff += 1;
          downSteps++;
          lastRelationshipType = 'CHILD';
          // Track intermediate person when going down (could be sibling in U-shaped path)
          lastIntermediatePersonId = edge.personId;
        } else {
          generationDiff -= 1;
          upSteps++;
          lastRelationshipType = 'PARENT';
          // Track the first parent we go up to (for paternal/maternal side detection)
          if (!firstParentId) {
            firstParentId = edge.personId;
            const parent = personMap.get(firstParentId);
            if (parent) {
              side = parent.gender === GenderEnum.MALE ? 'PATERNAL' : 'MATERNAL';
            }
          }
        }
        break;
      case RelationshipType.SIBLING:
        hasCollateral = true;
        hasSibling = true;
        lastRelationshipType = 'SIBLING';
        // Track the intermediate sibling (the person we reach via SIBLING relationship)
        intermediateSiblingId = edge.personId;
        break;
      case RelationshipType.HALF_SIBLING:
        hasCollateral = true;
        hasSibling = true;
        lastRelationshipType = 'HALF_SIBLING';
        // Track the intermediate sibling
        intermediateSiblingId = edge.personId;
        break;
      case RelationshipType.SWORN_SIBLING:
        hasCollateral = true;
        lastRelationshipType = 'SWORN_SIBLING';
        break;
      case RelationshipType.SPOUSE:
        hasSpouse = true;
        spouseCount++;
        lastRelationshipType = 'SPOUSE';
        break;
      case RelationshipType.CONCUBINE:
        hasSpouse = true;
        lastRelationshipType = 'CONCUBINE';
        break;
      case RelationshipType.BETROTHED:
        hasSpouse = true;
        lastRelationshipType = 'BETROTHED';
        break;
      case RelationshipType.ADOPTIVE_PARENT:
        if (isFromA) {
          generationDiff += 1;
          downSteps++;
          lastRelationshipType = 'ADOPTED_CHILD';
          lastIntermediatePersonId = edge.personId;
        } else {
          generationDiff -= 1;
          upSteps++;
          lastRelationshipType = 'ADOPTIVE_PARENT';
        }
        break;
      case RelationshipType.FOSTER_PARENT:
        if (isFromA) {
          generationDiff += 1;
          downSteps++;
          lastRelationshipType = 'FOSTER_CHILD';
          lastIntermediatePersonId = edge.personId;
        } else {
          generationDiff -= 1;
          upSteps++;
          lastRelationshipType = 'FOSTER_PARENT';
        }
        break;
    }
  }

  // Determine relationship type based on path
  if (path.length === 1) {
    // Direct relationship - already handled
    return null;
  }

  // Multi-hop relationships

  // Check the order of relationships to distinguish between:
  // - Sibling's spouse: fromPerson -> parent -> sibling -> SPOUSE -> sibling's spouse
  // - Spouse's sibling: fromPerson -> SPOUSE -> spouse -> parent -> spouse's sibling
  // - Spouse's sibling's spouse (妯娌/连襟): fromPerson -> SPOUSE -> spouse -> parent -> spouse's sibling <- SPOUSE <- toPerson
  const firstEdge = path[0];
  const isFirstEdgeSpouse = firstEdge.relationship.type === RelationshipType.SPOUSE ||
    firstEdge.relationship.type === RelationshipType.CONCUBINE ||
    firstEdge.relationship.type === RelationshipType.BETROTHED;

  // 连襟/妯娌 detection: Two people married to siblings
  // Must check this BEFORE spouse's sibling since both have similar patterns
  // Pattern: fromPerson -> SPOUSE -> spouse -> up to parent -> down to spouse's sibling <- SPOUSE <- toPerson
  // This means spouseCount >= 2 and upSteps >= 1 and downSteps >= 1 and generationDiff === 0
  if (generationDiff === 0 && spouseCount >= 2 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: 'SIBLINGS_SPOUSE_MUTUAL',
    };
  }

  // Spouse's sibling relationships (SPOUSE first, then U-shaped path through parents)
  // Pattern: fromPerson -> SPOUSE -> spouse -> up to parent -> down to spouse's sibling
  if (generationDiff === 0 && hasSpouse && upSteps >= 1 && downSteps >= 1 && isFirstEdgeSpouse) {
    // This is spouse's sibling (大伯子/小叔子/大姨子/小姨子/内兄/内弟)
    // Determine if the spouse's sibling is older or younger than the spouse
    let isSpouseSiblingOlder: boolean | undefined;
    const spouseId = firstEdge.personId; // The spouse in the path
    const spouse = personMap.get(spouseId);
    const spouseSibling = personMap.get(toPersonId);

    if (spouse && spouseSibling && spouse.birthYear && spouseSibling.birthYear) {
      isSpouseSiblingOlder = spouseSibling.birthYear < spouse.birthYear;
    }

    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: 'SPOUSE_SIBLING',
      isOlder: isSpouseSiblingOlder,
    };
  }

  // Sibling's spouse relationships (U-shaped path through sibling, then SPOUSE)
  // Pattern: fromPerson -> up to parent -> down to sibling -> SPOUSE -> sibling's spouse
  // This is different from direct spouse relationship
  if (generationDiff === 0 && hasSpouse && upSteps >= 1 && downSteps >= 1) {
    // This is sibling's spouse (嫂子/弟妹)
    // Determine if the sibling is older or younger
    let isSiblingOlder: boolean | undefined;
    // The intermediate person is the sibling (lastIntermediatePersonId)
    if (lastIntermediatePersonId) {
      const fromPerson = personMap.get(fromPersonId);
      const intermediateSibling = personMap.get(lastIntermediatePersonId);
      if (fromPerson && intermediateSibling && fromPerson.birthYear && intermediateSibling.birthYear) {
        isSiblingOlder = intermediateSibling.birthYear < fromPerson.birthYear;
      }
    }
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: 'SIBLING_IN_LAW',
      isOlder: isSiblingOlder,
    };
  }

  // Spouse relationships (same generation, through marriage)
  if (generationDiff === 0 && hasSpouse && !hasCollateral) {
    // Direct spouse - already handled in direct relationships
    return {
      type: 'DIRECT',
      generations: 0,
      relationshipType: 'SPOUSE',
    };
  }

  // Spouse's sibling relationships (through spouse then to their sibling)
  // Pattern: fromPerson -> SPOUSE -> spouse -> SIBLING -> spouse's sibling
  // This is different from sibling's spouse
  if (generationDiff === 0 && hasSpouse && hasSibling) {
    // Determine if this is spouse's sibling or sibling's spouse
    // by checking the order of relationships in the path
    const firstEdge = path[0];

    // If first edge is SPOUSE, then it's spouse's sibling
    // If first edge is SIBLING, then it's sibling's spouse (handled elsewhere)
    if (firstEdge.relationship.type === RelationshipType.SPOUSE ||
        firstEdge.relationship.type === RelationshipType.CONCUBINE ||
        firstEdge.relationship.type === RelationshipType.BETROTHED) {
      // This is spouse's sibling
      // Determine if the sibling is older or younger than the spouse
      let isSpouseSiblingOlder: boolean | undefined;
      const spouseId = firstEdge.personId; // The spouse in the path
      const spouseSiblingId = toPersonId;
      const spouse = personMap.get(spouseId);
      const spouseSibling = personMap.get(spouseSiblingId);

      if (spouse && spouseSibling && spouse.birthYear && spouseSibling.birthYear) {
        isSpouseSiblingOlder = spouseSibling.birthYear < spouse.birthYear;
      }

      return {
        type: 'COLLATERAL',
        generations: 0,
        relationshipType: 'SPOUSE_SIBLING',
        isOlder: isSpouseSiblingOlder,
      };
    }
  }

  // Sibling relationships (same generation)
  if (generationDiff === 0 && hasSibling) {
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: 'SIBLING',
    };
  }

  // Cousin relationships (same generation, through common ancestor)
  // Pattern: up to grandparent, then down to cousin
  // This is a "U-shaped" path with generationDiff = 0
  if (generationDiff === 0 && upSteps >= 1 && downSteps >= 1) {
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: 'COUSIN',
    };
  }

  // Grandparent relationships (2 generations up)
  if (generationDiff === -2) {
    return {
      type: 'DIRECT',
      generations: 2,
      relationshipType: 'GRANDPARENT',
    };
  }

  // Grandchild relationships (2 generations down)
  if (generationDiff === 2) {
    return {
      type: 'DIRECT',
      generations: 2,
      relationshipType: 'GRANDCHILD',
    };
  }

  // Aunt/Uncle relationships (toPerson is 1 generation up, through common ancestor)
  // Pattern: up to parent, then to parent's sibling (via common grandparent)
  // This is a "U-shaped" path: up to ancestor, then down to collateral
  // OR through explicit SIBLING relationship: up to parent, then SIBLING to aunt/uncle
  // generationDiff < 0 means toPerson is in an older generation (ancestor direction)
  if (generationDiff === -1 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    // Check if this is actually uncle's wife / aunt's husband (spouse of aunt/uncle)
    // Pattern: up to parent, then to parent's sibling, then SPOUSE to aunt/uncle's spouse
    // The last relationship would be SPOUSE and the target is the spouse
    if (hasSpouse && lastRelationshipType === 'SPOUSE') {
      // This is uncle's wife or aunt's husband
      // Need to find the intermediate aunt/uncle to determine older/younger
      let isUncleOlder: boolean | undefined;
      // The intermediate person in the path would be the aunt/uncle
      // We need to find them by looking at the path
      for (const edge of path) {
        const rel = edge.relationship;
        if (rel.type === RelationshipType.SIBLING || rel.type === RelationshipType.HALF_SIBLING) {
          // The person we reach via SIBLING is the aunt/uncle
          const auntOrUncleId = edge.personId;
          const auntOrUncle = personMap.get(auntOrUncleId);
          const parent = personMap.get(firstParentId || '');
          if (parent && auntOrUncle && parent.birthYear && auntOrUncle.birthYear) {
            isUncleOlder = auntOrUncle.birthYear < parent.birthYear;
          }
          break;
        }
      }
      // Also check via derived sibling (U-shaped path through common ancestor)
      // In this case, intermediateSiblingId is not set, but lastIntermediatePersonId is
      if (isUncleOlder === undefined && lastIntermediatePersonId) {
        const parent = personMap.get(firstParentId || '');
        // For U-shaped path, lastIntermediatePersonId is the sibling (aunt/uncle)
        const intermediate = personMap.get(lastIntermediatePersonId);
        if (parent && intermediate && parent.birthYear && intermediate.birthYear) {
          isUncleOlder = intermediate.birthYear < parent.birthYear;
        }
      }
      return {
        type: 'COLLATERAL',
        generations: 1,
        relationshipType: 'AUNT_UNCLE_SPOUSE',
        side,
        isOlder: isUncleOlder,
      };
    }
    // Determine if the aunt/uncle is older or younger than the parent
    // by comparing birth years if available
    let isOlder: boolean | undefined;
    if (lastIntermediatePersonId) {
      const parent = personMap.get(firstParentId || '');
      const auntUncle = personMap.get(toPersonId);
      if (parent && auntUncle && parent.birthYear && auntUncle.birthYear) {
        isOlder = auntUncle.birthYear < parent.birthYear;
      }
    }
    return {
      type: 'COLLATERAL',
      generations: 1,
      relationshipType: 'AUNT_UNCLE',
      side,
      isOlder,
    };
  }

  // Great Aunt/Uncle relationships (toPerson is 2 generations up, through common ancestor)
  // Pattern: up to grandparent, then to grandparent's sibling (via common great-grandparent)
  // This is a "U-shaped" path: up 2 to ancestor, then down 1 to collateral
  if (generationDiff === -2 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 2,
      relationshipType: 'GREAT_AUNT_UNCLE',
    };
  }

  // Great Great Aunt/Uncle relationships (toPerson is 3 generations up)
  // Pattern: up 3 to ancestor, then down 1 to collateral
  if (generationDiff === -3 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 3,
      relationshipType: 'GREAT_GREAT_AUNT_UNCLE',
    };
  }

  // Nephew/Niece relationships (toPerson is 1 generation down, through common ancestor)
  // Pattern: down to child, then to child's sibling's child (via common grandparent)
  // This is an "inverted U-shaped" path: down to descendant, then up to collateral
  // OR through explicit SIBLING relationship: SIBLING to parent, then down to child
  // generationDiff > 0 means toPerson is in a younger generation (descendant direction)
  if (generationDiff === 1 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 1,
      relationshipType: 'NEPHEW_NIECE',
    };
  }

  // Great Nephew/Niece relationships (toPerson is 2 generations down)
  // Pattern: up 1 to parent, then down 2 to sibling's grandchild
  if (generationDiff === 2 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 2,
      relationshipType: 'GREAT_NEPHEW_NIECE',
    };
  }

  // Great Great Nephew/Niece relationships (toPerson is 3 generations down)
  // Pattern: up 1 to parent, then down 3 to sibling's great-grandchild
  if (generationDiff === 3 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 3,
      relationshipType: 'GREAT_GREAT_NEPHEW_NIECE',
    };
  }

  // Great grandparent (3 generations up)
  if (generationDiff === -3) {
    return {
      type: 'DIRECT',
      generations: 3,
      relationshipType: 'GREAT_GRANDPARENT',
    };
  }

  // Great grandchild (3 generations down)
  if (generationDiff === 3) {
    return {
      type: 'DIRECT',
      generations: 3,
      relationshipType: 'GREAT_GRANDCHILD',
    };
  }

  // In-law relationships (through spouse)
  if (hasSpouse) {
    if (generationDiff === -1) {
      // Could be spouse's parent or parent's spouse
      // Check order: SPOUSE first = spouse's parent, PARENT first = parent's spouse
      if (isFirstEdgeSpouse) {
        // Spouse's parent
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: 'PARENT_IN_LAW',
        };
      } else {
        // Parent's spouse (step-parent)
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: 'STEPPARENT',
        };
      }
    }
    if (generationDiff === 1) {
      // Could be child's spouse or spouse's child
      // Check order: SPOUSE first = spouse's child, PARENT_CHILD first = child's spouse
      if (isFirstEdgeSpouse) {
        // Spouse's child (step-child)
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: 'STEPCHILD',
        };
      } else {
        // Child's spouse
        return {
          type: 'DIRECT',
          generations: 1,
          relationshipType: 'CHILD_IN_LAW',
        };
      }
    }
    if (generationDiff === 0) {
      // Sibling's spouse or spouse's sibling
      // Determine if the intermediate sibling is older or younger
      let isSiblingOlder: boolean | undefined;
      // Use intermediateSiblingId for explicit SIBLING relationships
      // or lastIntermediatePersonId for derived siblings (U-shaped path through parents)
      const siblingId = intermediateSiblingId || lastIntermediatePersonId;
      if (siblingId) {
        const fromPerson = personMap.get(fromPersonId);
        const intermediateSibling = personMap.get(siblingId);
        if (fromPerson && intermediateSibling && fromPerson.birthYear && intermediateSibling.birthYear) {
          // The sibling is older if they were born before fromPerson
          isSiblingOlder = intermediateSibling.birthYear < fromPerson.birthYear;
        }
      }
      return {
        type: 'COLLATERAL',
        generations: 0,
        relationshipType: 'SIBLING_IN_LAW',
        isOlder: isSiblingOlder,
      };
    }
  }

  // Handle other generation differences with specific terms
  if (generationDiff === -4) {
    return {
      type: 'DIRECT',
      generations: 4,
      relationshipType: 'GREAT_GREAT_GRANDPARENT',
    };
  }

  if (generationDiff === 4) {
    return {
      type: 'DIRECT',
      generations: 4,
      relationshipType: 'GREAT_GREAT_GRANDCHILD',
    };
  }

  // For other cases, provide a descriptive term based on generation difference
  const absGenDiff = Math.abs(generationDiff);
  if (absGenDiff > 0) {
    if (generationDiff < 0) {
      // Ancestor - toPerson is in older generation, fromPerson calls them parent/grandparent
      return {
        type: 'DIRECT',
        generations: absGenDiff,
        relationshipType: absGenDiff === 1 ? 'CHILD' : `GRANDCHILD_${absGenDiff}`,
      };
    } else {
      // Descendant - toPerson is in younger generation, fromPerson calls them child/grandchild
      return {
        type: 'DIRECT',
        generations: absGenDiff,
        relationshipType: absGenDiff === 1 ? 'PARENT' : `GRANDPARENT_${absGenDiff}`,
      };
    }
  }

  // Default: return a generic relationship
  return {
    type: hasCollateral ? 'COLLATERAL' : 'DIRECT',
    generations: Math.abs(generationDiff),
    relationshipType: hasCollateral ? 'COUSIN' : '亲属',
  };
}
