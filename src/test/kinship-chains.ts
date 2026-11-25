import relationship from 'relationship.js';
import { getChineseRelationshipLabel } from '@/lib/chinese-kinship';
import { Gender, RelationshipType, type Person, type Relationship } from '@/types';

/**
 * Checks of the kinship engine on generated families, for the tests: every chain of family steps
 * (爸爸的哥哥的儿子 …) up to a length, built as a small family and named by the engine, then compared
 * with relationship.js (an independent Chinese kinship calculator, MIT licence) and with the same
 * family whose siblings are recorded directly instead of through shared parents.
 */

export type Step = '爸爸' | '妈妈' | '哥哥' | '弟弟' | '姐姐' | '妹妹' | '儿子' | '女儿' | '老公' | '老婆';
const STEPS: Step[] = ['爸爸', '妈妈', '哥哥', '弟弟', '姐姐', '妹妹', '儿子', '女儿', '老公', '老婆'];
type Kind = 'parent' | 'child' | 'sibling' | 'spouse';
const kindOf = (s: Step): Kind =>
  s === '爸爸' || s === '妈妈' ? 'parent' : s === '儿子' || s === '女儿' ? 'child' : s === '老公' || s === '老婆' ? 'spouse' : 'sibling';
const isMaleStep = (s: Step) => ['爸爸', '哥哥', '弟弟', '儿子', '老公'].includes(s);

/**
 * Chains of up to `maxLength` steps from a speaker of the given sex, leaving out steps that undo or
 * restate the previous one (爸爸的儿子, 哥哥的爸爸, 老婆的儿子, 爸爸的老婆) and more than two marriages
 */
export function chains(maxLength: number, speakerMale: boolean): Step[][] {
  const out: Step[][] = [];
  const grow = (chain: Step[], male: boolean) => {
    if (chain.length > 0) out.push(chain);
    if (chain.length === maxLength) return;
    const last = chain.length > 0 ? kindOf(chain[chain.length - 1]) : null;
    const marriages = chain.filter((s) => kindOf(s) === 'spouse').length;
    for (const step of STEPS) {
      const kind = kindOf(step);
      if (last === 'parent' && (kind === 'child' || kind === 'spouse')) continue;
      if (last === 'child' && kind === 'parent') continue;
      if (last === 'sibling' && (kind === 'sibling' || kind === 'parent')) continue;
      if (last === 'spouse' && (kind === 'spouse' || kind === 'child')) continue;
      if (kind === 'spouse' && (marriages >= 2 || (step === '老公') === male)) continue;
      grow([...chain, step], isMaleStep(step));
    }
  };
  grow([], speakerMale);
  return out;
}

/**
 * A family for a chain: the speaker, born 2000, and one person per step. Parents are 28 years
 * older, an elder sibling 3 years older, a spouse 1 year apart; birth months are all different, so
 * no two persons are the same age. Siblings share both parents (created when missing), or are
 * linked by a sibling relationship alone.
 */
