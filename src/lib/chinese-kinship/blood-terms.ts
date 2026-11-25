import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

/**
 * Terms for collateral blood relatives, from the generations each person is below their closest
 * common ancestor (`up` for the speaker, `down` for the other person), up to 5 each way.
 *
 * The prefix says how far the two lines branch apart: through siblings none, through first
 * cousins 堂, through second cousins 从堂, further 族 — when every person linking them on the
 * other person's side of the speaker's own line is a man (the same surname line); otherwise 表.
 *
 *   other person older by g generations — the sibling or cousin of the speaker's ancestor A at
 *   their generation, elder or younger than A by birth years:
 *     g 1: 伯 / 叔 / 姑 (A a man), 舅 / 姨 (A a woman)   e.g. 堂伯 (up 3, down 2)
 *     g 2: 伯公 / 叔公 / 姑婆, 舅公 / 姨婆                 e.g. 堂叔公 (a grandfather's cousin)
 *     g 3: 太伯公 / 太叔公 / 太姑婆, 太舅公 / 太姨婆       e.g. 太伯公 (a great-grandfather's brother)
 *     g 4: 高伯祖 / 高叔祖 / 高祖姑, 高舅祖 / 高祖姨
 *   with 外 before g 2 and above when the line up to A passes through a woman below A;
 *   same generation: 堂哥 / 从堂弟 / 族姐 …, otherwise 表哥 / 表弟 / 表姐 / 表妹;
 *   other person younger by k generations: 侄子 / 侄女, 侄孙 / 侄孙女, 曾侄孙 / 曾侄孙女 (k 1–3),
 *   through a sister 外甥 / 外甥女, 外甥孙 / 外甥孙女, 曾外甥孙 / 曾外甥孙女; with a prefix
 *   堂侄, 从堂侄孙, 表侄 ….
 *
 * Lineal relatives, siblings, aunts and uncles (up 2, down 1) and grandparents' siblings (up 3,
 * down 1) are left to the general rules, and so is a pair linked more closely by marriage: a
 * cousin who is also one's wife is 妻子, a 表侄 who married one's daughter 女婿 (see `closerLink`).
 */

const MAX = 5;
type Step = 'up' | 'down' | 'sibling';

/**
 * The blood-relative term `fromId` uses for `toId`, with their generation distance; or, when a
 * marriage links them more closely, that link's relationships for the general rules to name;
 * or null when none applies
 */
