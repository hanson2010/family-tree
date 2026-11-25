// Generate src/lib/chinese-kinship/kinship-table.json from relationship.js (MIT,
// github.com/mumuy/relationship): the term for every chain of family steps up to MAX_STEPS long,
// from a man and from a woman, in three versions: southern casual (relationship.js's own first
// word), northern casual (姥爷, 姥姥 …) and formal (祖父, 外祖母, 舅父 …).
//
//   npm run kinship:table
//
// relationship.js takes about 10 ms a lookup, so the chains are shared among worker threads.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const OUTPUT = fileURLToPath(new URL('../src/lib/chinese-kinship/kinship-table.json', import.meta.url));
const MAX_STEPS = Number(process.env.KINSHIP_MAX_STEPS ?? 5);
const MAX_MARRIAGES = 2;

/** Step codes, as relationship.js writes them, and the words its text input takes */
const WORDS = {
  f: '爸爸', m: '妈妈', h: '老公', w: '老婆', s: '儿子', d: '女儿',
  ob: '哥哥', lb: '弟弟', xb: '兄弟', os: '姐姐', ls: '妹妹', xs: '姐妹',
};
const CODES = Object.keys(WORDS);
const kindOf = (c) => ('fm'.includes(c) && c.length === 1 ? 'parent' : 'sd'.includes(c) && c.length === 1 ? 'child' : 'hw'.includes(c) && c.length === 1 ? 'spouse' : 'sibling');
const isMale = (c) => ['f', 'h', 's', 'ob', 'lb', 'xb'].includes(c);

/** Chains from a speaker, without steps that undo or restate the previous one */
function chains(speakerMale) {
  const out = [];
  const grow = (chain, male) => {
    if (chain.length > 0) out.push(chain);
    if (chain.length === MAX_STEPS) return;
    const last = chain.length > 0 ? kindOf(chain[chain.length - 1]) : null;
    const marriages = chain.filter((c) => kindOf(c) === 'spouse').length;
    for (const code of CODES) {
      const kind = kindOf(code);
      if (last === 'parent' && (kind === 'child' || kind === 'spouse')) continue;
      if (last === 'child' && kind === 'parent') continue;
      if (last === 'sibling' && (kind === 'sibling' || kind === 'parent')) continue;
      if (last === 'spouse' && (kind === 'spouse' || kind === 'child')) continue;
      if (kind === 'spouse' && (marriages >= MAX_MARRIAGES || (code === 'h') === male)) continue;
      grow([...chain, code], isMale(code));
    }
  };
  grow([], speakerMale);
  return out;
}

/**
 * relationship.js's own lists of words for each relative, read from its file: "f,ob":[…], and the
 * one-step keys, which the minified file writes without quotes (f:[…])
 */
function termLists() {
  const src = readFileSync(require.resolve('relationship.js'), 'utf8');
  const re = /(?:"([^"\]]{1,60})"|[{,]([a-z]{1,2})):\[((?:"[^"]*",?)+)\]/g;
  const lists = new Map();
  for (let m; (m = re.exec(src)); ) {
    const key = m[1] ?? m[2];
    const list = JSON.parse(`[${m[3]}]`);
    if (!lists.has(key) || list.length > lists.get(key).length) lists.set(key, list);
  }
  return lists;
}

/** Formal words for casual ones whose lists do not follow the 父 / 母 pattern */
const FORMAL_WORDS = { 老公: '丈夫', 老婆: '妻子' };

/**
 * Formal words relationship.js lacks, by relative: a grandmother's brother is 舅祖父 (its list has
 * only 太舅父 as a 父 form), his wife 舅祖母
 */
const FORMAL_BY_KEY = { 'f,m,xb': '舅祖父', 'f,m,xb,w': '舅祖母' };

