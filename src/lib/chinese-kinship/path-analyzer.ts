import type { Person, Relationship } from '@/types';
import { RelationshipType, Gender as GenderEnum } from '@/types';
import type { RelationshipPath, RelationshipEdge, KinshipSide, GrandparentSide } from './types';
import { KinshipRelationshipType } from './types';

interface PathAnalysisContext {
  generationDiff: number;
  hasCollateral: boolean;
  hasSpouse: boolean;
  hasSibling: boolean;
  lastRelationshipType: KinshipRelationshipType | string | null;
  spouseCount: number;
  upSteps: number;
  downSteps: number;
  intermediateSiblingId: string | null;
  lastIntermediatePersonId: string | null;
  side: KinshipSide | undefined;
  firstParentId: string | null;
  grandparentSide: GrandparentSide | undefined;
  grandparentId: string | null;
  stepCount: number;
}

function initializeContext(): PathAnalysisContext {
  return {
    generationDiff: 0,
    hasCollateral: false,
    hasSpouse: false,
    hasSibling: false,
    lastRelationshipType: null,
    spouseCount: 0,
    upSteps: 0,
    downSteps: 0,
    intermediateSiblingId: null,
    lastIntermediatePersonId: null,
    side: undefined,
    firstParentId: null,
    grandparentSide: undefined,
    grandparentId: null,
    stepCount: 0,
  };
}

function processEdge(
  edge: RelationshipEdge,
  ctx: PathAnalysisContext,
  personMap: Map<string, Person>
): void {
  const rel = edge.relationship;
  const isFromA = edge.isPersonA;

  switch (rel.type) {
    case RelationshipType.PARENT_CHILD:
      if (isFromA) {
        ctx.generationDiff += 1;
        ctx.downSteps++;
        ctx.lastRelationshipType = KinshipRelationshipType.CHILD;
        ctx.lastIntermediatePersonId = edge.personId;
      } else {
        ctx.generationDiff -= 1;
        ctx.upSteps++;
        ctx.stepCount++;
        ctx.lastRelationshipType = KinshipRelationshipType.PARENT;
        if (!ctx.firstParentId) {
          ctx.firstParentId = edge.personId;
          const parent = personMap.get(ctx.firstParentId);
          if (parent) {
            ctx.side = parent.gender === GenderEnum.MALE ? 'PATERNAL' : 'MATERNAL';
          }
        }
        if (ctx.stepCount === 2 && !ctx.grandparentId) {
          ctx.grandparentId = edge.personId;
          const grandparent = personMap.get(ctx.grandparentId);
          if (grandparent && ctx.side) {
            if (ctx.side === 'PATERNAL') {
              ctx.grandparentSide = grandparent.gender === GenderEnum.MALE ? 'PATERNAL_GRANDFATHER' : 'PATERNAL_GRANDMOTHER';
            } else {
              ctx.grandparentSide = grandparent.gender === GenderEnum.MALE ? 'MATERNAL_GRANDFATHER' : 'MATERNAL_GRANDMOTHER';
            }
          }
        }
      }
      break;
    case RelationshipType.SIBLING:
      ctx.hasCollateral = true;
      ctx.hasSibling = true;
      ctx.lastRelationshipType = KinshipRelationshipType.SIBLING;
      ctx.intermediateSiblingId = edge.personId;
      break;
    case RelationshipType.HALF_SIBLING:
      ctx.hasCollateral = true;
      ctx.hasSibling = true;
      ctx.lastRelationshipType = KinshipRelationshipType.HALF_SIBLING;
      ctx.intermediateSiblingId = edge.personId;
      break;
    case RelationshipType.SWORN_SIBLING:
      ctx.hasCollateral = true;
      ctx.lastRelationshipType = KinshipRelationshipType.SWORN_SIBLING;
      break;
    case RelationshipType.SPOUSE:
      ctx.hasSpouse = true;
      ctx.spouseCount++;
      ctx.lastRelationshipType = KinshipRelationshipType.SPOUSE;
      break;
    case RelationshipType.CONCUBINE:
      ctx.hasSpouse = true;
      ctx.lastRelationshipType = KinshipRelationshipType.CONCUBINE;
      break;
    case RelationshipType.BETROTHED:
      ctx.hasSpouse = true;
      ctx.lastRelationshipType = KinshipRelationshipType.BETROTHED;
      break;
    case RelationshipType.ADOPTIVE_PARENT:
      if (isFromA) {
        ctx.generationDiff += 1;
        ctx.downSteps++;
        ctx.lastRelationshipType = KinshipRelationshipType.ADOPTED_CHILD;
        ctx.lastIntermediatePersonId = edge.personId;
      } else {
        ctx.generationDiff -= 1;
        ctx.upSteps++;
        ctx.lastRelationshipType = KinshipRelationshipType.ADOPTIVE_PARENT;
      }
      break;
    case RelationshipType.FOSTER_PARENT:
      if (isFromA) {
        ctx.generationDiff += 1;
        ctx.downSteps++;
        ctx.lastRelationshipType = KinshipRelationshipType.FOSTER_CHILD;
        ctx.lastIntermediatePersonId = edge.personId;
      } else {
        ctx.generationDiff -= 1;
        ctx.upSteps++;
        ctx.lastRelationshipType = KinshipRelationshipType.FOSTER_PARENT;
      }
      break;
  }
}