export function bloodTerm(
  fromId: string,
  toId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): { term: string; generations: number } | { closer: Relationship[] } | null {
  const path = closestBloodPath(fromId, toId, relationships);
  if (!path) return null;
  const { nodes, steps } = path;
  const closer = closerLink(fromId, toId, relationships, steps.length);
  if (closer) return { closer };
  const up = steps.filter((s) => s === 'up' || s === 'sibling').length;
  const down = steps.filter((s) => s === 'down' || s === 'sibling').length;
  if (!((up === 1 && down >= 2) || (up >= 2 && down >= 2) || (down === 1 && up >= 4))) return null;

  // The persons below the common ancestor on each side: the speaker's line (speaker first, up to
  // the ancestor's child) and the other person's line (the ancestor's child first). Through a
  // sibling relationship the ancestor is not on the path: the two siblings are its children.
  const top = steps.findIndex((s) => s !== 'up');
  const own = steps[top] === 'sibling' ? nodes.slice(0, top + 1) : nodes.slice(0, top);
  const other = nodes.slice(top + 1);

  const person = (id: string) => personMap.get(id);
  const isMale = (id: string) => person(id)?.gender === Gender.MALE;
  const target = person(toId);
  const male = target?.gender === Gender.MALE;
  const female = target?.gender === Gender.FEMALE;
  const pick = (m: string, f: string, either: string) => (male ? m : female ? f : either);
  const olderThan = (a?: Person, b?: Person) =>
    a?.birthYear != null && b?.birthYear != null && a.birthYear !== b.birthYear ? a.birthYear < b.birthYear : undefined;
  const generations = Math.abs(down - up);

  /** How far apart the lines are: 1 through siblings, 2 through first cousins, … */
  const prefix = (degree: number, sameLine: boolean) =>
    degree <= 1 ? '' : !sameLine ? '表' : degree === 2 ? '堂' : degree === 3 ? '从堂' : '族';

  // The other person is older: the sibling or cousin of the speaker's ancestor A at their generation
  if (up > down) {
    const g = up - down;
    if (g > 4) return null;
    const ancestor = own[g];
    const p = prefix(down, [...own.slice(g + 1), ...other.slice(0, -1)].every(isMale));
    const outer = g >= 2 && own.slice(1, g).some((id) => !isMale(id)) ? '外' : '';
    const elder = olderThan(target, person(ancestor));
    const elderOrYounger = (older: string, younger: string) =>
      elder === undefined ? `${outer}${p}${older}/${outer}${p}${younger}` : `${outer}${p}${elder ? older : younger}`;
    const names: Record<number, [string, string, string, string, string]> = {
      // elder brother, younger brother, sister (of a man); brother, sister (of a woman)
      1: ['伯', '叔', '姑', '舅', '姨'],
      2: ['伯公', '叔公', '姑婆', '舅公', '姨婆'],
      3: ['太伯公', '太叔公', '太姑婆', '太舅公', '太姨婆'],
      4: ['高伯祖', '高叔祖', '高祖姑', '高舅祖', '高祖姨'],
    };
    const [olderBrother, youngerBrother, sister, herBrother, herSister] = names[g];
    if (!isMale(ancestor)) {
      return { term: pick(`${outer}${p}${herBrother}`, `${outer}${p}${herSister}`, `${outer}${p}${herBrother}${herSister}`), generations };
    }
    const brother = elderOrYounger(olderBrother, youngerBrother);
    return { term: pick(brother, `${outer}${p}${sister}`, `${brother}/${outer}${p}${sister}`), generations };
  }

  // The same generation
  if (up === down) {
    const p = prefix(up, [...own.slice(1), ...other.slice(0, -1)].every(isMale));
    const elder = olderThan(target, person(fromId));
    const term =
      elder === undefined
        ? pick(`${p}兄弟`, `${p}姐妹`, `${p}兄弟姐妹`)
        : pick(elder ? `${p}哥` : `${p}弟`, elder ? `${p}姐` : `${p}妹`, `${p}兄弟姐妹`);
    return { term, generations };
  }

  // The other person is younger by k generations: a descendant of the speaker's sibling or cousin,
  // the one at the speaker's generation being other[up - 1]
  const k = down - up;
  if (k > 3) return null;
  const levels = ['', '侄', '侄孙', '曾侄孙'];
  if (up === 1) {
    const brother = isMale(other[0]);
    const base = brother ? levels[k] : ['', '外甥', '外甥孙', '曾外甥孙'][k];
    return { term: pick(k === 1 && brother ? '侄子' : base, `${base}女`, base), generations };
  }
  const p = prefix(up, [...own.slice(1), ...other.slice(0, up)].every(isMale));
  return { term: pick(`${p}${levels[k]}`, `${p}${levels[k]}女`, `${p}${levels[k]}`), generations };
}

/**
 * The relationships of a marriage link between the two closer than their blood path of
 * `bloodSteps`, or null: married to each other, or one married to a blood relative of the other at
 * most two steps away (children of one parent are one step apart, through their parent), the
 * whole link shorter than the blood path. Such links (妻子, 女婿, 嫂子, 公公, 姑父, a husband's
 * grandfather) come first. A marriage in the middle (a sister's husband's son) is a step relation
 * the general rules do not name well, so it does not count.
 */