/** The lists reordered for a version: the word it prefers first, when the list has one */
function modes(lists) {
  const formal = {};
  const northern = {};
  const casual = /(.)\1$|^外公$|^外婆$|姑妈$|姨妈$|^太公$|^太婆$/;
  for (const [key, list] of lists) {
    // Formal: a 父 / 母 / 亲 form in place of a casual first word (爸爸 → 父亲, 爷爷 → 祖父,
    // 外婆 → 外祖母, 舅舅 → 舅父), and 丈夫 / 妻子 for 老公 / 老婆
    const byKey = FORMAL_BY_KEY[key];
    const explicit = FORMAL_WORDS[list[0]];
    if (byKey) {
      formal[key] = [byKey, ...list.filter((w) => w !== byKey)];
    } else if (explicit && list.includes(explicit)) {
      formal[key] = [explicit, ...list.filter((w) => w !== explicit)];
    } else if (casual.test(list[0])) {
      const word = list.slice(1, 5).find((w) => /(祖父|祖母|父|母|父亲|母亲)$/.test(w) && !/^(公父)$/.test(w));
      if (word) formal[key] = [word, ...list.filter((w) => w !== word)];
    }
    // Northern: the 姥 form of maternal grandparents and their line (外公 → 姥爷, 外婆 → 姥姥)
    if (/外/.test(list[0])) {
      const word = list.find((w) => w.includes('姥'));
      if (word) northern[key] = [word, ...list.filter((w) => w !== word)];
    }
  }
  // Formal for a casual word with an age (大舅, 小姑, 大姨): the formal word of the same relative
  // without the age (舅父, 姑母, 姨母), when its own list has none
  for (const [key, list] of lists) {
    if (formal[key] || !/^(大|小)/.test(list[0])) continue;
    const ageless = key.replace(/\b(ob|lb)\b/g, 'xb').replace(/\b(os|ls)\b/g, 'xs');
    const word = ageless !== key ? formal[ageless]?.[0] : undefined;
    if (word) formal[key] = [word, ...list.filter((w) => w !== word)];
  }
  return { formal, northern };
}

if (isMainThread) {
  const started = Date.now();
  const lists = termLists();
  const { formal, northern } = modes(lists);
  const jobs = [true, false].flatMap((male) => chains(male).map((chain) => ({ male, chain })));
  const workers = Math.max(1, cpus().length - 1);
  console.log(`${lists.size} lists; ${Object.keys(formal).length} formal and ${Object.keys(northern).length} northern reorderings; ${jobs.length} chains on ${workers} workers`);

  const results = await Promise.all(
    Array.from({ length: workers }, (_, i) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(fileURLToPath(import.meta.url), {
          workerData: { jobs: jobs.filter((_, j) => j % workers === i), formal, northern },
        });
        worker.on('message', resolve);
        worker.on('error', reject);
      })
    )
  );

  // { "1:f,ob": "伯父" } for the southern casual term; a version that differs is an array
  // [southern casual, northern casual, formal]
  const table = {};
  for (const part of results) Object.assign(table, part);
  const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(OUTPUT, `${JSON.stringify(sorted)}\n`);
  console.log(`${Object.keys(sorted).length} terms written to ${OUTPUT} in ${Math.round((Date.now() - started) / 1000)} s`);
} else {
  const relationship = require('relationship.js');
  relationship.setMode('formal', workerData.formal);
  relationship.setMode('northern', workerData.northern);
  const part = {};
  for (const { male, chain } of workerData.jobs) {
    const text = chain.map((c) => WORDS[c]).join('的');
    const sex = male ? 1 : 0;
    const term = (mode) => relationship({ text, sex, ...(mode ? { mode } : {}) }).join('/');
    const southern = term();
    if (!southern) continue;
    const north = term('northern') || southern;
    const formalTerm = term('formal') || southern;
    part[`${sex}:${chain.join(',')}`] = north === southern && formalTerm === southern ? southern : [southern, north, formalTerm];
  }
  parentPort.postMessage(part);
}
