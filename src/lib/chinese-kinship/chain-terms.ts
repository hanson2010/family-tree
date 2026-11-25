import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';
import table from './kinship-table.json';

/**
 * Terms from the chain of family steps between two persons (爸爸的哥哥的儿子 …), looked up in a table
 * generated from relationship.js (scripts/generate-kinship-table.mjs). The chain is the shortest
 * one through parents, children, siblings and spouses; a sibling is one step whether the two are
 * recorded as siblings or share a parent, elder or younger by birth date, either when the dates do
 * not tell (the table then gives both: 伯父/叔叔). Of equally short chains, the one with more
 * marriages wins, then the one with fewer siblings of unknown age. Adoptive and foster parents
 * count as parents along the way.
 */

export type KinshipRegion = 'southern' | 'northern';
export type KinshipStyle = 'casual' | 'formal';
export interface KinshipOptions {
  /** 外公 / 外婆 (southern) or 姥爷 / 姥姥 (northern); formal terms are the same for both */
  region?: KinshipRegion;
  /** 祖父, 舅父 (formal, the default) or 爷爷, 舅舅 (casual) */
  style?: KinshipStyle;
}

const OWN_TERM_TYPES: RelationshipType[] = [
  RelationshipType.ADOPTIVE_PARENT,
  RelationshipType.FOSTER_PARENT,
  RelationshipType.SWORN_SIBLING,
  RelationshipType.BETROTHED,
];

/** The longest chain in the table */
const MAX_STEPS = 5;

type Code = 'f' | 'm' | 'h' | 'w' | 's' | 'd' | 'ob' | 'lb' | 'xb' | 'os' | 'ls' | 'xs';
type Entry = string | [southern: string, northern: string, formal: string];
const TERMS = table as unknown as Record<string, Entry>;

interface Step {
  to: string;
  code: Code;
  marriage: boolean;
  /** A sibling of unknown age */
  unsure: boolean;
}

/** Compare two birth dates: negative when a is older, positive when younger, 0 when they do not tell */
function compareBirth(a?: Person, b?: Person): number {
  const parts = (p?: Person) => [p?.birthYear, p?.birthMonth, p?.birthDay];
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] == null || y[i] == null) return 0;
    if (x[i] !== y[i]) return x[i]! - y[i]!;
  }
  return 0;
}

/** Each person's steps to their relatives */
function stepsOf(relationships: Relationship[], personMap: Map<string, Person>): Map<string, Step[]> {
  const steps = new Map<string, Step[]>();
  const gender = (id: string) => personMap.get(id)?.gender;
  const add = (from: string, step: Step) => steps.set(from, [...(steps.get(from) ?? []), step]);
  const parentsOf = new Map<string, string[]>();
  const siblingPairs = new Set<string>();

  const addSiblings = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (a === b || siblingPairs.has(key)) return;
    siblingPairs.add(key);
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const g = gender(to);
      if (g !== Gender.MALE && g !== Gender.FEMALE) continue;
      const order = compareBirth(personMap.get(to), personMap.get(from));
      const male = g === Gender.MALE;
      const code: Code = order < 0 ? (male ? 'ob' : 'os') : order > 0 ? (male ? 'lb' : 'ls') : male ? 'xb' : 'xs';
      add(from, { to, code, marriage: false, unsure: order === 0 });
    }
  };

  for (const r of relationships) {
    const { personAId: a, personBId: b } = r;
    if (!personMap.has(a) || !personMap.has(b)) continue;
    if (
      r.type === RelationshipType.PARENT_CHILD ||
      r.type === RelationshipType.ADOPTIVE_PARENT ||
      r.type === RelationshipType.FOSTER_PARENT
    ) {
      parentsOf.set(b, [...(parentsOf.get(b) ?? []), a]);
      const ga = gender(a);
      const gb = gender(b);
      if (ga === Gender.MALE || ga === Gender.FEMALE) add(b, { to: a, code: ga === Gender.MALE ? 'f' : 'm', marriage: false, unsure: false });
      if (gb === Gender.MALE || gb === Gender.FEMALE) add(a, { to: b, code: gb === Gender.MALE ? 's' : 'd', marriage: false, unsure: false });
    } else if (r.type === RelationshipType.SPOUSE || r.type === RelationshipType.CONCUBINE) {
      const ga = gender(a);
      const gb = gender(b);
      if (!ga || !gb || ga === gb || ga === Gender.UNKNOWN || gb === Gender.UNKNOWN) continue;
      add(a, { to: b, code: gb === Gender.MALE ? 'h' : 'w', marriage: true, unsure: false });
      add(b, { to: a, code: ga === Gender.MALE ? 'h' : 'w', marriage: true, unsure: false });
    } else if (r.type === RelationshipType.SIBLING || r.type === RelationshipType.HALF_SIBLING) {
      addSiblings(a, b);
    }
  }
  // Children of one parent are siblings
  const childrenOf = new Map<string, string[]>();
  parentsOf.forEach((parents, child) => parents.forEach((p) => childrenOf.set(p, [...(childrenOf.get(p) ?? []), child])));
  childrenOf.forEach((children) => children.forEach((a, i) => children.slice(i + 1).forEach((b) => addSiblings(a, b))));
  return steps;
}

