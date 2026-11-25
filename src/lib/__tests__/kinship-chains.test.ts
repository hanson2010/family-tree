import { describe, expect, it } from 'vitest';
import { chains, compare, termFor, type Verdict } from '@/test/kinship-chains';

/**
 * Every chain of family steps up to three long, from a man and from a woman, named by the engine
 * and compared with relationship.js; also named with siblings recorded directly instead of through
 * shared parents, which must not change the term. The whole table is kept in
 * __snapshots__/kinship-chains.txt: a change to any term shows there for review
 * (`npx vitest run -u` accepts it).
 */

const MAX_LENGTH = 3;

describe('kinship terms of generated chains', () => {
  it('match the reviewed table', async () => {
    const counts: Record<Verdict | 'representation', number> = {
      agrees: 0,
      general: 0,
      differs: 0,
      unknown: 0,
      none: 0,
      representation: 0,
    };
    const lines: string[] = [];
    for (const speakerMale of [true, false]) {
      for (const chain of chains(MAX_LENGTH, speakerMale)) {
        const term = termFor(chain, speakerMale, 'parents');
        const direct = chain.some((s) => ['哥哥', '弟弟', '姐姐', '妹妹'].includes(s))
          ? termFor(chain, speakerMale, 'direct')
          : term;
        const { verdict, oracle } = compare(term, chain, speakerMale);
        counts[verdict]++;
        if (direct !== term) counts.representation++;
        lines.push(
          [
            `${speakerMale ? '男' : '女'} ${chain.join('的')}`,
            term,
            direct !== term ? `siblings recorded directly: ${direct}` : '',
            `relationship.js: ${oracle.join('、') || '—'}`,
            verdict,
          ]
            .filter(Boolean)
            .join(' | ')
        );
      }
    }
    const summary = Object.entries(counts)
      .map(([key, n]) => `${key} ${n}`)
      .join(', ');
    await expect([`# ${lines.length} chains: ${summary}`, ...lines].join('\n') + '\n').toMatchFileSnapshot(
      './__snapshots__/kinship-chains.txt'
    );
  }, 300_000);
});
