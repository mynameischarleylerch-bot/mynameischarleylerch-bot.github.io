import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const F = 'vendor/fru-angler/angler.js';
const O = readFileSync(F, 'utf8');

const MUTATIONS = [
  ['travelling does not record a lake',
    'if (!state.lakesSeen.includes(moved.areaId)) {', 'if (false) {'],
  ['a missing stats key is not a difference',
    "      .some((key) => !(key in savedStats)",
    "      .some((key) => false"],
  ['night catches never counted',
    "  if (timeId === 'dusk' || timeId === 'night') state.stats.nightCatches += 1;", ''],
  ['the dark lake is never counted',
    "  if (state.areaId === 'dark-aero-deep') state.stats.darkLakeCatches += 1;", ''],
  ['the sky is re-rolled instead of the one fished under',
    '  const now = state.sky ?? skyFor(state.areaId);',
    '  const now = skyFor(state.areaId);'],
  ['Shiny/Glowy counted as Crowned',
    "  if (mutation.id === 'crowned') state.stats.crowned += 1;",
    "  if (mutation.name && mutation.id !== 'none') state.stats.crowned += 1;"],
  ['the starting lake is not counted',
    'if (!state.lakesSeen.includes(state.areaId)) {', 'if (false) {'],
  ['a catch does not count', '  state.stats.catches += 1;', '  // never counted'],
  ['the bag peak is never recorded',
    '  state.stats.peakBag = Math.max(state.stats.peakBag, state.bag.length);', ''],
  ['a hand-edited stat is trusted',
    '        if (Number.isFinite(n) && n >= 0) state.stats[key] = Math.floor(n);',
    '        state.stats[key] = n;'],
  ['stats are never saved', '      stats: state.stats,', '      // dropped'],
  ['lakesSeen is never saved', '      lakesSeen: state.lakesSeen,', '      // dropped'],
  ['the lake-deep colour is not tinted',
    "  ui.lake.style.setProperty('--lake-deep', glassy(deep));",
    "  ui.lake.style.setProperty('--lake-deep', deep);"],
  ['the picker does not repaint the lake',
    'paintArea(AREAS.find((a) => a.id === state.areaId) ?? AREAS[0]);', '// no repaint'],
];

const out = 'mutation,caught,failures,first\n';
writeFileSync('_mut.csv', out);
let gaps = [];
for (const [label, from, to] of MUTATIONS) {
  if (!O.includes(from)) {
    appendFileSync('_mut.csv', `${label},SKIP,0,\n`);
    gaps.push(label);
    continue;
  }
  writeFileSync(F, O.replace(from, to, 1));
  let text = '';
  try {
    text = execFileSync('node', ['--test', 'tests/**/*.test.js'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 250_000,
    });
  } catch (err) {
    text = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  } finally {
    writeFileSync(F, O);
  }
  const fails = Number(/fail (\d+)/.exec(text)?.[1] ?? 0);
  const names = [...new Set([...text.matchAll(/^✖ (.+?) \([\d.]+ms\)/gm)].map((m) => m[1]))].sort();
  const caught = fails > 0 ? 'YES' : 'NO-GAP';
  appendFileSync('_mut.csv', `${label},${caught},${fails},${names[0] ?? ''}\n`);
  if (!fails) gaps.push(label);
}
appendFileSync('_mut.csv', `\nGAPS: ${gaps.length ? gaps.join(',') : 'none'}\n`);
appendFileSync('_mut.csv', `restored byte-identical: ${readFileSync(F, 'utf8') === O}\n`);
console.log('done');