/** A chain: the steps, and the persons it passes, the speaker first */
interface Chain {
  codes: Code[];
  nodes: string[];
}

/**
 * The best chain from one person to everyone within MAX_STEPS: the shortest; of those, the one
 * with more marriages (a cousin who married one's daughter is 女婿, the closer link), then with the
 * marriages nearer the speaker (one's wife's nephew 内侄 before one's daughter's brother-in-law
 * 姻侄), then with fewer siblings of unknown age
 */
function chainsFrom(fromId: string, steps: Map<string, Step[]>): Map<string, Chain> {
  type Found = Chain & { marriages: number; later: number; unsure: number };
  const cost = (f: Found) => -f.marriages * 10000 + f.later * 10 + f.unsure;
  const best = new Map<string, Found>([[fromId, { codes: [], nodes: [fromId], marriages: 0, later: 0, unsure: 0 }]]);
  let frontier = [fromId];
  for (let length = 1; length <= MAX_STEPS && frontier.length > 0; length++) {
    const reached = new Map<string, Found>();
    for (const id of frontier) {
      const here = best.get(id)!;
      for (const step of steps.get(id) ?? []) {
        if (best.has(step.to)) continue;
        const candidate: Found = {
          codes: [...here.codes, step.code],
          nodes: [...here.nodes, step.to],
          marriages: here.marriages + (step.marriage ? 1 : 0),
          later: here.later + (step.marriage ? length : 0),
          unsure: here.unsure + (step.unsure ? 1 : 0),
        };
        const current = reached.get(step.to);
        if (!current || cost(candidate) < cost(current)) reached.set(step.to, candidate);
      }
    }
    reached.forEach((value, id) => best.set(id, value));
    frontier = [...reached.keys()];
  }
  best.delete(fromId);
  return best;
}

// Each speaker's chains, for the persons and relationships they were found in (the app replaces
// these arrays when anything changes, so they identify the data)
const cache = new WeakMap<Relationship[], WeakMap<Person[], { steps: Map<string, Step[]>; from: Map<string, Map<string, Chain>> }>>();

function cached(persons: Person[], relationships: Relationship[], personMap: Map<string, Person>) {
  let byPersons = cache.get(relationships);
  if (!byPersons) cache.set(relationships, (byPersons = new WeakMap()));
  let entry = byPersons.get(persons);
  if (!entry) byPersons.set(persons, (entry = { steps: stepsOf(relationships, personMap), from: new Map() }));
  return entry;
}

function chainBetween(
  fromId: string,
  toId: string,
  persons: Person[],
  relationships: Relationship[],
  personMap: Map<string, Person>
): Chain | null {
  const entry = cached(persons, relationships, personMap);
  let chains = entry.from.get(fromId);
  if (!chains) {
    chains = chainsFrom(fromId, entry.steps);
    if (entry.from.size > 50) entry.from.clear();
    entry.from.set(fromId, chains);
  }
  return chains.get(toId) ?? null;
}

/**
 * Terms the app keeps in place of the table's, from earlier decisions: 孙媳 and 岳祖父 for the
 * spouses of grandchildren and their grandparents, and 舅嫂, 内弟媳, 连襟, 妯娌, 姐夫, 妹夫 for the
 * spouses of a spouse's siblings. Keys as in the table: speaker (1 a man, 0 a woman) and chain.
 */
const OVERRIDES: Record<string, string> = Object.fromEntries(
  ['1', '0'].flatMap((sex) =>
    Object.entries({
      's,s,w': '孙媳',
      'd,s,w': '外孙媳',
      's,s,s,w': '曾孙媳',
      'd,s,s,w': '外曾孙媳',
    }).map(([chain, term]) => [`${sex}:${chain}`, term])
  ).concat(
    Object.entries({
      '1:w,f,f': '岳祖父',
      '1:w,f,m': '岳祖母',
      '1:w,m,f': '岳外祖父',
      '1:w,m,m': '岳外祖母',
      '1:w,f,f,f': '岳曾祖父',
      '1:w,f,f,m': '岳曾祖母',
      '1:w,m,f,f': '岳外曾祖父',
      '1:w,m,f,m': '岳外曾祖母',
      '1:w,ob,w': '舅嫂',
      '1:w,lb,w': '内弟媳',
      '1:w,xb,w': '舅嫂/内弟媳',
      '1:w,os,h': '襟兄',
      '1:w,ls,h': '襟弟',
      '1:w,xs,h': '连襟',
      '0:h,ob,w': '嫂子',
      '0:h,lb,w': '弟妹',
      '0:h,xb,w': '妯娌',
      '0:h,os,h': '姐夫',
      '0:h,ls,h': '妹夫',
      '0:h,xs,h': '姐夫/妹夫',
    })
  )
);

