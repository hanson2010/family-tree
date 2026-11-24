/**
 * What two persons' recorded parents say about them as siblings: null when they share no parent;
 * 'half' only with positive evidence, that is one shared parent and, for each of them, another
 * recorded parent who is not the other's (同父异母 / 同母异父); otherwise 'full'. A missing parent
 * is not evidence: two children of the same father, one with no mother recorded, are plain
 * siblings.
 */
export function siblingKindFromParents(parentsA: Iterable<string>, parentsB: Iterable<string>): 'full' | 'half' | null {
  const a = new Set(parentsA);
  const b = new Set(parentsB);
  const shared = [...a].filter((p) => b.has(p));
  if (shared.length === 0) return null;
  const onlyA = [...a].some((p) => !b.has(p));
  const onlyB = [...b].some((p) => !a.has(p));
  return onlyA && onlyB ? 'half' : 'full';
}