export function closerLink(
  fromId: string,
  toId: string,
  relationships: Relationship[],
  bloodSteps: number
): Relationship[] | null {
  const spouses = new Map<string, Relationship[]>();
  /** Blood steps: each neighbour with the relationships that lead there */
  const blood = new Map<string, Map<string, Relationship[]>>();
  const children = new Map<string, Relationship[]>();
  const link = (a: string, b: string, via: Relationship[]) => {
    if (!blood.has(a)) blood.set(a, new Map());
    if (!blood.has(b)) blood.set(b, new Map());
    if (!blood.get(a)!.has(b)) blood.get(a)!.set(b, via);
    if (!blood.get(b)!.has(a)) blood.get(b)!.set(a, via);
  };
  for (const r of relationships) {
    if (r.type === RelationshipType.SPOUSE || r.type === RelationshipType.CONCUBINE || r.type === RelationshipType.BETROTHED) {
      spouses.set(r.personAId, [...(spouses.get(r.personAId) ?? []), r]);
      spouses.set(r.personBId, [...(spouses.get(r.personBId) ?? []), r]);
    } else if (r.type === RelationshipType.PARENT_CHILD || r.type === RelationshipType.ADOPTIVE_PARENT || r.type === RelationshipType.FOSTER_PARENT) {
      link(r.personAId, r.personBId, [r]);
      children.set(r.personAId, [...(children.get(r.personAId) ?? []), r]);
    } else if (r.type === RelationshipType.SIBLING || r.type === RelationshipType.HALF_SIBLING) {
      link(r.personAId, r.personBId, [r]);
    }
  }
  for (const kids of children.values()) {
    kids.forEach((a) => kids.forEach((b) => a !== b && link(a.personBId, b.personBId, [a, b])));
  }

  /** The blood relationships from a to b within `max` steps, or null */
  const near = (a: string, b: string, max: number): Relationship[] | null => {
    const via = new Map<string, Relationship[]>([[a, []]]);
    let frontier = [a];
    for (let distance = 0; distance <= max; distance++) {
      if (via.has(b)) return via.get(b)!;
      const next: string[] = [];
      for (const id of frontier) {
        for (const [to, rels] of blood.get(id) ?? []) {
          if (via.has(to)) continue;
          via.set(to, [...via.get(id)!, ...rels]);
          next.push(to);
        }
      }
      frontier = next;
    }
    return null;
  };
  const other = (r: Relationship, id: string) => (r.personAId === id ? r.personBId : r.personAId);

  const married = (spouses.get(fromId) ?? []).find((r) => other(r, fromId) === toId);
  if (married) return [married];
  const max = Math.min(2, bloodSteps - 2);
  if (max < 1) return null;
  for (const r of spouses.get(toId) ?? []) {
    const path = near(fromId, other(r, toId), max);
    if (path) return [...path, r];
  }
  for (const r of spouses.get(fromId) ?? []) {
    const path = near(other(r, fromId), toId, max);
    if (path) return [r, ...path];
  }
  return null;
}

/**
 * The shortest path of blood relationships (parent–child, adoptive, foster, sibling) from one
 * person to another that rises to a common ancestor and comes down again, at most MAX generations
 * each way; a sibling relationship stands for one step up and one down.
 */
function closestBloodPath(
  fromId: string,
  toId: string,
  relationships: Relationship[]
): { nodes: string[]; steps: Step[] } | null {
  const edges = new Map<string, { to: string; step: Step }[]>();
  const add = (a: string, b: string, step: Step) => edges.set(a, [...(edges.get(a) ?? []), { to: b, step }]);
  for (const r of relationships) {
    if (
      r.type === RelationshipType.PARENT_CHILD ||
      r.type === RelationshipType.ADOPTIVE_PARENT ||
      r.type === RelationshipType.FOSTER_PARENT
    ) {
      add(r.personAId, r.personBId, 'down');
      add(r.personBId, r.personAId, 'up');
    } else if (r.type === RelationshipType.SIBLING || r.type === RelationshipType.HALF_SIBLING) {
      add(r.personAId, r.personBId, 'sibling');
      add(r.personBId, r.personAId, 'sibling');
    }
  }

  interface State {
    id: string;
    up: number;
    down: number;
    nodes: string[];
    steps: Step[];
  }
  const seen = new Set<string>();
  const queue: State[] = [{ id: fromId, up: 0, down: 0, nodes: [fromId], steps: [] }];
  while (queue.length > 0) {
    const s = queue.shift()!;
    if (s.id === toId && s.steps.length > 0) return { nodes: s.nodes, steps: s.steps };
    const key = `${s.id}|${s.up}|${s.down}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const { to, step } of edges.get(s.id) ?? []) {
      if (s.nodes.includes(to)) continue;
      let up = s.up;
      let down = s.down;
      if (step === 'up' && down === 0 && up < MAX) up++;
      else if (step === 'down' && down < MAX) down++;
      else if (step === 'sibling' && down === 0 && up < MAX) {
        up++;
        down = 1;
      } else continue;
      queue.push({ id: to, up, down, nodes: [...s.nodes, to], steps: [...s.steps, step] });
    }
  }
  return null;
}