/**
 * The app's wording of a table term for a chain, from reviewed decisions:
 * - a wife's brother's children are 内侄 / 内侄女 (the table: 妻侄子, 舅侄, 姻侄, and so on further down);
 * - a cousin's child is 表侄 / 表侄女, without the side (the table: 姑表侄男, 舅表侄女 …), and
 *   侄男 is 侄;
 * - a husband's mother is 婆婆 in every style (the table's formal word: 婆母);
 * - a relative through women more than one 表 away (second cousins through a grandmother: the
 *   table's 舅表舅表姐, 姑表叔表哥 …) is named with the plain 表 and the last part (表姐, 表哥), as
 *   people address such 远房表亲; kinship terms name only one level of 表.
 */
function appWording(term: string, key: string): string {
  const wifeBrotherLine = /^1:w,(ob|lb|xb),[sd]/.test(key);
  const words = term.split('/').map((word) => {
    let w = word;
    if (wifeBrotherLine) w = w.replace(/^(妻侄子|妻侄|舅侄|姻侄)/, '内侄');
    w = w.replace(/(姑|舅|姨)表侄/, '表侄').replace(/侄男/, '侄').replace(/婆母/, '婆婆');
    if ((w.match(/表/g) ?? []).length >= 2) w = `表${w.slice(w.lastIndexOf('表') + 1)}`;
    return w;
  });
  return words.filter((w, i) => words.indexOf(w) === i).join('/');
}

/** Whether a term is the elder form of its pair (堂哥, 表嫂, 姐夫, 伯母) or the younger (堂弟, 表弟媳, 妹夫, 婶婶) */
const ELDER = /哥|姐|嫂|伯|兄/;
const YOUNGER = /弟|妹|叔|婶/;

/**
 * One of two terms that differ in elder or younger (堂哥/堂弟, 堂伯/堂叔, 表嫂/表弟媳, 堂姐夫/堂妹夫),
 * chosen by birth dates. The age that counts is the blood relative's: the other person, or, when
 * the chain ends with a marriage, the relative they married (a 表哥's wife is 表嫂). It is compared
 * with the speaker for the same generation, with the speaker's ancestor of that generation for an
 * elder one. Both terms when the dates do not tell, or the chain is not a straight blood line up
 * and across (with at most that last marriage).
 */
function byAge(term: string, chain: Chain, personMap: Map<string, Person>): string {
  const [a, b, ...rest] = term.split('/');
  if (!b || rest.length > 0) return term;
  const isElder = (w: string) => ELDER.test(w) && !YOUNGER.test(w);
  const isYounger = (w: string) => YOUNGER.test(w) && !isElder(w);
  const [elder, younger] = isElder(a) && isYounger(b) ? [a, b] : isElder(b) && isYounger(a) ? [b, a] : [null, null];
  if (!elder || !younger) return term;

  // The blood line, and the relative at its end
  const marriedAtEnd = ['h', 'w'].includes(chain.codes[chain.codes.length - 1]);
  const codes = marriedAtEnd ? chain.codes.slice(0, -1) : chain.codes;
  if (codes.length === 0 || codes.some((c) => c === 'h' || c === 'w')) return term;
  const relative = personMap.get(chain.nodes[codes.length]);

  const up = codes.filter((c) => c === 'f' || c === 'm').length;
  const down = codes.filter((c) => c === 's' || c === 'd').length;
  const generation = up - down;
  if (generation < 0) return term;
  // The speaker, or the ancestor reached by the first `generation` steps when they all go up
  if (generation > 0 && !codes.slice(0, generation).every((c) => c === 'f' || c === 'm')) return term;
  const order = compareBirth(relative, personMap.get(chain.nodes[generation]));
  return order < 0 ? elder : order > 0 ? younger : term;
}