function buildRelationshipPath(
  ctx: PathAnalysisContext,
  path: RelationshipEdge[],
  fromPersonId: string,
  toPersonId: string,
  personMap: Map<string, Person>
): RelationshipPath | null {
  if (path.length === 1) {
    return null;
  }

  const firstEdge = path[0];
  const isFirstEdgeSpouse = firstEdge.relationship.type === RelationshipType.SPOUSE ||
    firstEdge.relationship.type === RelationshipType.CONCUBINE ||
    firstEdge.relationship.type === RelationshipType.BETROTHED;

  const { generationDiff, hasSibling, hasSpouse, upSteps, downSteps, spouseCount } = ctx;

  if (generationDiff === 0 && spouseCount >= 2 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.SIBLINGS_SPOUSE_MUTUAL,
    };
  }

  if (generationDiff === 0 && hasSpouse && upSteps >= 1 && downSteps >= 1 && isFirstEdgeSpouse) {
    const isSpouseSiblingOlder = determineSpouseSiblingAgeOrder(firstEdge.personId, toPersonId, personMap);
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.SPOUSE_SIBLING,
      isOlder: isSpouseSiblingOlder,
    };
  }

  if (generationDiff === 0 && hasSpouse && upSteps >= 1 && downSteps >= 1) {
    const isSiblingOlder = determineSiblingAgeOrder(fromPersonId, ctx.lastIntermediatePersonId, personMap);
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.SIBLING_IN_LAW,
      isOlder: isSiblingOlder,
    };
  }

  if (generationDiff === 0 && hasSpouse && !ctx.hasCollateral) {
    return {
      type: 'DIRECT',
      generations: 0,
      relationshipType: KinshipRelationshipType.SPOUSE,
    };
  }

  if (generationDiff === 0 && hasSpouse && hasSibling && isFirstEdgeSpouse) {
    const isSpouseSiblingOlder = determineSpouseSiblingAgeOrder(firstEdge.personId, toPersonId, personMap);
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.SPOUSE_SIBLING,
      isOlder: isSpouseSiblingOlder,
    };
  }

  if (generationDiff === 0 && hasSibling) {
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.SIBLING,
    };
  }

  if (generationDiff === 0 && upSteps >= 1 && downSteps >= 1) {
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.COUSIN,
    };
  }

  if (generationDiff === -2 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    const greatAuntUncleOlder = determineGreatAuntUncleAgeOrder(ctx.grandparentId, toPersonId, personMap);
    return {
      type: 'COLLATERAL',
      generations: 2,
      relationshipType: KinshipRelationshipType.GREAT_AUNT_UNCLE,
      grandparentSide: ctx.grandparentSide,
      isOlder: greatAuntUncleOlder,
    };
  }

  if (generationDiff === -2) {
    return {
      type: 'DIRECT',
      generations: 2,
      relationshipType: KinshipRelationshipType.GRANDPARENT,
      side: ctx.side,
    };
  }

  if (generationDiff === 2) {
    return {
      type: 'DIRECT',
      generations: 2,
      relationshipType: KinshipRelationshipType.GRANDCHILD,
    };
  }

  if (generationDiff === -1 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return buildAuntUnclePath(ctx, path, fromPersonId, toPersonId, personMap);
  }

  if (generationDiff === -3 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    const greatGreatAuntUncleOlder = determineGreatAuntUncleAgeOrder(ctx.grandparentId, toPersonId, personMap);
    return {
      type: 'COLLATERAL',
      generations: 3,
      relationshipType: KinshipRelationshipType.GREAT_GREAT_AUNT_UNCLE,
      grandparentSide: ctx.grandparentSide,
      isOlder: greatGreatAuntUncleOlder,
    };
  }

  if (generationDiff === 1 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 1,
      relationshipType: KinshipRelationshipType.NEPHEW_NIECE,
    };
  }

  if (generationDiff === 2 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 2,
      relationshipType: KinshipRelationshipType.GREAT_NEPHEW_NIECE,
    };
  }

  if (generationDiff === 3 && (hasSibling || (upSteps >= 1 && downSteps >= 1))) {
    return {
      type: 'COLLATERAL',
      generations: 3,
      relationshipType: KinshipRelationshipType.GREAT_GREAT_NEPHEW_NIECE,
    };
  }

  if (generationDiff === -3) {
    return {
      type: 'DIRECT',
      generations: 3,
      relationshipType: KinshipRelationshipType.GREAT_GRANDPARENT,
      side: ctx.side,
    };
  }

  if (generationDiff === 3) {
    return {
      type: 'DIRECT',
      generations: 3,
      relationshipType: KinshipRelationshipType.GREAT_GRANDCHILD,
    };
  }

  if (hasSpouse) {
    return buildSpouseRelatedPath(ctx, generationDiff, isFirstEdgeSpouse);
  }

  if (generationDiff === -4) {
    return {
      type: 'DIRECT',
      generations: 4,
      relationshipType: KinshipRelationshipType.GREAT_GREAT_GRANDPARENT,
      side: ctx.side,
    };
  }

  if (generationDiff === 4) {
    return {
      type: 'DIRECT',
      generations: 4,
      relationshipType: KinshipRelationshipType.GREAT_GREAT_GRANDCHILD,
    };
  }

  return buildDefaultPath(ctx, generationDiff);
}

