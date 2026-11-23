import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

/**
 * Terms for collateral blood relatives a little further out, from the generations each person is
 * below their closest common ancestor (`up` for the speaker, `down` for the other person), up to
 * a common great-grandparent:
 *
 *   up 1, down 2: 侄子 / 侄女 (a brother's child), 外甥 / 外甥女 (a sister's child)
 *   up 1, down 3: 侄孙 / 侄孙女, 外甥孙 / 外甥孙女
 *   up 2, down 2: 堂哥 / 堂弟 / 堂姐 / 堂妹, otherwise 表哥 / 表弟 / 表姐 / 表妹
 *   up 2, down 3: 堂侄 / 堂侄女, otherwise 表侄 / 表侄女
 *   up 3, down 2: a parent's cousin: 堂伯 / 堂叔 / 堂姑 (表… when not of the same surname line);
 *                 on the mother's side 堂舅 / 堂姨 or 表舅 / 表姨
 *   up 3, down 3: 从堂哥 / 从堂弟 / 从堂姐 / 从堂妹, otherwise 表哥 / 表弟 / 表姐 / 表妹
 *
 * 堂 means every person linking the two to their common ancestor is a man (the same surname line);
 * otherwise the relation is 表. Elder or younger comes from birth years. Lineal relatives, siblings,
 * aunts and uncles and grandparents' siblings are left to the general rules.
 */

const MAX = 3;
type Step = 'up' | 'down' | 'sibling';

/** The blood-relative term `fromId` uses for `toId`, with their generation distance, or null when none applies */
export function bloodTerm(
  fromId: string,
  toId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): { term: string; generations: number } | null {
  const path = closestBloodPath(fromId, toId, relationships);
  if (!path) return null;
  const { nodes, steps } = path;
  const up = steps.filter((s) => s === 'up' || s === 'sibling').length;
  const down = steps.filter((s) => s === 'down' || s === 'sibling').length;
  if (!((up === 1 && down >= 2) || (up >= 2 && down >= 2))) return null;

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
  const elder = olderThan(target, person(fromId));
  const sibTerm = (prefix: string) =>
    elder === undefined
      ? pick(`${prefix}兄弟`, `${prefix}姐妹`, `${prefix}兄弟姐妹`)
      : pick(elder ? `${prefix}哥` : `${prefix}弟`, elder ? `${prefix}姐` : `${prefix}妹`, `${prefix}兄弟姐妹`);

  // Linking persons: everyone between each end and the common ancestor
  const links = [...own.slice(1), ...other.slice(0, -1)];
  const sameLine = links.every(isMale);
  const generations = Math.abs(down - up);

  if (up === 1) {
    const brother = isMale(other[0]);
    if (down === 2) return { term: brother ? pick('侄子', '侄女', '侄') : pick('外甥', '外甥女', '外甥'), generations };
    return { term: brother ? pick('侄孙', '侄孙女', '侄孙') : pick('外甥孙', '外甥孙女', '外甥孙'), generations };
  }
  if (up === 2 && down === 2) return { term: sibTerm(sameLine ? '堂' : '表'), generations };
  if (up === 2 && down === 3) {
    return { term: sameLine ? pick('堂侄', '堂侄女', '堂侄') : pick('表侄', '表侄女', '表侄'), generations };
  }
  if (up === 3 && down === 2) {
    // A parent's cousin, named from the speaker's parent on this line
    // On the mother's side her own line decides: her 堂 brother is the speaker's 堂舅
    const parent = own[1];
    const prefix = links.filter((id) => id !== parent).every(isMale) ? '堂' : '表';
    if (!isMale(parent)) return { term: pick(`${prefix}舅`, `${prefix}姨`, `${prefix}舅姨`), generations };
    const older = olderThan(target, person(parent));
    const uncle = older === undefined ? `${prefix}伯/${prefix}叔` : older ? `${prefix}伯` : `${prefix}叔`;
    return { term: pick(uncle, `${prefix}姑`, `${prefix}伯叔姑`), generations };
  }
  if (up === 3 && down === 3) return { term: sibTerm(sameLine ? '从堂' : '表'), generations };
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
