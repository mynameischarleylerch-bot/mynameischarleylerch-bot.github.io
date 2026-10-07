// Mutation sweep for the Angler achievement counters.
//
// Each probe breaks ONE thing in the live source, runs the full suite, and restores
// the file byte-for-byte. A probe that no test notices is a gap: the code is right
// only by accident, and the next edit can remove it silently.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = 'vendor/fru-angler/angler.js';
const ORIGINAL = readFileSync(FILE, 'utf8');

const MUTATIONS = [
  ['travelling does not record a lake',
    'if (!state.lakesSeen.includes(moved.areaId))', 'if (false)'],
  ['a missing stats key is not a difference',
    '.some((key) => !(key in savedStats)', '.some((key) => false'],
  ['night catches never counted',
    "if (timeId === 'dusk' || timeId === 'night') state.stats.nightCatches += 1;", ''],
  ['the dark lake is never counted',
    "if (state.areaId === 'dark-aero-deep') state.stats.darkLakeCatches += 1;", ''],
  ['the sky is re-rolled instead of the one fished under',
    'const now = state.sky ?? skyFor(state.areaId);', 'const now = skyFor(state.areaId);'],
  ['Shiny/Glowy counted as Crowned',
    "if (mutation.id === 'crowned') state.stats.crowned += 1;",
    "if (mutation.name && mutation.id !== 'none') state.stats.crowned += 1;"],
  ['the starting lake is not counted',
    'if (!state.lakesSeen.includes(state.areaId)) {', 'if (false) {'],
  ['a catch does not count', 'state.stats.catches += 1;', '// never counted'],
  ['the bag peak is never recorded',
    'state.stats.peakBag = Math.max(state.stats.peakBag, state.bag.length);', ''],
  ['a hand-edited stat is trusted',
    'if (Number.isFinite(n) && n >= 0) state.stats[key] = Math.floor(n);',
    'state.stats[key] = n;'],
  ['stats are never saved', 'stats: state.stats,', '// dropped'],
  ['lakesSeen is never saved', 'lakesSeen: state.lakesSeen,', '// dropped'],
  ['the lake-deep colour is not tinted',
    "ui.lake.style.setProperty('--lake-deep', glassy(deep));",
    "ui.lake.style.setProperty('--lake-deep', deep);"],
  ['the picker does not repaint the lake',
    'paintArea(AREAS.find((a) => a.id === state.areaId) ?? AREAS[0]);', '// no repaint'],
];

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('mutation', 48)}${pad('caught', 8)}n  first failing test`);
console.log('-'.repeat(116));
const gaps = [];
for (const [label, from, to] of MUTATIONS) {
  if (!ORIGINAL.includes(from)) {
    console.log(`${pad(label, 48)}SKIP`);
    gaps.push(label);
    continue;
  }
  writeFileSync(FILE, ORIGINAL.replace(from, to));
  let out = '';
  try {
    out = execFileSync('node', ['--test', 'tests/**/*.test.js'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  writeFileSync(FILE, ORIGINAL);
  const fails = Number(/fail (\d+)/.exec(out)?.[1] ?? 0);
  const first = [...out.matchAll(/^✖ (.+?) \([\d.]+ms\)/gm)].map((m) => m[1]);
  const names = [...new Set(first)].sort();
  console.log(`${pad(label, 48)}${pad(fails ? 'YES' : 'NO <-- GAP', 8)}${fails}  ${names[0]?.slice(0, 34) ?? ''}`);
  if (!fails) gaps.push(label);
}
console.log(`\nGAPS: ${gaps.length ? gaps.join(', ') : 'none'}`);
console.log(`restored byte-identical: ${readFileSync(FILE, 'utf8') === ORIGINAL}`);
