import type { Relationship } from '@/types';
import { RelationshipType } from '@/types';

/** Generations up to the common ancestor, and down from it, that still count as close */
const MAX_GENERATIONS = 3;

/**
 * Persons within 四代 of `rootId`: lineal relatives up to great-grandparents and
 * great-grandchildren (e.g. 曾祖父, 曾孙), and collateral relatives whose common ancestor with the
 * root is at most a great-grandparent, both no more than three generations below it (siblings,
 * 伯叔姑, 伯祖, 堂伯, first and second cousins, nephews and nieces, 堂侄, 侄孙). One marriage may
 * sit at either end of that blood relation,
 * so spouses (and a man's other wives and concubines), in-laws such as 岳父 or 儿媳, and the
 * spouses of close relatives such as 婶婶 count too. Adoptive and foster parents count as parents;
 * betrothal and sworn kinship count as marriages.
 */
export function closeKinIds(rootId: string, relationships: Relationship[]): Set<string> {
  type Step = 'up' | 'down' | 'sibling' | 'marriage';
  const steps = new Map<string, { to: string; step: Step }[]>();
  const add = (from: string, to: string, step: Step) => steps.set(from, [...(steps.get(from) ?? []), { to, step }]);
  for (const r of relationships) {
    switch (r.type) {
      case RelationshipType.PARENT_CHILD:
      case RelationshipType.ADOPTIVE_PARENT:
      case RelationshipType.FOSTER_PARENT:
        add(r.personAId, r.personBId, 'down');
        add(r.personBId, r.personAId, 'up');
        break;
      case RelationshipType.SIBLING:
      case RelationshipType.HALF_SIBLING:
        add(r.personAId, r.personBId, 'sibling');
        add(r.personBId, r.personAId, 'sibling');
        break;
      default:
        add(r.personAId, r.personBId, 'marriage');
        add(r.personBId, r.personAId, 'marriage');
    }
  }

  // State: generations up to the common ancestor, down from it, and marriages at the start and end
  interface State {
    id: string;
    up: number;
    down: number;
    marriedFirst: boolean;
    ended: boolean;
  }
  const key = (s: State) => `${s.id}|${s.up}|${s.down}|${+s.marriedFirst}|${+s.ended}`;
  const close = new Set<string>([rootId]);
  const seen = new Set<string>();
  const queue: State[] = [{ id: rootId, up: 0, down: 0, marriedFirst: false, ended: false }];
  while (queue.length > 0) {
    const s = queue.shift()!;
    if (seen.has(key(s))) continue;
    seen.add(key(s));
    close.add(s.id);
    if (s.ended) continue;
    for (const { to, step } of steps.get(s.id) ?? []) {
      let next: State | null = null;
      if (step === 'marriage') {
        const atStart = s.up === 0 && s.down === 0 && !s.marriedFirst;
        next = atStart ? { ...s, id: to, marriedFirst: true } : { ...s, id: to, ended: true };
      } else if (step === 'up' && s.down === 0 && s.up < MAX_GENERATIONS) {
        next = { ...s, id: to, up: s.up + 1 };
      } else if (step === 'down' && s.down < MAX_GENERATIONS) {
        next = { ...s, id: to, down: s.down + 1 };
      } else if (step === 'sibling' && s.down === 0 && s.up < MAX_GENERATIONS) {
        next = { ...s, id: to, up: s.up + 1, down: 1 };
      }
      if (next) queue.push(next);
    }
  }
  return close;
}