function buildAuntUnclePath(
  ctx: PathAnalysisContext,
  path: RelationshipEdge[],
  fromPersonId: string,
  toPersonId: string,
  personMap: Map<string, Person>
): RelationshipPath {
  if (ctx.hasSpouse && ctx.lastRelationshipType === KinshipRelationshipType.SPOUSE) {
    const isUncleOlder = findAuntUncleAgeOrder(path, ctx.firstParentId, ctx.lastIntermediatePersonId, personMap);
    return {
      type: 'COLLATERAL',
      generations: 1,
      relationshipType: KinshipRelationshipType.AUNT_UNCLE_SPOUSE,
      side: ctx.side,
      isOlder: isUncleOlder,
    };
  }

  let isOlder: boolean | undefined;
  if (ctx.lastIntermediatePersonId) {
    const parent = personMap.get(ctx.firstParentId || '');
    const auntUncle = personMap.get(toPersonId);
    if (parent && auntUncle && parent.birthYear && auntUncle.birthYear) {
      isOlder = auntUncle.birthYear < parent.birthYear;
    }
  }
  return {
    type: 'COLLATERAL',
    generations: 1,
    relationshipType: KinshipRelationshipType.AUNT_UNCLE,
    side: ctx.side,
    isOlder,
  };
}

function buildSpouseRelatedPath(
  ctx: PathAnalysisContext,
  generationDiff: number,
  isFirstEdgeSpouse: boolean
): RelationshipPath | null {
  if (generationDiff === -1) {
    if (isFirstEdgeSpouse) {
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: KinshipRelationshipType.PARENT_IN_LAW,
      };
    } else {
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: KinshipRelationshipType.STEPPARENT,
      };
    }
  }
  if (generationDiff === 1) {
    if (isFirstEdgeSpouse) {
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: KinshipRelationshipType.STEPCHILD,
      };
    } else {
      return {
        type: 'DIRECT',
        generations: 1,
        relationshipType: KinshipRelationshipType.CHILD_IN_LAW,
      };
    }
  }
  if (generationDiff === 0) {
    const isSiblingOlder = false;
    return {
      type: 'COLLATERAL',
      generations: 0,
      relationshipType: KinshipRelationshipType.SIBLING_IN_LAW,
      isOlder: isSiblingOlder,
    };
  }
  return null;
}