const SIBLING_CODES: Code[] = ['ob', 'lb', 'xb', 'os', 'ls', 'xs'];
const NUMBERS = ['', '大', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * A parent's brother or sister numbered by birth order (大姨, 二姨, 三姨, 老姨; 大伯父, 三叔父 …), or
 * null. The order is among the brothers, or the sisters, of that generation, the parent included:
 * the eldest is 大, then 二, 三 …, the youngest of three or more 老 in casual northern terms and 小
 * otherwise. A father's brother is 伯 or 叔 by whether he is older or younger than the father.
 * Null when anyone in that group has no birth date, or two share one, so the order is not known.
 */
function numbered(
  chain: Chain,
  start: number,
  steps: Map<string, Step[]>,
  personMap: Map<string, Person>,
  options: KinshipOptions
): string | null {
  const codes = chain.codes.slice(start);
  if (codes.length !== 2 || !['f', 'm'].includes(codes[0]) || !SIBLING_CODES.includes(codes[1])) return null;
  const parentId = chain.nodes[start + 1];
  const targetId = chain.nodes[start + 2];
  const parent = personMap.get(parentId);
  const target = personMap.get(targetId);
  if (!parent || !target) return null;
  const male = target.gender === Gender.MALE;

  const group = [targetId, ...(steps.get(targetId) ?? []).filter((s) => SIBLING_CODES.includes(s.code)).map((s) => s.to)]
    .filter((id, i, all) => all.indexOf(id) === i)
    .map((id) => personMap.get(id))
    .filter((p): p is Person => !!p && p.gender === target.gender);
  if (group.length < 2 || group.some((p) => p.birthYear == null)) return null;
  const ordered = [...group].sort((a, b) => compareBirth(a, b));
  if (ordered.some((p, i) => i > 0 && compareBirth(ordered[i - 1], p) === 0)) return null;
  const rank = ordered.findIndex((p) => p.id === targetId) + 1;
  if (rank < 1 || rank >= NUMBERS.length) return null;

  const formal = options.style !== 'casual';
  const youngest = rank === ordered.length && ordered.length > 2;
  const number = youngest ? (!formal && options.region === 'northern' ? '老' : '小') : NUMBERS[rank];

  let base: string;
  if (codes[0] === 'f' && male) {
    const order = compareBirth(target, parent);
    if (order === 0) return null;
    base = order < 0 ? (formal ? '伯父' : '伯') : formal ? '叔父' : '叔';
  } else if (codes[0] === 'f') {
    base = formal ? '姑母' : '姑';
  } else if (male) {
    base = formal ? '舅父' : '舅';
  } else {
    base = formal ? '姨母' : '姨';
  }
  return number + base;
}

/**
 * The term `fromId` uses for `toId` from the chain between them, or null when the chain is longer
 * than the table, passes someone of unknown gender, or the table has no term for it. Siblings
 * themselves (with 大哥, 二姐 and 同父异母) are left to the general rules.
 */
export function chainTerm(
  fromId: string,
  toId: string,
  persons: Person[],
  relationships: Relationship[],
  personMap: Map<string, Person>,
  options: KinshipOptions = {}
): { term: string; generations: number } | null {
  const speaker = personMap.get(fromId)?.gender;
  if (speaker !== Gender.MALE && speaker !== Gender.FEMALE) return null;
  // A relationship of its own between the two names them (养父, 寄父, 结拜兄弟, 未婚妻 …)
  const own = relationships.some(
    (r) =>
      OWN_TERM_TYPES.includes(r.type) &&
      ((r.personAId === fromId && r.personBId === toId) || (r.personAId === toId && r.personBId === fromId))
  );
  if (own) return null;
  const chain = chainBetween(fromId, toId, persons, relationships, personMap);
  if (!chain || chain.codes.length === 0) return null;
  if (chain.codes.length === 1 && ['ob', 'lb', 'xb', 'os', 'ls', 'xs'].includes(chain.codes[0])) return null;

  const key = `${speaker === Gender.MALE ? 1 : 0}:${chain.codes.join(',')}`;
  const override = OVERRIDES[key];
  // A wife calls her husband's relatives two or more steps from him as he does (祖父, 叔父, 侄子,
  // 外甥 …); his parents (公公, 婆婆), siblings (大伯子, 小姑子 …) and their spouses keep their own
  // terms
  const fromHusband = chain.codes.slice(1);
  const asHusband = speaker === Gender.FEMALE && chain.codes[0] === 'h' && fromHusband.length >= 2;
  const husbandKey = `1:${fromHusband.join(',')}`;
  const entry = override ?? (asHusband ? TERMS[husbandKey] ?? TERMS[key] : TERMS[key]);
  if (!entry) return null;
  // Formal unless asked otherwise, as the app's terms always were
  const chosen =
    typeof entry === 'string' ? entry : options.style !== 'casual' ? entry[2] : options.region === 'northern' ? entry[1] : entry[0];
  const term = override ? chosen : appWording(chosen, asHusband && TERMS[husbandKey] ? husbandKey : key);
  const up = chain.codes.filter((c) => c === 'f' || c === 'm').length;
  const down = chain.codes.filter((c) => c === 's' || c === 'd').length;
  // A parent's (or, for a wife, her husband's parent's) brothers and sisters by birth order
  const steps = cached(persons, relationships, personMap).steps;
  const ranked = override ? null : numbered(chain, asHusband ? 1 : 0, steps, personMap, options);
  return { term: ranked ?? byAge(term, chain, personMap), generations: Math.abs(up - down) };
}