export function family(chain: Step[], speakerMale: boolean, siblings: 'parents' | 'direct') {
  const persons: Person[] = [];
  const relationships: Relationship[] = [];
  const person = (male: boolean, birthYear: number) => {
    const p: Person = {
      id: `p${persons.length}`,
      name: `p${persons.length}`,
      gender: male ? Gender.MALE : Gender.FEMALE,
      birthYear,
      birthMonth: (persons.length % 12) + 1,
      isPrivate: false,
      createdBy: 'u',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    persons.push(p);
    return p;
  };
  const link = (a: string, b: string, type: RelationshipType) =>
    relationships.push({
      id: `r${relationships.length}`,
      personAId: a,
      personBId: b,
      type,
      createdBy: 'u',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  const parentsOf = (id: string) =>
    relationships.filter((r) => r.type === RelationshipType.PARENT_CHILD && r.personBId === id).map((r) => r.personAId);

  const speaker = person(speakerMale, 2000);
  let current = speaker;
  for (const step of chain) {
    const kind = kindOf(step);
    const male = isMaleStep(step);
    const year = current.birthYear!;
    let next: Person;
    if (kind === 'parent') {
      next = person(male, year - 28);
      link(next.id, current.id, RelationshipType.PARENT_CHILD);
    } else if (kind === 'child') {
      next = person(male, year + 28);
      link(current.id, next.id, RelationshipType.PARENT_CHILD);
    } else if (kind === 'spouse') {
      next = person(male, year + (male ? -1 : 1));
      // As the app stores them: the woman is person A
      if (male) link(current.id, next.id, RelationshipType.SPOUSE);
      else link(next.id, current.id, RelationshipType.SPOUSE);
    } else {
      next = person(male, year + (step === '哥哥' || step === '姐姐' ? -3 : 3));
      if (siblings === 'direct') {
        link(current.id, next.id, RelationshipType.SIBLING);
      } else {
        let parents = parentsOf(current.id);
        if (parents.length === 0) {
          const father = person(true, year - 28);
          const mother = person(false, year - 26);
          link(father.id, current.id, RelationshipType.PARENT_CHILD);
          link(mother.id, current.id, RelationshipType.PARENT_CHILD);
          link(mother.id, father.id, RelationshipType.SPOUSE);
          parents = [father.id, mother.id];
        }
        for (const parent of parents) link(parent, next.id, RelationshipType.PARENT_CHILD);
      }
    }
    current = next;
  }
  return { persons, relationships, speaker: speaker.id, target: current.id };
}

/** The engine's term for the end of a chain, the family built either way */
export function termFor(chain: Step[], speakerMale: boolean, siblings: 'parents' | 'direct'): string {
  const f = family(chain, speakerMale, siblings);
  return getChineseRelationshipLabel(f.speaker, f.target, f.persons, f.relationships);
}

const GROUPS: Record<string, string[]> = {
  兄弟: ['哥哥', '弟弟'],
  姐妹: ['姐姐', '妹妹'],
  子女: ['儿子', '女儿'],
  父母: ['爸爸', '妈妈'],
  兄弟姐妹: ['哥哥', '弟弟', '姐姐', '妹妹'],
};

/** Whether a chain relationship.js gives for a term describes this chain */
function describes(oracleChain: string, chain: Step[], speakerMale: boolean): boolean {
  let text = oracleChain;
  const condition = /^\((男性|女性)\)/.exec(text);
  if (condition) {
    if ((condition[1] === '男性') !== speakerMale) return false;
    text = text.slice(condition[0].length);
  }
  const steps = text.split('的');
  return steps.length === chain.length && steps.every((s, i) => s === chain[i] || (GROUPS[s] ?? []).includes(chain[i]));
}

/**
 * How the engine's term compares with relationship.js:
 * - 'agrees': relationship.js gives the term for the chain, or the term means this chain to it;
 * - 'general': the app's general 表 (表哥 …) where relationship.js names the side (姑表哥, 舅表哥, 姨哥);
 * - 'differs': relationship.js knows the term but not for this chain;
 * - 'unknown': relationship.js does not know the term (继母, 大姑子 …);
 * - 'none': the engine gives no term.
 */
export type Verdict = 'agrees' | 'general' | 'differs' | 'unknown' | 'none';

export function compare(term: string, chain: Step[], speakerMale: boolean): { verdict: Verdict; oracle: string[] } {
  const sex = speakerMale ? 1 : 0;
  const oracle = relationship({ text: chain.join('的'), sex });
  if (!term || term === '未知关系') return { verdict: 'none', oracle };
  const alternatives = term.split('/');
  if (alternatives.some((a) => oracle.includes(a))) return { verdict: 'agrees', oracle };
  let known = false;
  for (const a of alternatives) {
    const meanings = relationship({ text: a, type: 'chain', sex });
    if (meanings.length > 0) known = true;
    if (meanings.some((m) => describes(m, chain, speakerMale))) return { verdict: 'agrees', oracle };
  }
  const general = alternatives.some((a) => /^表(哥|弟|姐|妹)$/.test(a) && oracle.some((o) => new RegExp(`^(姑表|舅表|姨)${a.slice(1)}$`).test(o)));
  if (general) return { verdict: 'general', oracle };
  return { verdict: known ? 'differs' : 'unknown', oracle };
}