function buildDefaultPath(ctx: PathAnalysisContext, generationDiff: number): RelationshipPath {
  const absGenDiff = Math.abs(generationDiff);
  if (absGenDiff > 0) {
    if (generationDiff < 0) {
      return {
        type: 'DIRECT',
        generations: absGenDiff,
        relationshipType: absGenDiff === 1 ? KinshipRelationshipType.CHILD : `GRANDCHILD_${absGenDiff}`,
      };
    } else {
      return {
        type: 'DIRECT',
        generations: absGenDiff,
        relationshipType: absGenDiff === 1 ? KinshipRelationshipType.PARENT : `GRANDPARENT_${absGenDiff}`,
      };
    }
  }
  return {
    type: ctx.hasCollateral ? 'COLLATERAL' : 'DIRECT',
    generations: Math.abs(generationDiff),
    relationshipType: ctx.hasCollateral ? KinshipRelationshipType.COUSIN : KinshipRelationshipType.UNKNOWN,
  };
}

function determineSpouseSiblingAgeOrder(
  spouseId: string,
  spouseSiblingId: string,
  personMap: Map<string, Person>
): boolean | undefined {
  const spouse = personMap.get(spouseId);
  const spouseSibling = personMap.get(spouseSiblingId);
  if (spouse && spouseSibling && spouse.birthYear && spouseSibling.birthYear) {
    return spouseSibling.birthYear < spouse.birthYear;
  }
  return undefined;
}

function determineSiblingAgeOrder(
  fromPersonId: string,
  siblingId: string | null,
  personMap: Map<string, Person>
): boolean | undefined {
  if (!siblingId) return undefined;
  const fromPerson = personMap.get(fromPersonId);
  const sibling = personMap.get(siblingId);
  if (fromPerson && sibling && fromPerson.birthYear && sibling.birthYear) {
    return sibling.birthYear < fromPerson.birthYear;
  }
  return undefined;
}

function determineGreatAuntUncleAgeOrder(
  grandparentId: string | null,
  greatAuntUncleId: string,
  personMap: Map<string, Person>
): boolean | undefined {
  if (!grandparentId) return undefined;
  const grandparent = personMap.get(grandparentId);
  const greatAuntUncle = personMap.get(greatAuntUncleId);
  if (grandparent && greatAuntUncle && grandparent.birthYear && greatAuntUncle.birthYear) {
    return greatAuntUncle.birthYear < grandparent.birthYear;
  }
  return undefined;
}

function findAuntUncleAgeOrder(
  path: RelationshipEdge[],
  firstParentId: string | null,
  lastIntermediatePersonId: string | null,
  personMap: Map<string, Person>
): boolean | undefined {
  for (const edge of path) {
    const rel = edge.relationship;
    if (rel.type === RelationshipType.SIBLING || rel.type === RelationshipType.HALF_SIBLING) {
      const auntOrUncle = personMap.get(edge.personId);
      const parent = personMap.get(firstParentId || '');
      if (parent && auntOrUncle && parent.birthYear && auntOrUncle.birthYear) {
        return auntOrUncle.birthYear < parent.birthYear;
      }
      break;
    }
  }
  if (lastIntermediatePersonId) {
    const parent = personMap.get(firstParentId || '');
    const intermediate = personMap.get(lastIntermediatePersonId);
    if (parent && intermediate && parent.birthYear && intermediate.birthYear) {
      return intermediate.birthYear < parent.birthYear;
    }
  }
  return undefined;
}

export function analyzeRelationshipPath(
  path: RelationshipEdge[],
  fromPersonId: string,
  toPersonId: string,
  personMap: Map<string, Person>
): RelationshipPath | null {
  if (path.length === 0) return null;

  const ctx = initializeContext();

  for (const edge of path) {
    processEdge(edge, ctx, personMap);
  }

  return buildRelationshipPath(ctx, path, fromPersonId, toPersonId, personMap);
}
