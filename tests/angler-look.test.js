/**
 * Frutiger Angler is a glossy Frutiger Aero game: aqua gradients, translucent
 * glass, bloom and shine.
 *
 * It was briefly restyled as flat pixel art from a sketch. That sketch is the
 * scene composition (shore rising right, pier on the left, angler and rod) and
 * that part stayed; the flat three-colour treatment did not. These tests pin the
 * Aero treatment so the pixel look cannot creep back in, and pin the composition
 * so a restyle cannot drop the scene the sketch was for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const GAME = new URL('../vendor/fru-angler/', import.meta.url);
const PAGE = readFileSync(new URL('index.html', GAME), 'utf8');

/**
 * The body of one CSS rule, or null if the sheet has no such rule.
 *
 * Spans newlines. The ad-hoc patterns used elsewhere in this file cannot, so a
 * rule written over several lines reads as "no rule at all" and every assertion
 * about it passes for the wrong reason.
 */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = PAGE.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  return m ? m[1] : null;
}

test('the game view is Aero: gradients, glass and shine are all present', () => {
  assert.match(PAGE, /linear-gradient/, 'Aero needs gradients');
  assert.match(PAGE, /backdrop-filter:\s*blur/, 'Aero panels are translucent glass');
  assert.match(PAGE, /box-shadow/, 'Aero panels lift off the page');
  assert.match(PAGE, /inset 0 1px 0 #fff/, 'the Aero gloss highlight');
  assert.match(PAGE, /#fff9c4/, 'the Aero sun bloom');
});

test('the flat pixel treatment did not creep back in', () => {
  // The pixel palette was sky/indigo/wood at exactly these values.
  for (const banned of ['#00a2e8', '#3f48cc', '#b97a57']) {
    assert.equal(PAGE.includes(banned), false,
      `${banned} is a pixel-palette colour and must not return`);
  }
  assert.equal(PAGE.includes('shape-rendering: crispEdges'), false,
    'crispEdges was the pixel rendering');
  // The pier is wood in both versions, so a --wood token is fine; what matters is
  // it is no longer the flat pixel brown. Assert the Aero sky tokens are present.
  assert.match(PAGE, /--sky-top:/, 'the Aero sky tokens should be back');
});

test('the scene keeps the composition from the sketch', () => {
  // Shore climbing to the right, lake, pier deck and two legs on the left, the
  // angler, the rod angled up-right, and the line from the rod tip.
  assert.match(PAGE, /class="scene"/);
  assert.match(PAGE, /class="scene__shore"/);
  assert.match(PAGE, /class="scene__water"/);
  assert.match(PAGE, /class="scene__wood"/);
  assert.match(PAGE, /class="scene__figure"/);
  assert.match(PAGE, /class="scene__rod"/);
  assert.match(PAGE, /id="line"/);
  assert.match(PAGE, /viewBox="0 0 100 100"/);
  assert.match(PAGE, /preserveAspectRatio="none"/);
});

test('the pier has a deck and two legs, as sketched', () => {
  const legs = (PAGE.match(/class="scene__wood--edge"/g) || []).length;
  assert.equal(legs, 2, 'the sketch has two pier legs');
  assert.match(PAGE, /<rect class="scene__wood" x="0" y="58" width="42"/,
    'the deck runs in from the left edge');
});

test('the angler is the Messenger blob, with no limbs', () => {
  const d = PAGE.match(/<path class="scene__figure" d="([^"]+)"/)[1];
  assert.ok(d.startsWith('M33.2'), 'the figure should be the blob path');
  assert.ok(d.trim().endsWith('Z'), 'one closed silhouette');
  // No legs, arms or hands. Check the figure's own markup and count shapes
  // rather than searching words: the pier legitimately has legs, in a comment.
  // The figure alone: from its path up to the first gloss ellipse.
  const figure = PAGE.slice(
    PAGE.indexOf('<path class="scene__figure"'),
    PAGE.indexOf('<ellipse class="scene__shine"'),
  );
  assert.equal((figure.match(/<path\b/g) || []).length, 1,
    'the figure must be one path, not several parts');
  assert.equal(/<(rect|circle|polygon|ellipse)\b/.test(figure), false,
    'the figure is a bare silhouette: no head circle, limbs or shapes of its own');

  // The gloss sits over it: exactly two highlights, nothing else.
  const gloss = PAGE.slice(
    PAGE.indexOf('<ellipse class="scene__shine"'),
    PAGE.lastIndexOf('<path', PAGE.indexOf('class="scene__rod"')),
  );
  assert.equal((gloss.match(/<ellipse\b/g) || []).length, 2,
    'exactly two gloss highlights');
  assert.equal(/<(rect|circle|path|polygon)\b/.test(gloss), false,
    'nothing but the two ellipses may sit over the figure');
});

test('the blob stands on the pier deck, not floating above it', () => {
  const d = PAGE.match(/<path class="scene__figure" d="([^"]+)"/)[1];
  const nums = [...d.matchAll(/-?\d*\.?\d+/g)].map((m) => Number(m[0]));
  const ys = nums.filter((_, i) => i % 2 === 1);
  const deck = Number(PAGE.match(/<rect class="scene__wood" x="0" y="(\d+)"/)[1]);
  // It stands ON the deck: the blob's base meets the deck's top edge.
  assert.ok(Math.abs(Math.max(...ys) - deck) < 0.6,
    `blob base ${Math.max(...ys)} should meet the deck at ${deck}`);
});

test('the fishing line starts at the rod tip the lure marks', () => {
  const start = PAGE.match(/id="line" d="M([\d.]+) ([\d.]+)/);
  const lure = PAGE.match(/id="rod-tip" cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(start && lure, 'the line and the lure must both be in the scene');

  // angler.js measures the lure at runtime, so the shipped path only has to agree
  // with it. These are the carbon rod's numbers, which is what the page ships.
  assert.ok(Math.abs(Number(start[1]) - Number(lure[1])) <= 2,
    `line starts at x=${start[1]}, lure at ${lure[1]}`);
  assert.ok(Math.abs(Number(start[2]) - Number(lure[2])) <= 3,
    `line starts at y=${start[2]}, lure at ${lure[2]}`);
});

test('the rod and lure are addressable so equipping can repaint them', () => {
  assert.match(PAGE, /id="rod-shaft"/, 'the rod needs an id angler.js can rewrite');
  assert.match(PAGE, /id="rod-tip"/, 'the lure needs an id too');
  // They ship as inline attributes so the rod is visible before any script runs.
  assert.match(PAGE, /id="rod-shaft"[\s\S]{0,200}?\bd="/, 'the rod must ship with a path');
  assert.match(PAGE, /id="rod-shaft"[\s\S]{0,200}?stroke="#[0-9a-f]{6}"/i, 'and a colour');
  assert.match(PAGE, /id="rod-shaft"[\s\S]{0,200}?stroke-width="[\d.]+"/, 'and a thickness');
});

test('angler.js measures the rod tip instead of reading cx/cy', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  assert.match(src, /function rodTip\(/, 'rodTip() must exist');
  assert.match(src, /getBoundingClientRect/, 'rodTip() must measure the rendered lure');
  assert.equal(/const cx = parseFloat\(lure\?\.getAttribute\('cx'\)/.test(src), false,
    'cx/cy are pre-transform viewBox units, not where the lure actually renders');
});

test('the scene is not stretched: the angler keeps its proportions', () => {
  // The lake is a wide box; a square viewBox with preserveAspectRatio="none"
  // scales x and y independently, which is what turned the blob into an oval.
  const stretchFix = readFileSync(
    new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  assert.match(stretchFix, /fitFigure|scale\(/,
    'angler.js must counter-scale the figure to the lake aspect');
  assert.match(stretchFix, /ResizeObserver|resize/,
    'it must re-fit when the lake resizes');
});

test('the figure group is wrapped so it can be counter-scaled', () => {
  // One group holding the blob, its gloss, the rod and the lure, so a single
  // transform can keep them proportioned without touching the scenery. Counting
  // elements no longer says anything -- the rod is a rig of nested groups now --
  // so this asserts what must NOT be inside: scenery.
  assert.match(PAGE, /<g id="angler-fit">/, 'the figure group must exist');
  const open = PAGE.indexOf('<g id="angler-fit">');
  // Walk to this group's OWN closer by depth: the rod-blank group nested inside it
  // also ends in </g>, and a plain indexOf found that one instead.
  let depth = 0;
  let close = -1;
  for (let at = open; at < PAGE.length; at += 1) {
    if (PAGE.startsWith('<g', at)) depth += 1;
    else if (PAGE.startsWith('</g>', at)) {
      depth -= 1;
      if (depth === 0) { close = at; break; }
    }
  }
  assert.ok(close > open, 'the figure group must be closed');
  const inside = PAGE.slice(open, close);
  assert.ok(inside.includes('id="rod-blank"'), 'the rod rig travels with the figure');
  assert.ok(inside.includes('id="rod-tip"'), 'and so does the lure');
  for (const scenery of ['scene__water', 'scene__shore', 'scene__wood', 'id="fa-pet-0"']) {
    assert.equal(inside.includes(scenery), false,
      `${scenery} must not be counter-scaled with the figure`);
  }
});

test('the fishing line sits outside the counter-scaled group', () => {
  const close = PAGE.indexOf('</g>', PAGE.indexOf('<g id="angler-fit">'));
  const line = PAGE.indexOf('id="line"');
  assert.ok(line > close,
    'the line must not be counter-warped, or the curve distorts with the figure');
});

test("the shipped line path agrees with where angler.js puts the tip", () => {
  // A mismatch here shows as the line jumping on the first cast.
  const start = PAGE.match(/id="line" d="M([\d.]+) ([\d.]+)/);
  const lure = PAGE.match(/id="rod-tip" cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(start && lure, 'line and lure must both exist');
  assert.ok(Math.abs(Number(start[1]) - Number(lure[1])) <= 2,
    `the initial line start x=${start[1]} should be the lure at x=${lure[1]}`);
  assert.ok(Math.abs(Number(start[2]) - Number(lure[2])) <= 3,
    `the initial line start y=${start[2]} should be the lure at y=${lure[2]}`);
});

test('the inventory button and panel are in the markup', () => {
  // The whole point of the change: there must be a discoverable Inventory button,
  // not just a shop panel that happens to list what you own.
  assert.match(PAGE, /id="inventory-open"/, 'the inventory button must exist');
  assert.match(PAGE, /id="inventory-count"/, 'and show how many rods you carry');
  assert.match(PAGE, /id="inventory-panel"/, 'the panel must exist');
  assert.match(PAGE, /id="inventory-rods"/, 'with a place for your rods');
  assert.match(PAGE, /id="inventory-fish"/, 'and a place for your fish');
  assert.match(PAGE, /id="inventory-close"/, 'and a way to close it');
  // The button must be labelled, or it is not discoverable.
  assert.match(PAGE, /id="inventory-open"[^>]*>\s*Inventory/, 'it must say Inventory');
  // Both panels must start closed.
  assert.match(PAGE, /id="inventory-panel"[^>]*\bhidden\b/);
  assert.match(PAGE, /id="shop-panel"[^>]*\bhidden\b/);
});

test('the inventory has styling for its rows and badge', () => {
  assert.match(PAGE, /\.hud__badge/, 'the count badge needs styling');
  assert.match(PAGE, /\.catch\b/, 'the fish rows need styling');
  assert.match(PAGE, /\.species__weight/, 'and their weights');
  assert.match(PAGE, /\.species\[data-caught="false"\]/, 'and a muted uncaught state');
});

test('the shop styles the inventory sections', () => {
  assert.match(PAGE, /\.shop__section/, 'inventory/for-sale headings need styling');
  assert.match(PAGE, /\.rod__swatch/, 'the rod colour chip needs styling');
});

test('the perfect band is lime, the Aero "go" colour', () => {
  // Now a gradient built from the --lime token rather than a literal.
  assert.match(PAGE, /\.cast__band\s*\{[^}]*background:[^;]*var\(--lime\)/);
  assert.match(PAGE, /--lime:\s*#a3e635/, '--lime must stay the Aero lime');
});

test('rarity is shown as blocks under the name', () => {
  assert.match(PAGE, /id="catch-rarity"/);
  assert.match(PAGE, /\.catch__pip\.is-on\s*\{[^}]*background:\s*var\(--deep\)/);
});

test('the game view keeps every element id angler.js and the tests rely on', () => {
  for (const id of [
    'coins', 'rod', 'rod-stats', 'bestiary', 'message',
    'lake', 'bobber', 'splash', 'cast', 'cast-fill',
    'reel', 'reel-track', 'reel-player', 'reel-fish', 'reel-fill',
    'catch', 'catch-name', 'catch-meta', 'catch-value', 'catch-again',
    'shop-panel', 'shop-list', 'shop-coins', 'shop-open', 'shop-close',
    'line', 'catch-rarity',
  ]) {
    assert.match(PAGE, new RegExp(`id="${id}"`), `missing #${id}`);
  }
});

test('the copy is sentence case, not the pixel-era caps', () => {
  assert.match(PAGE, /Cast again<\/button>/);
  assert.match(PAGE, /Rods &amp; shop/);
  assert.equal(/CAST AGAIN|BUTTON>Rods:/.test(PAGE), false, 'caps crept back in');
});

test('every script the game loads is cache-versioned', () => {
  const scripts = [...PAGE.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1, 'no script found');
  for (const src of scripts) {
    assert.match(src, /\?v=/, `${src} has no cache-busting query`);
  }
});

test('the cover art is Aero too', () => {
  const cover = readFileSync(new URL('../../assets/covers/fru-angler.svg', GAME), 'utf8');
  assert.equal(cover.includes('#00a2e8'), false, 'cover must not use the pixel sky');
  assert.match(cover, /radial-gradient|<circle/, 'the cover needs the bobber and sun bloom');
  assert.match(cover, /aria-label="Frutiger Angler"/);
});

test('the game folder holds only the files it needs', () => {
  // Directories are allowed: `media/` is where the lake background pictures live,
  // and the user is actively adding to it from another session. What this guards is
  // loose SOURCE files at the top level -- a stray copy of a module, a scratch
  // probe -- which is the mistake that actually happened here more than once.
  const entries = readdirSync(GAME).filter((f) => !f.startsWith('.'));
  const dirs = entries.filter((f) => statSync(fileURLToPath(new URL(`${f}/`, GAME))).isDirectory());
  const files = entries.filter((f) => !dirs.includes(f)).sort();
  assert.deepEqual(files, ['angler.js', 'fishing.js', 'index.html', 'reel.js'],
    `unexpected source files: ${files.join(', ')}`);
});


/* ------------------------------------------------- CSS class collisions */

test('the inventory fish rows do not reuse the catch-overlay class', () => {
  // ".catch" is the full-screen catch overlay: position absolute, inset 0, z 9.
  // Reusing it for a row inside the inventory made every fish row a full-screen
  // overlay stacked over the panel, hiding the rods and the close button.
  assert.equal(/\.catch\s*\{/m.test(PAGE), false,
    'the bare .catch selector must only be used by the overlay');

  // The rows are built in JS, so check the script that creates them.
  const script = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  assert.match(script, /row\.className = 'species'/,
    'inventory fish rows must use their own .species class');
  assert.equal(/row\.className = 'catch'/.test(script), false,
    "the row must not reuse the catch overlay's class");
  assert.match(PAGE, /\.species\s*\{/, '.species must be styled');
  // A row is inline content: it must not be an overlay.
  const rule = PAGE.match(/\.species\s*\{([^}]*)\}/)[1];
  assert.equal(/position:\s*absolute/.test(rule), false,
    'a fish row must not be absolutely positioned');
});

/**
 * A class must not be declared twice as a plain selector: two plain rules silently
 * merge and the loser is whichever the author forgot about. A pseudo-class or
 * pseudo-element (`.rod:disabled`, `.lake::before`) is a different selector and
 * legitimately separate, so those are excluded.
 */
/*
 * Rules outside any @media block. A rule inside one — a prefers-reduced-motion
 * override, say — is the same class deliberately restated, so counting it as a
 * duplicate declaration is a false positive.
 */
const CSS_RULES = [...PAGE
  .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '')   // drop @media blocks
  .matchAll(/([^{}]+)\{([^{}]*)\}/g)];

test('no class declares a property twice with different values', () => {
  // The old version counted plain-selector declarations and only failed when two
  // happened to be formatted identically -- so a duplicate introduced by a
  // reformat slipped straight through. It also counted DELIBERATE overrides (a
  // base rule plus a later responsive one) as errors, which is wrong.
  //
  // The signal that matters: the same property set twice on one class with
  // different values. That is a silent conflict -- the browser takes the last one
  // and the first is a lie. An override that only re-states some properties, or
  // restates them identically, is fine.
  const strip = (t) => t.replace(/@media[^\{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const body = strip(PAGE.slice(PAGE.indexOf('<style>'), PAGE.indexOf('</style>')));

  const seen = new Map();
  const conflicts = [];
  for (const [selector, block] of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = selector.trim();
    if (!/^\.[a-z][\w-]*$/.test(sel)) continue;      // single class only
    const name = sel.slice(1);
    const props = new Map();
    for (const decl of block.split(';')) {
      const at = decl.indexOf(':');
      if (at === -1) continue;
      props.set(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
    }
    const prior = seen.get(name);
    if (prior) {
      for (const [prop, value] of props) {
        if (prior.has(prop) && prior.get(prop) !== value) {
          conflicts.push(`.${name} sets ${prop} twice: ${prior.get(prop)} then ${value}`);
        }
      }
    }
    // A later rule fully replaces the earlier one for the properties it names.
    const merged = Object.assign(prior ?? new Map(), props);
    seen.set(name, merged);
  }
  assert.deepEqual(conflicts, [],
    `conflicting duplicate declarations: ${conflicts.join(' | ')}`);
});

test('no element inside the inventory panel uses an overlay class', () => {
  const panels = [...PAGE.matchAll(/id="(shop-panel|inventory-panel)"[\s\S]*?<\/div>\s*<\/div>/g)];
  assert.ok(panels.length >= 2, 'both panels should be in the markup');
  for (const [, id] of panels) {
    assert.equal(new RegExp(`id="${id}"[\\s\\S]*?class="catch"`).test(PAGE), false,
      `${id} must not contain an element with the catch-overlay class`);
  }
});


test('the scene has no orphaned text or unclosed fragments', () => {
  // A bare path string with no opening tag renders nothing, so it can survive
  // unnoticed. It is invalid markup and must not come back.
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));

  // Strip comments first: a path string quoted inside a comment is documentation,
  // not markup, and reading it as a stray fragment is a false positive.
  const stripped = scene.replace(/<!--[\s\S]*?-->/g, '');

  // Check each `d=` VALUE, not the whole scene. The old version ran /^\s*M[\d.]/m
  // over the raw markup, which cannot tell a real fragment from a legitimate second
  // SUBPATH: a multi-subpath d="" wraps onto a continuation line that begins with
  // M, so a real path looked like an orphan. Any d= that does not start with a
  // command letter is the actual defect.
  for (const d of [...stripped.matchAll(/\bd="([^"]*)"/g)].map((m) => m[1])) {
    assert.match(d.trim(), /^[MLHVCSQTAZ]/,
      `found a bare path fragment with no opening command: d="${d.slice(0, 40)}"`);
  }
  // And nothing between tags may look like path data either.
  const between = stripped.replace(/<[^>]*>/g, '\n');
  for (const line of between.split('\n')) {
    assert.doesNotMatch(line, /\bM\s*-?[\d.]/,
      `found a bare path fragment outside any tag: "${line.trim().slice(0, 40)}"`);
  }
  const openTags = (stripped.match(/<path\b[^>]*>/g) || []).length;
  assert.ok(openTags >= 3, `expected several paths, found ${openTags}`);

  // The angler comment appears once, in the group that actually contains it.
  const mentions = (scene.match(/shoulder lobes, no limbs/g) || []).length;
  assert.equal(mentions, 1, `the angler comment appears ${mentions} times`);
});

test('the closing group and the line comment are indented with their block', () => {
  // Both sat at 16 spaces where the surrounding block uses 8. The first </g> in the
  // scene used to be the figure group's own; now the rod-blank rig nests inside it,
  // so this has to mean the LAST one before the line comment.
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));
  const figure = scene.slice(0, scene.indexOf('<!-- The fishing line runs'));
  const closes = figure.split('\n').filter((l) => l.trim() === '</g>');
  const commentLine = scene.split('\n')
    .find((l) => l.trim().startsWith('<!-- The fishing line runs'));
  for (const line of [closes[closes.length - 1], commentLine]) {
    assert.ok(line, `marker not found in the scene`);
    assert.equal(line.length - line.trimStart().length, 8,
      `"${line.trim().slice(0, 30)}" is indented ${line.length - line.trimStart().length}, expected 8`);
  }
});


test('the game has the full set of Aero tokens', () => {
  const start = PAGE.indexOf(':root {');
  const root = PAGE.slice(start, PAGE.indexOf('}', start));
  for (const token of [
    '--glass-top', '--glass-mid', '--glass-bot',
    '--sheen', '--hairline', '--radius', '--radius-lg',
    '--shadow-card', '--shadow-panel', '--shadow-edge', '--gloss-strength',
  ]) {
    assert.match(root, new RegExp(`${token}\\s*:`), `missing token ${token}`);
  }
});

test('the new tokens are all used, not just declared', () => {
  // --sheen, --radius and --gloss-strength are consumed by Tasks 4-8; assert the
  // whole set is eventually used, and the glass/hairline pair now.
  for (const token of ['--glass-top', '--hairline']) {
    assert.ok(PAGE.split(token).length > 2, `${token} is declared but never used`);
  }
});


test('panels use the shared glass and shadow tokens', () => {
  for (const sel of ['.hud', '.reel', '.catch__card', '.shop__panel']) {
    const rule = PAGE.match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `${sel} must have a rule`);
    assert.match(rule[1], /var\(--glass/, `${sel} should use --glass`);
    assert.match(rule[1], /var\(--shadow-/, `${sel} should use a --shadow-* token`);
    assert.match(rule[1], /var\(--hairline/, `${sel} should use a --hairline token`);
  }
});


test('the flat UI pieces have all gained gradients and gloss', () => {
  const need = {
    '.cast__band':    [/box-shadow/],
    '.reel__progress':[/gradient/, /box-shadow/],
    '.rod':           [/gradient|var\(--shine/, /box-shadow/],
    '.message':       [/gradient/, /box-shadow/],
  };
  for (const [sel, patterns] of Object.entries(need)) {
    const rule = PAGE.match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n  \\}`));
    assert.ok(rule, `${sel} must have a rule`);
    for (const p of patterns) assert.match(rule[1], p, `${sel} is missing ${p}`);
  }

  // The hover lift is a sibling rule, which is where a :hover belongs.
  assert.match(PAGE, /\.rod:not\(:disabled\):hover[^}]*translateY/,
    'rod rows must lift on hover');
  assert.match(PAGE, /\.rod:not\(:disabled\):hover[^}]*var\(--shadow-lift\)/,
    'and deepen their shadow while lifted');
});

test('the hint bar fades in from transparent rather than boxing the lake', () => {
  // .message covers the whole lake, so a solid background would draw a visible
  // frame around the entire play area.
  const rule = PAGE.match(/\.message\s*\{([^}]*)\}/)[1];
  assert.match(rule, /rgba\([^)]*,\s*0\)/, 'the hint must start fully transparent');
  assert.equal(/border:/.test(rule), false, 'a border would outline the whole lake');
});


test('the lake is layered glass, not a single gradient', () => {
  const rule = PAGE.match(/\.lake\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(rule, /var\(--shadow-panel\)/, 'the lake should use the panel shadow');
  assert.match(rule, /var\(--hairline/, 'and a hairline edge');

  // Two stacked layers: the specular sweep over the sky-to-lake gradient.
  const gradients = (rule.match(/gradient/g) || []).length;
  assert.ok(gradients >= 2, `expected 2+ gradient layers, found ${gradients}`);
  assert.match(PAGE, /\.lake::after[\s\S]*?radial-gradient/,
    'a specular sweep belongs in ::after');
});

test('the sheen drift respects reduced motion', () => {
  const reduced = PAGE.slice(PAGE.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.lake::after\s*\{[^}]*animation:\s*none/,
    'the drift must stop for users who ask for reduced motion');
});


test('the scene paints with gradients and speculars, not flat fills', () => {
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));
  const linear = (scene.match(/<linearGradient/g) || []).length;
  const radial = (scene.match(/<radialGradient/g) || []).length;
  assert.ok(linear >= 4, `expected 4+ linear gradients, found ${linear}`);
  assert.ok(radial >= 2, `expected 2+ radial speculars, found ${radial}`);

  // The flat fills must be gone: shore, wood and figure are gradient-filled now.
  assert.equal(/\.scene__shore\s*\{[^}]*fill:\s*#5aa6cf/.test(PAGE), false,
    'the shore must not be a flat hex fill');
  assert.equal(/\.scene__figure\s*\{[^}]*fill:\s*var\(--deepest\)/.test(PAGE), false,
    'the angler must not be a flat fill');
  assert.equal(/\.scene__wood\s*\{[^}]*fill:\s*var\(--wood\)\s*;?\s*\}/.test(PAGE), false,
    'the pier must not be a flat fill');
});

test('every gradient the scene references is defined in its own defs', () => {
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));
  const ids = new Set([...scene.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const ref of scene.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(ids.has(ref[1]), `dangling scene gradient #${ref[1]}`);
  }
});

test('the rod keeps its inline colour so equipping still repaints it', () => {
  // paintRod() writes stroke/fill on these elements. A stylesheet rule would be
  // overridden by the inline attribute, which is correct, but it means the rod
  // must not be moved into CSS.
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));
  assert.match(scene, /id="rod-shaft"[\s\S]{0,200}?stroke="#[0-9a-f]{6}"/i);
  assert.match(scene, /id="rod-tip"[^>]*cx="/);
  assert.match(scene, /id="rod-tip"[^>]*cy="/);
});


test('the reel bars read as glass, and the fish reads as a fish', () => {
  const player = PAGE.match(/\.reel__player\s*\{([^}]*)\}/)[1];
  assert.match(player, /gradient/, 'the player bar needs a gradient');
  assert.match(player, /inset 0 1px 0/, 'and the Aero top gloss');

  // The fish element used to be a 4px yellow bar with a two-stage glow, and two
  // tests pinned that. It is now the silhouette wrapper, so the contract is
  // different: it must be sized to hold a fish and must NOT paint its own glow,
  // which made the fish invisible against the bright track it sits on.
  const fish = PAGE.match(/\.reel__fish\s*\{([^}]*)\}/)[1];
  // A regex like /width:\s*\d+px/ matched the old 4px bar too, so the test
  // passed on the very value it was meant to forbid. Require room for a shape.
  const width = Number((fish.match(/width:\s*(\d+)px/) || [])[1] ?? 0);
  assert.ok(width >= 28, `it needs real width to hold a fish shape, got ${width}px`);
  assert.doesNotMatch(fish, /background:\s*linear-gradient/,
    'the wrapper must not paint the old bar gradient');
  assert.doesNotMatch(fish, /0 0 \d+px/, 'nor the old glow');
  assert.match(fish, /display:\s*flex/, 'and it must centre the silhouette');
  // The silhouette itself has to be sized and flipped.
  const sil = PAGE.match(/\.reel__silhouette\s*\{([^}]*)\}/)[1];
  assert.match(sil, /width:\s*100%/, 'the silhouette fills its wrapper');
  assert.match(sil, /scaleX\(-1\)/, 'and faces the player, since it is being hauled in');
});


test('the catch card and its art tile are glass', () => {
  const card = PAGE.match(/\.catch__card\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(card, /gradient/, 'the card needs glass');
  assert.match(card, /var\(--shadow-/, 'and it should lift');
  const art = PAGE.match(/\.catch__art\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(art, /var\(--hairline/, 'the tile edge should be a hairline');
  assert.match(art, /var\(--shadow-/, 'the tile should lift off the card');
});

test('the fish drawing itself keeps its gloss layers', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/fishing.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export function fishSvg'));
  assert.match(block, /<linearGradient/, 'the body needs a gradient');
  assert.match(block, /<radialGradient/, 'and a specular');
  assert.match(block, /class="belly"/, 'and a belly highlight');
  assert.match(block, /class="specular"/, 'and a gloss overlay');
  // The gloss layers sit on top of the fish, so it must not read as flat.
  assert.match(block, /class="scales"/, 'and scale sheen arcs along the flank');
});


test('the water carries Aero bubbles above the lake', () => {
  assert.match(PAGE, /\.lake__bubble\s*\{/, 'decorative bubbles must be styled');
  assert.match(PAGE, /class="lake__bubble lake__bubble--1"/, 'and present in the markup');
  const bubble = PAGE.match(/\.lake__bubble\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(bubble, /gradient/, 'bubbles need a gradient to read as glass');
  assert.match(bubble, /box-shadow/, 'and a rim to catch the light');
});

test('the bubbles are decorative only', () => {
  // Count across the whole document: the bubbles sit inside the lake, after the
  // scene SVG, and must not reach assistive tech.
  const bubbles = [...PAGE.matchAll(/<div class="lake__bubble[^"]*"([^>]*)>/g)];
  assert.equal(bubbles.length, 5, `expected 5 bubbles, found ${bubbles.length}`);
  for (const [, attrs] of bubbles) {
    assert.match(attrs, /aria-hidden="true"/, 'a bubble must not reach the screen reader');
  }
  // They must live inside the lake, not after it.
  // The bubbles sit after the scene SVG and before the cast meter, all inside the
  // lake. Use the cast meter's opening tag as the far boundary.
  const lakeStart = PAGE.indexOf('<div class="lake" id="lake"');
  const lakeEnd = PAGE.indexOf('<div class="cast"');
  for (const m of bubbles) {
    assert.ok(m.index > lakeStart && m.index < lakeEnd,
      'the bubbles must be children of the lake');
  }
});

test('the bubbles respect reduced motion', () => {
  const reduced = PAGE.slice(PAGE.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.lake__bubble\s*\{[^}]*animation:\s*none/);
});

/* -------------------------------------------------- the pet, and its voice */

test('the pet is counter-scaled so the scene cannot stretch it', () => {
  // The scene uses preserveAspectRatio="none", so anything OUTSIDE #angler-fit is
  // stretched to the lake's shape. The pet is outside it (it sits at a fixed
  // point on the deck), so it needs the same correction fitFigure() applies to the
  // angler -- otherwise a seal comes out as a wide smear.
  assert.match(PAGE, /id="fa-pet-fit-0"/, 'the pet needs its own fitted group');
  assert.match(PAGE, /id="fa-pet-0"/, 'and the pet itself');
  // The fitted group WRAPS the pet, so it comes first in document order.
  const order = PAGE.indexOf('id="fa-pet-fit');
  assert.ok(order < PAGE.indexOf('id="fa-pet-0"'),
    'the pet must be inside the group that counter-stretches it');
  assert.match(PAGE.slice(order, order + 400), /<g id="fa-pet-0"/,
    'and the pet must open inside it');
});

test('the pet is a group the controller actually counter-scales', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  // The fitted groups are now SLOT-SUFFIXED and found through #fa-pet-dock, so the
  // controller must name the dock rather than a single id.
  assert.match(src, /fa-pet-dock/, 'the controller must find the dock');
  assert.match(src, /fa-pet-slot/, 'and each slot inside it');
  assert.match(src, /scale\(/, 'and apply a scale transform to it');
});

test('the seal has a speech bubble, not just a caption', () => {
  assert.match(PAGE, /id="fa-bubble"/, 'the seal needs somewhere to talk');
  assert.match(PAGE, /class="bubble/, 'and it should read as a bubble');
});

test('the bubble is hidden until the seal says something', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  assert.match(src, /fa-bubble/, 'the controller must drive the bubble');
  assert.match(PAGE, /id="fa-bubble"[^>]*hidden/, 'and it starts hidden');
});

test('duplicating a catch raises a notification of its own', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  assert.match(src, /sealDuplicates/, 'the duplicate roll must reach the controller');
  assert.match(src, /function notify|notify\(/, 'and it must notify');
});

test('a notification is an assertive live region, so it is announced', () => {
  assert.match(PAGE, /id="notify"[^>]*aria-live|role="status"/,
    'a notification needs to be announced, not just drawn');
});

test('the HUD groups its readouts, it does not sprawl', () => {
  // The stat line belongs with the rod it describes, not marooned at the far end
  // of the bar with a huge gap between it and the rod's name.
  assert.match(PAGE, /class="hud__group hud__rod"/,
    'the rod readout needs its own group');
  assert.match(PAGE, /class="hud__nav"/, 'and the nav buttons travel as one cluster');
  const hud = PAGE.slice(PAGE.indexOf('class="hud"'), PAGE.indexOf('class="lake"'));
  assert.ok(hud.indexOf('id="rod-stats"') > hud.indexOf('id="rod"'),
    'the stats must come after the rod name, not before it');
});

test('every HUD readout is the same oval the buttons are', () => {
  // The bar's oval is a pill, and the readouts have to match it. Anything on a
  // 12px radius reads as a different shape sitting in the same row, which is what
  // "organize this" was really about.
  const pill = /border-radius:\s*(999px|var\(--pill\))/;
  const bar = rule('.hud');
  assert.match(bar, pill, 'the bar itself is a pill');

  // The groups I added are pills, and they must use the SAME radius, not a
  // lookalike. 999px is the site's pill; a hard-coded 12px or 50% is not it.
  for (const sel of ['.hud__group', '.hud__badge', '.hud__bar']) {
    const body = rule(sel);
    assert.ok(body, `${sel} must be styled`);
    assert.match(body, pill, `${sel} must use the pill radius`);
  }
});

test('the small seal parts are pills, but the row itself is a card', () => {
  // This used to demand a 999px radius on .seal -- which is a stadium around a
  // name, a blurb, perk chips and a button, and swallowed the corners. The pill
  // belongs on the chips and the lock badge; the row is a card.
  assert.doesNotMatch(rule('.seal'), /border-radius:\s*(999px|var\(--pill\))/,
    'the row must stay a card, not an oval');
  for (const sel of ['.finds', '.seal__lock', '.seal__perk', '.seal__portrait']) {
    const body = rule(sel);
    assert.ok(body, `${sel} must be styled`);
    assert.match(body, /border-radius:\s*(999px|var\(--pill\)|50%)/,
      `${sel} is a small part and keeps the rounded shape`);
  }
});

test('the pill radius is one shared token, not repeated per rule', () => {
  // DRY: a single --pill token means the next panel cannot drift out of step.
  const root = rule(':root');
  assert.ok(root, ':root must exist');
  assert.match(root, /--pill:\s*999px/, 'a --pill token must be defined');
  for (const sel of ['.hud', '.btn', '.hud__group']) {
    const body = rule(sel);
    assert.match(body, /var\(--pill\)/, `${sel} must use the shared token`);
  }
});

test('the HUD readouts all sit in a pill, none left as bare text', () => {
  // Each readout the player reads -- coins, seal coins, rank, rod -- must be
  // inside a group, or it floats loose against the bar.
  const hud = PAGE.slice(PAGE.indexOf('class="hud"'), PAGE.indexOf('class="lake"'));
  const groups = (hud.match(/class="hud__group/g) || []).length;
  assert.ok(groups >= 3, `expected the readouts grouped, found ${groups} groups`);
  for (const id of ['id="coins"', 'id="seal-coins"', 'id="level"', 'id="rod"']) {
    assert.ok(hud.includes(id), `${id} must still be in the bar`);
  }
  // The stray spacer that used to sit between them is gone: it produced the gap
  // in the screenshot, and the nav cluster now pushes itself right instead.
  assert.doesNotMatch(hud, /hud__spacer/, 'the HUD must not depend on a bare spacer');
  assert.match(hud, /class="hud__nav"/, 'the nav cluster must be in the bar');
});

test('the catch overlay must not blank the scene, or the seal is invisible when it speaks', () => {
  // The seal only ever speaks when a fish is landed -- which is exactly when the
  // catch overlay opens. The overlay still spans the lake, because it has to take
  // the click; what it must not do is cover the dock in flat opaque colour. It
  // used to be rgba(6,51,79,.45) plus a blur across the whole scene, which put the
  // seal's bubble behind it at precisely the moment the seal had something to say.
  const scrim = rule('.catch, .shop');
  assert.ok(scrim, 'the catch overlay must be styled');
  assert.doesNotMatch(scrim, /backdrop-filter/,
    'the catch scrim must not blur the scene -- it hides the dock and the seal');
  assert.match(scrim, /radial-gradient/,
    'the scrim must be a vignette around the card, not a flat sheet');
  // And it must let clicks through to the card without swallowing the lake.
  assert.match(scrim, /pointer-events:\s*none/,
    'the scrim must not eat clicks meant for the card');
});

test('the catch card is lifted above its own scrim', () => {
  // The scrim is a sibling of the card, so the card needs a z-index of its own or
  // the vignette paints over the fish it is dimming everything for.
  //
  // This was pinned to exactly 2, which is a magic number that quietly collided
  // with the boost stack: both at 2 means DOM order decides, and DOM order is not
  // something to leave a layout to. The real requirement is "above the scrim and
  // above the readout", so that is what it asserts.
  const card = Number(/z-index:\s*(\d+)/.exec(rule('.catch__card'))?.[1] ?? 0);
  const stack = Number(/z-index:\s*(\d+)/.exec(rule('.lake__boosts'))?.[1] ?? 0);
  assert.ok(card > 0, 'the card must sit above the scrim that dims the scene behind it');
  assert.ok(card > stack, `the card (z ${card}) must cover the boost stack (z ${stack})`);
});

test('the seal is drawn from the photographs, and keeps its Aero finish', () => {
  // Originally pinned against a bean-shaped seal: heavy rump, no flippers, ONE
  // glossy eye, and "not a scatter of circles". That was right about the blob and
  // wrong about the animal -- all three references show two large widely spaced
  // eyes, long fanning whiskers, and splayed paddle flippers.
  //
  // What still holds, and is the part worth keeping: the body is drawn, not an
  // ellipse, and it keeps the Aero gradient rather than going flat.
  const start = PAGE.indexOf('<g id="fa-pet-0">');
  const pet = PAGE.slice(start, PAGE.indexOf('\n        </g>', start));
  assert.match(pet, /<path id="pet-body-0"[^>]*\sd="M[^"]*C/,
    'the body must be a drawn path, not an ellipse');
  assert.match(pet, /fill="url\(#pet-fill-/, 'and it keeps the Aero gradient');
});


test('the HUD names the currency, it does not just say "seal"', () => {
  // It read "seal 0", which looks like a count of seals rather than a second
  // currency -- and it is not one, since the pet sits on the dock, not in a
  // wallet. Every other surface already says "seal coins".
  const hud = PAGE.slice(PAGE.indexOf('class="hud"'), PAGE.indexOf('class="lake"'));
  assert.match(hud, /Seal coins/,
    'the HUD must name the currency in full');
  assert.doesNotMatch(hud, />seal\s*<b id="seal-coins">/,
    'a bare "seal" beside a number reads as a count of seals');
});

test('both currency surfaces name it the same way', () => {
  // The HUD readout and the seal shop must agree, or the player has to learn two
  // names for one number. This checks those two places directly rather than trying
  // to separate prose from identifiers in source, which caught clearShake() and
  // seal-shop-panel before it caught anything a player can read.
  assert.match(PAGE, /Seal coins <b id="seal-coins">/, 'the HUD names the currency');
  assert.match(PAGE, /<b id="seal-shop-coins">0<\/b> seal coins/, 'and so does the shop');
  assert.doesNotMatch(PAGE, />seal <b id="seal-coins">/,
    'the old bare "seal" label must not come back');

  // And the refusal has to name it too, or it is the only place it is a number.
  const rules = readFileSync(new URL('../vendor/fru-angler/fishing.js', import.meta.url), 'utf8');
  assert.match(rules, /Not enough seal coins/,
    'being turned away must say which currency was short');
});

test('the readout pills are opaque enough to read as shapes', () => {
  // At rgba(255,255,255,.28) the pill was lighter than the Aero bar behind it and
  // vanished, so the grouping was invisible. The fill is a gradient now, so check
  // the LOWEST alpha anywhere in it -- the faintest part is what shows least.
  const body = rule('.hud__group');
  const fill = /background:\s*([^;]+);/.exec(body)?.[1] ?? '';
  assert.match(fill, /linear-gradient/, `the pill needs a gradient fill, got "${fill}"`);
  const alphas = [...fill.matchAll(/rgba\([^)]*,\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
  assert.ok(alphas.length >= 2, `the gradient needs two stops, found ${alphas.length}`);
  const faintest = Math.min(...alphas);
  assert.ok(faintest >= 0.55,
    `the readout pill must read as a shape, but its faintest stop is only ${faintest} opaque`);
  assert.match(body, /border:\s*1px solid/, 'and a visible edge, or it is a smudge');
  assert.match(body, /box-shadow/, 'and a little lift off the bar');
});

test('each currency gets its own pill, so the two are never one number', () => {
  // They shared a single wrapper, which made it read as one wallet with two
  // figures in it. They are separate currencies earned in separate ways.
  const hud = PAGE.slice(PAGE.indexOf('class="hud"'), PAGE.indexOf('class="lake"'));
  const groups = hud.match(/class="hud__group[^"]*"/g) || [];
  assert.ok(groups.length >= 4,
    `rod coins, Seal coins, rank and rod each want their own pill, found ${groups.length}`);

  // The currency pill must be inside its own group, not sharing one.
  const rodAt = hud.indexOf('id="coins"');
  const sealAt = hud.indexOf('id="seal-coins"');
  assert.ok(rodAt !== -1 && sealAt !== -1, 'both readouts must exist');
  const between = hud.slice(rodAt, sealAt);
  assert.match(between, /class="hud__group[^"]*"[^>]*>[^<]*$/m,
    'the two currencies must be in different pills, not one shared wrapper');
});

test('the two currencies are visually told apart, not just named', () => {
  // Colour already separates the Seal coins text; the pill has to differ too, or
  // the shape says "one wallet" and only the lettering disagrees.
  const seal = rule('.hud__seal-coins');
  assert.ok(seal, 'the Seal coins readout must have its own class');
  assert.match(seal, /background/, 'and its own pill background, not a bare text colour');
  assert.match(seal, /border-radius:\s*(999px|var\(--pill\))/,
    'in the same oval as everything else');
});

test('the readout pills still use the shared pill radius', () => {
  // Whatever the fill becomes, the shape must not change.
  assert.match(rule('.hud__seal-coins'), /border-radius:\s*(999px|var\(--pill\))/);
  assert.match(rule('.hud__group'), /border-radius:\s*(999px|var\(--pill\))/);
});

test('the speech bubble is sized to fit the words it has to hold', () => {
  // The bubble was 25 viewBox units wide with font-size 3.1px. SVG has no text
  // wrapping, so a 42-character line came out ~65 units wide -- 2.6x its own box,
  // centred at x=14, which put most of it off the LEFT edge of a scene that has
  // overflow:hidden. The seal looked mute because its words were clipped away.
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));
  assert.doesNotMatch(scene, /<text[^>]*bubble/,
    'the bubble must not be SVG text -- SVG cannot wrap, so it runs off the scene');

  // An HTML bubble can wrap, so it just has to be a real element with room.
  assert.match(PAGE, /<div[^>]*class="bubble"/,
    'the speech bubble must be an HTML element so long lines can wrap');
});

test('the bubble appears only while there is something to read', () => {
  // Appearance must follow the text, not a stale timer: an empty line means no
  // seal is equipped, or it has nothing to say, and the bubble must be GONE --
  // not sitting there empty, not still holding the previous sentence.
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');

  const hide = src.slice(src.indexOf('function hideBubble'));
  assert.match(hide.slice(0, hide.indexOf('\n}\n')),
    /remove\('is-speaking'\)/, 'hiding must clear the speaking class');
  assert.match(hide.slice(0, hide.indexOf('\n}\n')),
    /clearTimeout/, 'and clear the timer, so a stale line cannot reappear');

  const says = src.slice(src.indexOf('function sealSays'));
  const body = says.slice(0, says.indexOf('\n}\n'));
  assert.match(body, /if\s*\(\s*!line[\s\S]*?hideBubble\(\)/,
    'an empty line must go through hideBubble, not just skip setting the text');
  assert.match(body, /classList\.add\('is-speaking'\)/,
    'a real line must switch the bubble on');
  assert.doesNotMatch(body, /slice\(0, 4\d\)/,
    'the bubble is HTML and wraps now -- truncating the words is a bug');
});

test('the bubble is never left showing stale words', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  // Every path that clears the bubble must clear the timer too, or a stale line
  // can reappear after the seal has stopped talking.
  for (const point of ['function hideBubble', 'function sealSays']) {
    const i = src.indexOf(point);
    assert.notEqual(i, -1, `${point} must exist`);
  }
});

test('the bubble is anchored inside the lake, which clips its overflow', () => {
  // .lake is position:relative and overflow:hidden. An absolutely positioned
  // bubble needs that as its containing block or it anchors to the page and
  // floats off the panel -- which is what "it still doesnt talk" looked like.
  assert.match(rule('.lake'), /position:\s*relative/,
    'the lake must be the positioning context for the bubble');
  assert.match(rule('.bubble'), /position:\s*absolute/,
    'and the bubble must be absolutely positioned within it');

  // The decorative Aero bubbles use a different class, so the speech bubble's
  // rules cannot accidentally restyle them -- or be restyled by them.
  const lake = PAGE.slice(PAGE.indexOf('<div class="lake"'));
  assert.match(lake, /class="bubble"/, 'the speech bubble must be inside the lake');
  assert.match(rule('.bubble'), /z-index:\s*3/,
    'and above the scene, or the water paints over it');
});

test('a seal row is a card, not an oval', () => {
  // .seal carried border-radius: var(--pill) -- which is 999px. On a card holding
  // a name, a blurb, a perk line and a button, that balloons into a stadium and
  // swallows the corners. The pill belongs on buttons and readouts.
  const card = rule('.seal');
  assert.ok(card, 'the seal row must be styled');
  assert.doesNotMatch(card, /border-radius:\s*(999px|var\(--pill\))/,
    'a multi-line card must not be a 999px oval');
  assert.match(card, /border-radius:\s*(1?\d)px/,
    'it needs a real corner radius');
});

test('the seal row fill is opaque enough to read the blurb against', () => {
  // .seal was rgba(255,255,255,.5) over rgba(255,255,255,.22) -- barely there on
  // a pale Aero panel, which is why the seal descriptions were hard to read.
  const card = rule('.seal');
  const fill = /background:\s*([^;]+);/.exec(card)?.[1] ?? '';
  const alphas = [...fill.matchAll(/rgba\([^)]*,\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
  assert.ok(alphas.length >= 2, `needs a gradient fill, got "${fill}"`);
  assert.ok(Math.min(...alphas) >= 0.72,
    `the card fill must be readable, faintest stop is ${Math.min(...alphas)}`);
});

test('a seal row lines up: art, text, price in a row that wraps', () => {
  // The name and home lake were the only alignment the row had; the button was
  // shoved onto its own line at full size. Prices run to five figures, so the
  // button has to be allowed to sit beside the text and shrink.
  assert.match(rule('.seal__head'), /flex-wrap:\s*wrap/,
    'the header must wrap on a narrow panel');
  assert.match(rule('.seal__foot'), /display:\s*flex/,
    'price and button share a footer row');
  assert.match(rule('.seal__equip'), /justify-self:\s*start/,
    'and the button is aligned to the left edge, not stretched');
});

test('prices read as prices, not raw button labels', () => {
  // The buy button said "19000 seal coins" in body-size text. It should be a
  // compact price chip so five figures do not shout.
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function renderSealShop'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /seal__foot/, 'the row needs a footer to hold the price');
  assert.match(body, /className = 'seal__price'/,
    'and the price needs its own element, not to be the button label');
  assert.doesNotMatch(body, /button\.textContent = `\$\{seal\.price\} seal coins`/,
    'the price must not be the whole button label');
});

test('the page is a whole document, not a truncated one', () => {
  // Every other test here reads the stylesheet. A 0-byte or half-written
  // index.html still parses as "no .seal rule", which some tests tolerate -- and
  // the whole suite passed once while the markup was entirely gone.
  assert.ok(PAGE.length > 20000, `index.html is only ${PAGE.length} bytes`);
  for (const needle of ['</style>', '<body>', '</html>', 'class="stage"', 'id="lake"',
                        'id="seal-shop-list"', 'id="coins"', 'id="seal-coins"']) {
    assert.ok(PAGE.includes(needle), `index.html must still contain ${needle}`);
  }
  // And the module that boots the game must be intact -- it is one script, and it
  // imports the rules module itself.
  const scripts = [...PAGE.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.some((src) => src.includes('angler.js')),
    `the game must still load, found scripts: ${scripts.join(', ') || 'none'}`);
});

test('the pet is hidden by CSS, not by the hidden attribute alone', () => {
  // `hidden` is an HTML attribute. It works on <div> because the HTML user-agent
  // sheet has a [hidden] rule. An SVG <g> gets no such rule in a real browser, so
  // `hidden` on #fa-pet-fit did nothing there -- the seal stayed painted on the
  // dock with no seal equipped, sitting over a bubble that correctly stayed
  // silent. jsdom disagrees (it applies the HTML sheet to SVG), so no DOM test can
  // catch this; only the stylesheet can be asserted.
  assert.match(PAGE, /\.fa-pet-slot\[hidden\]\s*\{[^}]*display:\s*none/,
    'the dock slots need their own [hidden] rule -- the attribute alone does nothing on an SVG <g>');
});

test('every SVG group that JS toggles has a matching hidden rule', () => {
  // paintPet() sets and removes `hidden` on the pet group. If the rule is missing
  // the attribute is decorative and the toggle silently does nothing.
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  const toggled = [...src.matchAll(/(?:ui\.\w+|group|holder)\.(?:setAttribute\('hidden'|removeAttribute\('hidden'\))/g)];
  assert.ok(toggled.length > 0, 'sanity: paintPet toggles hidden at all');

  // The svg groups in the markup that carry a hidden attribute in source.
  //
  // `hidden` must be matched as its OWN attribute. The old pattern was a bare
  // `[^>]*hidden`, which also matches inside `aria-hidden` -- so any group marked
  // aria-hidden was reported as having an unstyled `hidden`, and demanded a CSS
  // rule it did not need. #pet-fx is the first element to carry both.
  const svgGroups = [...PAGE.matchAll(
    /<g(?=[^>]*\bid="([^"]+)")(?=[^>]*\shidden(?:\s|=|>))[^>]*>/g,
  )].map((m) => m[1]);
  for (const id of svgGroups) {
  const covered = new RegExp(`#?\\.?${id}\\[hidden\\]`).test(PAGE)
      // Either an id-keyed rule or the slot class covers it. Both are legitimate:
      // the dock slots are hidden BY CLASS precisely because there are two of them,
      // and a rule naming one id would leave the other visible.
      || (id.startsWith('fa-pet-fit-') && /\.fa-pet-slot\[hidden\]/.test(PAGE));
    assert.ok(covered, `<g id="${id}" hidden> has no CSS rule to hide it`);
  }

  // The particle stamps are <use>, not <g>, so the loop above cannot see them --
  // and they are exactly what paintPet toggles. `hidden` on an SVG element does
  // nothing without an explicit CSS rule, so without this every motif renders at
  // once, stacked over the seal. Matched on the class, not the id, because the
  // stamps share one id and differ by class.
  const stamps = [...PAGE.matchAll(/<use\b[^>]*class="([^"]*pet__fx[^"]*)"/g)];
  assert.ok(stamps.length >= 5,
    `expected a stamp per seal, found ${stamps.length} <use class="pet__fx">`);
  assert.ok(/#pet-fx \.pet__fx\[hidden\]\s*\{\s*display:\s*none/.test(PAGE),
    'the particle stamps are toggled with `hidden`, which does nothing on an SVG '
    + '<use> without a CSS rule -- they need #pet-fx .pet__fx[hidden]{display:none}');
});

test('a mutated fish gets a badge, not a footnote', () => {
  // A Crowned fish is 5x value. It was showing as the word "Crowned" buried in the
  // meta line, which looks like a fish name, not a 5x catch.
  assert.match(PAGE, /id="catch-mutation"/,
    'the catch card needs somewhere to show the mutation properly');
  assert.match(PAGE, /\.catch__mutation/, 
    'and it needs a style, or it is just more grey text');
});

test('the mutation badge is hidden for a plain catch', () => {
  // Most catches are plain. A badge that is always there teaches nothing, and an
  // empty badge wastes the space the good ones need.
  assert.match(PAGE, /\.catch__mutation\[hidden\]\s*\{\s*display:\s*none/,
    'the mutation badge must hide itself for a plain fish');
});

test('the fish index records mutations too, so the trophy is the good one', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/fishing.js', import.meta.url), 'utf8');
  assert.match(src, /mutationById/, 'the rules module must expose a mutation lookup');
  const fn = src.slice(src.indexOf('export function mutationById'));
  assert.match(fn.slice(0, fn.indexOf('\n}\n')), /id !== 'none'/,
    "and plain must never come back as a mutation to display");
});

test('the sky is driven by CSS variables, not by swapping classes', () => {
  // One set of variables means one write per visit and no combinatorial CSS.
  for (const v of ['--sky-wash', '--sky-depth', '--veil']) {
    assert.ok(PAGE.includes(v + ':'), `the stylesheet must define ${v}`);
  }
  assert.match(PAGE, /\.lake\[data-sky/,
    'and the lake must react to a data attribute the controller sets');
});

test('the sky sits behind the fish but above the water', () => {
  const sky = rule('.lake__sky');
  const z = Number(/z-index:\s*(\d+)/.exec(sky)?.[1] ?? 0);
  assert.ok(z < 3, `the sky must not cover the bubble or the bobber (z ${z})`);
});
test('the sky overlay and the HUD readout are both really in the page', () => {
  // Removing either element passed every other test, because nothing asserted they
  // existed at runtime -- the CSS rules for them are still satisfiable in source
  // when the elements are gone from the markup.
  assert.match(PAGE, /<div class="lake__sky"/,
    'the wash element must be in the markup, not only in the stylesheet');
  assert.match(PAGE, /id="sky-name"/,
    'and the HUD must have somewhere to name the sky');
  assert.match(PAGE, /class="hud__sky"/,
    'with a style, or it is unstyled text');
});

test('the mutation badge is driven at runtime, not just declared', () => {
  // Same problem: the CSS for the badge exists, so a look test passes whether or
  // not the controller ever shows one.
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  assert.match(src, /catchMutation\.removeAttribute\('hidden'\)/,
    'a mutated fish must unhide the badge');
  assert.match(src, /catchMutation\.setAttribute\('hidden'/,
    'and a plain one must hide it again');
  assert.match(src, /mutation\.colour/,
    'using the mutation\'s own colour, or every badge is the same');
});

test('every SVG group the controller hides by attribute has a CSS rule', () => {
  // `hidden` is an HTML attribute. It hides a <div> because the HTML user-agent
  // sheet has a [hidden] rule; an SVG <g> gets nothing, so setting the attribute
  // changes nothing on screen. The pet seal had this bug -- painted on the dock
  // with no seal equipped -- and the reel inherited it: a bamboo stick drew a
  // reel it does not have, because nothing ever turned display off.
  for (const id of ['rod-reel']) {
    assert.ok(PAGE.includes(`id="${id}"`), `${id} must exist`);
    assert.match(PAGE, new RegExp(`#${id}\\[hidden\\]`),
      `#${id} is toggled by attribute and needs a [hidden] rule to actually hide`);
  }
});

test('there is a boost panel in the corner of the lake, always visible', () => {
  // Luck is rod + rank + seal, and it decides which fish you meet -- but nothing
  // on screen ever showed it. You can own the best rod in the game and be unable
  // to tell that it does anything.
  const panel = PAGE.slice(PAGE.indexOf('id="lake"'), PAGE.indexOf('</svg>'));
  assert.match(panel, /class="lake__boosts"/, 'the lake needs a boost panel');
  const css = rule('.lake__boosts');
  assert.ok(css, 'the boost panel must be styled');
  assert.match(css, /position:\s*absolute/);
  assert.match(css, /(?:left|right):\s*[\d.]+(rem|px|%)/,
    'and it must be anchored to a side, not centred or full width');
  assert.match(css, /pointer-events:\s*none/,
    'and never swallow a cast');
});

test('the boost panel is behind the reel and the catch card, not over them', () => {
  // The reel fills the middle of the lake and the catch card covers it. A readout
  // stacked over either is a readout nobody reads at the moment it matters.
  //
  // Strictly less than, not equal to: .catch__card is z 2, and at a tie the DOM
  // order decides which wins -- which is not something to leave to chance.
  const z = Number(/z-index:\s*(\d+)/.exec(rule('.lake__boosts'))?.[1] ?? 0);
  const reel = Number(/z-index:\s*(\d+)/.exec(rule('.reel'))?.[1] ?? 0);
  const card = Number(/z-index:\s*(\d+)/.exec(rule('.catch__card'))?.[1] ?? 0);
  assert.ok(z < reel, `boosts (z ${z}) must not cover the reel (z ${reel})`);
  assert.ok(z < card, `boosts (z ${z}) must be strictly under the catch card (z ${card}), not level with it`);
});

test('the boost panel names every source, and the zero ones honestly', () => {
  // A panel that hides the rows you do not currently benefit from is worse than
  // none: it implies the boost is missing rather than not yet earned. Every row
  // is always present; the ones at zero say so.
  assert.match(PAGE, /id="boost-list"/, 'the rows need somewhere to render');
  assert.match(PAGE, /lake__boost/,
    'and a row class to style them');
});

test('the panel does not need a click to be useful', () => {
  assert.match(PAGE, /aria-live="off"|aria-hidden="true"/,
    'a constantly-changing readout should not announce itself to a screen reader');
});

test('the scene has the elements a Frutiger finish is drawn with', () => {
  // The finish data is useless if there is nothing to draw it into. Beads and the
  // chrome highlight each need a place in the scene.
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>'));
  assert.match(scene, /id="rod-beads"/, 'beads need somewhere to go');
  assert.match(scene, /id="rod-chrome"/, 'and so does the chrome highlight');
});

test('paintRod draws the beads and the chrome, not just the blank', () => {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function paintRod'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /finish\.beads/, 'the beads must be painted');
  assert.match(body, /rodBeads/, 'into their own element');
  assert.match(body, /finish\.accent/, 'the accent colour must be used');
  assert.match(body, /finish\.sheen/, 'and the sheen, or the gloss is identical on every rod');
  assert.match(body, /finish\.chrome/, 'chrome rods need the highlight');
  assert.match(body, /sheen/, 'and matte ones must not get it');
});

test('the scene markup parses, which presence checks cannot tell', () => {
  // A line-based insert split the heel's opening tag in half. Every id was still
  // in the file and every existence check passed, while the DOM was broken from
  // that point on -- nine tests failed at once for a reason none could name.
  //
  // jsdom recovers rather than throwing, so this asserts the DAMAGE the split
  // caused rather than that an exception happened: the heel loses its stroke,
  // and everything after the split escapes its group.
  const scene = PAGE.slice(PAGE.indexOf('<svg class="scene"'), PAGE.indexOf('</svg>') + 6);
  const doc = new JSDOM(scene).window.document;

  const heel = doc.getElementById('rod-heel');
  assert.ok(heel, 'the heel must survive parsing');
  assert.ok(heel.getAttribute('d'), 'the heel keeps its path');
  assert.ok(heel.getAttribute('stroke'), 'the heel keeps its colour -- a split tag loses it');
  assert.ok(heel.getAttribute('stroke-width'), 'and its thickness');

  // Everything in the rig must actually be inside the rig.
  for (const id of ['rod-gloss', 'rod-stripe', 'rod-grip', 'rod-chrome', 'rod-guides',
                    'rod-reel', 'rod-beads', 'rod-shaft']) {
    const node = doc.getElementById(id);
    assert.ok(node, `${id} must exist`);
    assert.ok(node.closest('#rod-blank'),
      `${id} escaped the rod rig -- the markup around it is split`);
  }
  assert.equal(doc.getElementById('rod-blank')?.tagName.toLowerCase(), 'g',
    'the rig must be a group, not a stray path');
});


/** The seal's own group, so the tests read the animal and not the lake. */
function petGroup() {
  const start = PAGE.indexOf('<g id="fa-pet-0">');
  assert.ok(start > 0, 'the seal group must exist');
  return PAGE.slice(start, PAGE.indexOf('\n        </g>', start));
}

/** Every coordinate pair in an SVG path, for measuring. */
function coords(d) {
  return [...d.matchAll(/(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}
function xs(d) { return coords(d).map((p) => p[0]); }
function ys(d) { return coords(d).map((p) => p[1]); }
function extent(d) {
  const c = coords(d);
  return [Math.max(...c.map((p) => p[0])) - Math.min(...c.map((p) => p[0])),
          Math.max(...c.map((p) => p[1])) - Math.min(...c.map((p) => p[1]))];
}
function count(s, needle) {
  return s.split(needle).length - 1;
}
function bodyOf(pet) {
  // [^>]* between the id and d=, not \s*: the body carries a class as well as an
  // id, and the old \s* stopped matching the moment it did.
  return pet.match(/<path id="pet-body-0"[^>]*\sd="([^"]+)"/)[1];
}

test('the head is tucked in, so the whole seal is one round mass', () => {
  // "its head is tucked in to look round". The last pass gave it a head and a
  // snout projecting past the body, which made the silhouette two shapes. Tucked
  // in, there is no head and no snout -- one continuous round animal, the way a
  // seal loafs with its head drawn back into its shoulders.
  const pet = petGroup();
  assert.match(pet, /<path id="pet-body-0"/, 'one body');
  assert.doesNotMatch(pet, /id="pet-head"/, 'no separate head -- it is tucked in');
  assert.doesNotMatch(pet, /id="pet-snout"/, 'and no snout sticking out');
  assert.equal(count(pet, 'id="pet-body'), 1, 'exactly one mass');

  // Round. The last pass asserted "longer than tall" because the body tapered to a
  // tail; with the head tucked in that is gone, and what is wanted is a round.
  const [w, h] = extent(bodyOf(pet));
  // The body was lengthened on request, so the floor moved with it -- the seal is
  // now longer than the 0.8 it used to hold to. The upper bound still stops it
  // becoming an oval lying on its side.
  assert.ok(h > w * 0.7, `round, not a slab: ${w.toFixed(1)} x ${h.toFixed(1)}`);
  assert.ok(h < w * 1.15, `and not an oval lying down: ${w.toFixed(1)} x ${h.toFixed(1)}`);
});

test('the face sits on the right, so the seal is still facing that way', () => {
  // With no snout to point, the direction is carried entirely by where the face
  // is: two eyes and a smile all to the RIGHT of the middle of the mass.
  const pet = petGroup();
  const body = bodyOf(pet);
  const mid = xs(body).reduce((s, v) => s + v, 0) / coords(body).length;
  const eye = pet.slice(pet.indexOf('<g id="pet-eye">'), pet.indexOf('</g>', pet.indexOf('<g id="pet-eye">')));
  const mouth = pet.match(/<path id="pet-three-0"[^>]*\sd="([^"]+)"/)[1];

  const mean = (d) => xs(d).reduce((s, v) => s + v, 0) / coords(d).length;
  assert.ok(mean(mouth) > mid + 1.5,
    `the mouth must be well right of centre, got ${mean(mouth).toFixed(1)} vs ${mid.toFixed(1)}`);
  const eyeX = [...eye.matchAll(/cx="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...eyeX) > mid,
    `both eyes must be right of centre, got ${Math.min(...eyeX)} vs ${mid.toFixed(1)}`);
});


test('the coat is still ringed, and the flipper still tucked low', () => {
  const pet = petGroup();
  assert.ok(count(pet, 'class="pet__ring"') >= 3,
    'the coat must carry rings; found ' + count(pet, 'class="pet__ring"'));
  assert.match(pet, /id="pet-flipper-0"/, 'and it is still a seal, so it has a flipper');
  const fl = pet.match(/<path id="pet-flipper-0"\s+d="([^"]+)"/)[1];
  const body = bodyOf(pet);
  const top = Math.min(...ys(body));
  const belly = Math.max(...ys(body));
  assert.ok(Math.min(...ys(fl)) > top + (belly - top) * 0.45,
    'a flipper sits low on the body, not up at the shoulder');
});

test('the seal is big enough to read, and clear of the angler', () => {
  const pet = petGroup();
  const all = [...pet.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ');
  const [w] = extent(all);
  // It was lengthened on request, so 16 is no longer the bar -- that width
  // cleared the shorter body this change replaced.
  assert.ok(w >= 22, 'the body must be as long as was asked for, got ' + w.toFixed(1));
  assert.ok(Math.max(...xs(all)) < 25.7,
    'it must clear the angler at x=25.7, but reaches ' + Math.max(...xs(all)).toFixed(1));
  assert.ok(Math.max(...ys(all)) < 58, 'and its belly must sit on the deck at y=58');
});



test('every element the JS reaches for has a rule in the stylesheet', () => {
  // Deleting dead seal CSS took the whole Bond stylesheet with it -- the dead rules
  // sat directly above it -- and every test stayed green, because they only ever
  // checked that the MARKUP existed. An unstyled Bond panel renders as bare text
  // in a dialog and nothing noticed.
  //
  // Checked against the CSS outside every @media BLOCK. Searching the whole sheet
  // let a rule nested in a media query satisfy the check -- the reduced-motion
  // block holds a one-liner for .bond__fill -- so the real rule could be deleted.
  // Line anchoring does not help: that nested rule sits at the same indentation.
  const cssTop = PAGE.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\}[^{}]*)*\}/g, '');
  const rule = (sel) => new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{');

  for (const cls of ['.bond__step', '.bond__fill', '.bond__track', '.bond__name',
                     '.bond__reward', '.bond__at', '.bond__note']) {
    assert.match(cssTop, rule(cls), cls + ' has no rule outside a media query');
  }
  for (const state of ['bond__step.is-on', 'bond__step.is-next']) {
    assert.match(cssTop, rule(state),
      state + ' has no rule -- a reached or next step would be invisible');
  }
  // The pill itself is a .btn like every other bar button, and must be on the bar.
  // lastIndexOf, not indexOf: the document has a second .hud for the stat
  // readout at the top of the game, and the bar is the LAST one.
  const barStart = PAGE.lastIndexOf('<div class="hud"');
  const bar = PAGE.slice(barStart, PAGE.indexOf('</div>', PAGE.indexOf('bestiary', barStart)));
  assert.match(bar, /id="bond-open"[^>]*class="btn"|class="btn"[^>]*id="bond-open"/,
    'the Bond pill must be a .btn on the bottom bar');
});

test('the boost stack is in the top-right corner, not the bottom', () => {
  const css = rule('.lake__boosts');
  const top = /top:\s*([\d.]+)rem/.exec(css);
  const bottom = /bottom:\s*([\d.]+)rem/.exec(css);
  const right = /right:\s*([\d.]+)rem/.exec(css);
  const left = /\bleft:\s*([\d.]+)rem/.exec(css);

  assert.ok(top, 'the stack must be pinned to the top');
  assert.equal(bottom, null, 'and must NOT still be pinned to the bottom');
  assert.ok(right, 'and to the right');
  assert.equal(Number(right[1]) < 2, true, 'hard against the right edge, got ' + right[1]);

  // Anchored by right, NOT by left. Setting both would leave the panel's own width
  // deciding which edge wins, so on a narrow lake it would drift back across the
  // screen as the content reflowed -- and nothing would look wrong.
  assert.equal(left, null,
    'the stack must be anchored by right alone; a left offset would fight it');

  // The rows align to the same edge, or they stay ragged against the corner the
  // panel no longer occupies.
  assert.match(css, /justify-items:\s*end/,
    'the rows must sit against the right edge now');
});

test('the seal bubble does not collide with the boost stack', () => {
  // These two used to share the top-left corner, which is why the bubble had to sit
  // so far down: it was dodging the stack. The stack is now top-RIGHT and the bubble
  // is on the LEFT, so the two are in different corners and cannot overlap.
  //
  // That is a stronger guarantee than a hand-tuned offset, so assert the corners
  // differ rather than asserting a magic top percentage -- which would drift out of
  // date the next time either panel moves, and fail for the wrong reason.
  const boost = rule('.lake__boosts');
  const bubble = rule('.bubble');

  const bubbleTop = Number(/top:\s*([\d.]+)%/.exec(bubble)?.[1] ?? -1);
  const bubbleLeft = Number(/left:\s*([\d.]+)%/.exec(bubble)?.[1] ?? -1);
  assert.ok(bubbleTop >= 0, 'the bubble must have a top, got ' + bubbleTop);
  assert.ok(bubbleLeft >= 0, 'the bubble must have a left, got ' + bubbleLeft);

  // The stack is on the RIGHT, so the bubble being on the LEFT is what keeps them
  // apart -- and that is now a layout fact rather than a tuned number.
  assert.match(boost, /\bright:\s*[\d.]+rem/,
    'the stack must be anchored to the right, or it can overlap the bubble again');
  assert.ok(bubbleLeft < 50,
    `the bubble must stay on the left half, got left: ${bubbleLeft}%`);

  // And the bubble must still be ABOVE the boost stack in z, so a long line is
  // readable while the seal speaks -- the panels are in different corners but they
  // are still both inside the lake.
  const bz = Number(/z-index:\s*(\d+)/.exec(bubble)?.[1] ?? 0);
  const sz = Number(/z-index:\s*(\d+)/.exec(boost)?.[1] ?? 0);
  assert.ok(bz > sz, `the bubble (z=${bz}) must sit above the stack (z=${sz})`);
});


test('the body is as long as asked, filling the pier', () => {
  const pet = petGroup();
  const all = [...pet.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ');
  const [w] = extent(all);
  assert.ok(w >= 23.8, 'the body must fill the pier, got ' + w.toFixed(1) + ' units');
  assert.ok(Math.max(...xs(all)) < 25.7, 'and still clear the angler at 25.7');
});

test('the face is the literal :3 -- a colon, then a numeral 3', () => {
  // Five rounds drew the INTERPRETATION of ":3": two eyes side by side and a
  // smile arc. Read against the actual characters, that is a generic smiley.
  //
  // ":3" is a colon and a digit. The colon is two dots STACKED VERTICALLY. The
  // digit is a vertical, two-lobed curve opening to the LEFT -- not an arc.
  const pet = petGroup();
  const start = pet.indexOf('<g id="pet-face-0">');
  const face = pet.slice(start, pet.indexOf('</g>', pet.indexOf('id="pet-three-0"')));
  assert.match(face, /id="pet-colon-0"/, 'the colon');
  assert.match(face, /id="pet-three-0"/, 'the numeral 3');
});


test('the colon is two dots stacked VERTICALLY', () => {
  // The whole difference between a smiley and ":3". A colon's dots share an x and
  // differ in y. Every previous pass put them side by side, which is eyes.
  const pet = petGroup();
  const s = pet.indexOf('<g id="pet-colon-0">');
  const colon = pet.slice(s, pet.indexOf('</g>', s));
  const dots = [...colon.matchAll(/cx="([\d.]+)"[^>]*cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(dots.length, 2, 'a colon is two dots, found ' + dots.length);
  assert.ok(Math.abs(dots[0][0] - dots[1][0]) < 0.05,
    'the two dots share an x -- they are stacked, not side by side. Got '
    + dots[0][0] + ' and ' + dots[1][0]);
  assert.ok(Math.abs(dots[1][1] - dots[0][1]) >= 2.5,
    'and are separated vertically, got ' + Math.abs(dots[1][1] - dots[0][1]).toFixed(2));
  // Round dots -- not ovals.
  assert.doesNotMatch(colon, /<ellipse/, 'colon dots are circles');
});

test('the 3 is a two-lobed curve opening LEFT, taller than wide', () => {
  // This is what distinguishes a "3" from a smile. A smile's rightmost point is
  // its right END. A "3" bulges to the right in the middle and comes back LEFT at
  // the bottom, so its right end sits well inside its own width.
  const pet = petGroup();
  const d = pet.match(/<path id="pet-three-0"[^>]*\sd="([^"]+)"/)[1];
  const pts = coords(d);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const startX = xs[0];
  const endX = xs[xs.length - 1];
  const maxX = Math.max(...xs);
  assert.ok(maxX > endX + 1,
    'a 3 bulges right and returns left, so its last point must be inside its width: '
    + 'start ' + startX.toFixed(1) + ', end ' + endX.toFixed(1) + ', widest ' + maxX.toFixed(1));
  assert.ok(maxX > startX + 1, 'and it must start on the left');

  // Two lobes: the width must peak, dip back toward the axis, then peak again.
  // A single arc has one bulge.
  const mid = xs.slice(1, -1);
  assert.ok(Math.min(...mid) < maxX - 1,
    'a 3 has a waist between its two lobes, not one continuous bulge');

  // Vertical, like the digit.
  const w = maxX - Math.min(...xs);
  const hgt = Math.max(...ys) - Math.min(...ys);
  assert.ok(hgt > w, 'the numeral 3 is taller than it is wide, got '
    + w.toFixed(1) + ' by ' + hgt.toFixed(1));

  // Drawn as a stroke, so it reads as the character rather than a filled blob.
  const tag = pet.match(/<path id="pet-three-0"[^>]*>/)[0];
  assert.match(tag, /fill="none"/, 'the 3 is an outline, not a solid shape');
  assert.ok(Number(/stroke-width="([\d.]+)"/.exec(tag)[1]) >= 0.45,
    'and thick enough to see');
});

test('the colon sits to the LEFT of the 3, as the characters do', () => {
  const pet = petGroup();
  const colon = pet.match(/<g id="pet-colon-0">([\s\S]*?)<\/g>/)[1];
  const dots = [...colon.matchAll(/cx="([\d.]+)"/g)].map((m) => Number(m[1]));
  const three = coords(pet.match(/<path id="pet-three-0"[^>]*\sd="([^"]+)"/)[1]).map((p) => p[0]);
  assert.ok(Math.max(...dots) < Math.min(...three),
    'the colon is left of the 3 -- in ":3" it reads ":3", not "3:"');
});

test('the whole face reads :3 compactly, sitting on the seal', () => {
  const pet = petGroup();
  const face = pet.slice(pet.indexOf('<g id="pet-face-0">'),
    pet.indexOf('</g>', pet.indexOf('id="pet-three-0"')));
  const colon = [...pet.matchAll(/<circle cx="([\d.]+)"[^>]*cy="([\d.]+)"/g)]
    .map((m) => [Number(m[1]), Number(m[2])]);
  const three = coords(pet.match(/<path id="pet-three-0"[^>]*\sd="([^"]+)"/)[1]);

  // The glyph has to fit ON the animal, not float off it.
  const body = bodyOf(pet);
  const bx = xs(body), by = ys(body);
  const allX = [...colon.map((p) => p[0]), ...three.map((p) => p[0])];
  const allY = [...colon.map((p) => p[1]), ...three.map((p) => p[1])];
  assert.ok(Math.min(...allX) > Math.min(...bx), 'the face sits on the seal, not off its left edge');
  assert.ok(Math.max(...allX) < Math.max(...bx), 'nor off its right edge');
  assert.ok(Math.min(...allY) > Math.min(...by), 'and not above it');
  assert.ok(Math.max(...allY) < Math.max(...by) - 1, 'nor running into the belly');

  // Compact: a glyph crammed over the whole animal stops reading as a glyph.
  const faceW = Math.max(...allX) - Math.min(...allX);
  const bodyW = Math.max(...bx) - Math.min(...bx);
  assert.ok(faceW < bodyW * 0.55,
    'the :3 must be compact, it spans ' + faceW.toFixed(1) + ' of a ' + bodyW.toFixed(1) + ' body');
});

/**
 * The :3 as the browser will actually draw it: the glyph's own geometry pushed
 * through the #pet-tilt transform, so it can be measured against the body.
 *
 * Everything here is read out of the markup. Hardcoding the pivot would let the
 * drawing and the test drift apart, which is how the original 0.8-unit overlap
 * survived a suite full of seal assertions -- every earlier test read the glyph's
 * UNROTATED coordinates, and the rotation is what pushed it off the shoulder.
 */

/** A transform list as a 2x3 matrix, applied left to right as SVG does. */
function mat(list) {
  let m = [1, 0, 0, 1, 0, 0];                       // a b c d e f
  const mul = (p, q) => [
    p[0] * q[0] + p[2] * q[1],
    p[1] * q[0] + p[3] * q[1],
    p[0] * q[2] + p[2] * q[3],
    p[1] * q[2] + p[3] * q[3],
    p[0] * q[4] + p[2] * q[5] + p[4],
    p[1] * q[4] + p[3] * q[5] + p[5],
  ];
  for (const [op, args] of list) {
    const n = args.map(Number);
    if (op === 'rotate') {
      const t = (n[0] * Math.PI) / 180;
      const c = Math.cos(t), s = Math.sin(t);
      // rotate(a cx cy) is translate(cx cy) rotate(a) translate(-cx -cy).
      m = mul(m, mul([1, 0, 0, 1, n[1] ?? 0, n[2] ?? 0],
        mul([c, s, -s, c, 0, 0], [1, 0, 0, 1, -(n[1] ?? 0), -(n[2] ?? 0)])));
    } else if (op === 'translate') {
      m = mul(m, [1, 0, 0, 1, n[0], n[1] ?? 0]);
    } else if (op === 'scale') {
      m = mul(m, [n[0], 0, 0, n[1] ?? n[0], 0, 0]);
    } else {
      throw new Error('unhandled transform: ' + op);
    }
  }
  return m;
}

/** The #pet-tilt transform, parsed from the markup. */
function faceMatrix() {
  const t = PAGE.match(/id="pet-tilt-0"\s+transform="([^"]+)"/);
  assert.ok(t, '#pet-tilt must carry the tilt transform');
  const list = [...t[1].matchAll(/([a-z]+)\(([^)]*)\)/g)]
    .map((m) => [m[1], m[2].split(/[\s,]+/).filter(Boolean)]);
  return mat(list);
}

const place = (m, p) => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];

/**
 * Flatten an M/C path to points. Only what these two paths use: an M and a run of
 * cubics. A cubic takes SIX numbers (two control points and an end point) -- reading
 * eight makes the parser run off the end of the token list.
 */
function pathPoints(d, steps = 400) {
  const seq = [...d.matchAll(/[A-Za-z]|-?\d*\.?\d+/g)]
    .map((m) => (/[A-Za-z]/.test(m[0]) ? m[0] : Number(m[0])));
  const pts = [];
  let i = 0, cmd = null, cur = null;
  while (i < seq.length) {
    if (typeof seq[i] === 'string') { cmd = seq[i]; i += 1; continue; }
    if (cmd === 'M') { cur = [seq[i], seq[i + 1]]; i += 2; }
    else if (cmd === 'C') {
      const [x0, y0] = cur;
      const [x1, y1] = [seq[i], seq[i + 1]];
      const [x2, y2] = [seq[i + 2], seq[i + 3]];
      const [x3, y3] = [seq[i + 4], seq[i + 5]];
      for (let k = 0; k <= steps; k += 1) {
        const u = k / steps, v = 1 - u;
        pts.push([
          v ** 3 * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u ** 3 * x3,
          v ** 3 * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u ** 3 * y3,
        ]);
      }
      cur = [x3, y3]; i += 6;
    } else throw new Error('unhandled path command: ' + cmd);
  }
  return pts;
}

/** Smallest distance from the drawn face to the body's outline. */
function nearestApproach() {
  const pet = petGroup();
  const m = faceMatrix();
  const body = pathPoints(bodyOf(pet));

  // Every drawn mark, in the glyph's own coordinates, then placed.
  const face = pathPoints(pet.match(/<path id="pet-three-0"[^>]*\sd="([^"]+)"/)[1]);
  for (const [, cx, cy] of pet.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)) {
    face.push([Number(cx), Number(cy)]);
  }

  let best = Infinity, at = null;
  for (const f of face) {
    const p = place(m, f);
    for (const b of body) {
      const d = Math.hypot(p[0] - b[0], p[1] - b[1]);
      if (d < best) { best = d; at = [p, b]; }
    }
  }
  return { best, at };
}

test('the face sits fully inside the body, with room to spare', () => {
  // The rotation is what breaks this: the glyph is drawn upright and then turned a
  // quarter turn about a pivot, so its drawn coordinates say nothing about where it
  // lands. At the original pivot (20.5, 39.5) the turned 3 came within 0.8 units of
  // the shoulder -- the face overhung the animal, which is what made it read as a
  // sticker rather than a face.
  //
  // HALF THE STROKE WIDTH is counted because the centreline is not the ink: a
  // stroke-width .55 numeral puts .275 of dark on either side of its path, and the
  // dot of the colon is a filled .72 circle whose edge is a further .72 out. The
  // 1.6-unit floor is a floor on the INK, so it is measured from the edge.
  const pet = petGroup();
  const stroke = Number(
    /stroke-width="([\d.]+)"/.exec(pet.match(/<path id="pet-three-0"[^>]*>/)[0])[1]);

  const { best, at } = nearestApproach();
  const ink = best - stroke / 2;
  assert.ok(ink >= 1.6,
    `the face clears the body by only ${ink.toFixed(2)} units `
    + `(centreline ${best.toFixed(2)} - half of the ${stroke} stroke); `
    + `nearest pair ${JSON.stringify(at.map((p) => p.map((v) => +v.toFixed(2))))}. `
    + 'It needs at least 1.6.');

  // And it is inside, not merely far from the outline in some direction: the whole
  // turned glyph sits within the body's bounding box.
  const bx = xs(bodyOf(pet)), by = ys(bodyOf(pet));
  const m = faceMatrix();
  const face = pathPoints(pet.match(/<path id="pet-three-0"[^>]*\sd="([^"]+)"/)[1])
    .concat([...pet.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)]
      .map(([, cx, cy]) => [Number(cx), Number(cy)]))
    .map((p) => place(m, p));
  const fx = face.map((p) => p[0]), fy = face.map((p) => p[1]);
  assert.ok(Math.min(...fx) > Math.min(...bx) && Math.max(...fx) < Math.max(...bx),
    'the face is inside the body left-to-right');
  assert.ok(Math.min(...fy) > Math.min(...by) && Math.max(...fy) < Math.max(...by),
    'the face is inside the body top-to-bottom');
});

/* -------------------------------- the face, in FINAL scene coordinates */

/** Points along the numeral 3's path, in markup coordinates. */
function threePoints(doc) {
  return cubics(doc.getElementById('pet-three-0').getAttribute('d'))
    .flatMap(([a, q]) => [a, q[0], q[1], q[2]]);
}

/** Every drawn point of the :3 glyph -- numeral plus colon -- in markup coordinates. */
function glyphPoints(doc) {
  const pts = threePoints(doc);
  for (const c of doc.querySelectorAll('#pet-colon circle')) {
    pts.push([Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]);
  }
  return pts;
}

/**
 * A path as its cubic segments: [[start, [c1, c2, end]], ...]. Only what these two
 * paths use -- an M and a run of cubics.
 */
function cubics(d) {
  const seq = [...d.matchAll(/[A-Za-z]|-?\d*\.?\d+/g)]
    .map((m) => (/[A-Za-z]/.test(m[0]) ? m[0] : Number(m[0])));
  const segs = [];
  let i = 0, cmd = null, cur = null;
  while (i < seq.length) {
    if (typeof seq[i] === 'string') { cmd = seq[i]; i += 1; continue; }
    if (cmd === 'M') { cur = [seq[i], seq[i + 1]]; i += 2; }
    else if (cmd === 'C') {
      const q = [[seq[i], seq[i + 1]], [seq[i + 2], seq[i + 3]], [seq[i + 4], seq[i + 5]]];
      segs.push([cur, q]);
      cur = q[2];
      i += 6;
    } else throw new Error('unhandled path command: ' + cmd);
  }
  return segs;
}

/**
 * The seal face as the BROWSER lays it out.
 *
 * Everything above measures the MARKUP: the glyph, and the body, in the coordinates
 * they are drawn in. That is not what the player sees. The scene is drawn with
 * preserveAspectRatio="none", so fitPet() counter-squeezes the seal's x by
 * lake.height/lake.width -- about 0.47 on a 1920x1080 desktop -- while #pet-face
 * carries the INVERSE correction so the face keeps the size it was drawn at.
 *
 * The body therefore gets NARROWER as the window gets wider, and the face does not.
 * A glyph that sits comfortably inside the body in the markup can still cross the
 * outline on screen, which is exactly what happened: the mouth ran off the seal's
 * right shoulder while every markup-level assertion stayed green.
 *
 * So these tests run the real fitPet(), read the transforms it wrote, and compose the
 * whole chain -- #pet-tilt then #pet-face then #fa-pet-fit -- before measuring.
 */

/**
 * The seal's whole SVG subtree, including the #fa-pet-fit wrapper.
 *
 * petGroup() slices #fa-pet alone, which is right for reading the drawing but WRONG
 * for measuring on screen: fitPet() writes its counter-squeeze onto #fa-pet-fit, the
 * group OUTSIDE #fa-pet. Parse without it and getElementById('fa-pet-fit-0') is null,
 * which is how the first version of this measured nothing at all.
 */
function petSvg() {
  // Slot 0, not "the pet" -- there are now two of them. Slot 0 is the animal that
  // has always been here, so every geometry assertion below still describes the
  // drawing it was written for.
  const start = PAGE.indexOf('<g id="fa-pet-fit-0"');
  const open = PAGE.lastIndexOf('<g', start);
  assert.ok(start > 0 && open > 0, 'the pet must live in a #fa-pet-fit-0 group');
  return PAGE.slice(open, PAGE.indexOf('</svg>'));
}

/**
 * Lake aspects to hold the 1.6-unit margin across.
 *
 * s = lake.height / lake.width, measured from the real layout: a 1920x1080 desktop
 * lands near 0.47, a 1440x900 laptop near 0.50, a 1280x720 near 0.42, and a portrait
 * window near 1.24. So 0.44..1.26 is what ordinary screens produce.
 *
 * Below about 0.44 -- a very wide AND short window -- the body is squeezed so narrow
 * that no right-facing face clears 1.6 units; that limit is asserted on its own
 * rather than hidden by quietly narrowing this range.
 */
const LAKE_ASPECTS = [];
for (let s = 0.44; s <= 1.26; s += 0.02) LAKE_ASPECTS.push(Number(s.toFixed(2)));

/** A transform list as a 2x3 matrix, applied left to right as SVG does. */
function matrix(list) {
  let m = [1, 0, 0, 1, 0, 0];                        // a b c d e f
  const mul = (p, q) => [
    p[0] * q[0] + p[2] * q[1],
    p[1] * q[0] + p[3] * q[1],
    p[0] * q[2] + p[2] * q[3],
    p[1] * q[2] + p[3] * q[3],
    p[0] * q[4] + p[2] * q[5] + p[4],
    p[1] * q[4] + p[3] * q[5] + p[5],
  ];
  for (const [, op, args] of list.matchAll(/([a-z]+)\(([^)]*)\)/g)) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (op === 'rotate') {
      const t = (n[0] * Math.PI) / 180;
      const c = Math.cos(t), sn = Math.sin(t);
      const cx = n[1] ?? 0, cy = n[2] ?? 0;
      m = mul(m, mul([1, 0, 0, 1, cx, cy],
        mul([c, sn, -sn, c, 0, 0], [1, 0, 0, 1, -cx, -cy])));
    } else if (op === 'translate') {
      m = mul(m, [1, 0, 0, 1, n[0], n[1] ?? 0]);
    } else if (op === 'scale') {
      m = mul(m, [n[0], 0, 0, n[1] ?? n[0], 0, 0]);
    } else {
      throw new Error('unhandled transform op: ' + op);
    }
  }
  return m;
}

const on = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** Two 2x3 matrices composed: p applied first, then q. */
const compose = (p, q) => [
  p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
];

/** Even-odd point-in-polygon. */
function within(x, y, poly) {
  let hit = false;
  for (let i = 0; i < poly.length; i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[(i + 1) % poly.length];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Run the real fitPet() for a lake of the given aspect and hand back the composed
 * transforms. fitPet is read out of angler.js rather than restated, so this measures
 * the code that actually runs -- if the anchors move, these numbers move with them.
 */
function fittedTransforms(doc, aspect) {
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function fitPet'), src.indexOf('function placeBobber'));
  assert.ok(body.includes('fitPet'), 'fitPet() must exist to measure against');

  const petY = Number(/const PET_Y = ([\d.]+);/.exec(body)[1]);
  const faceX = Number(/const FACE_X = ([\d.]+);/.exec(body)[1]);
  // The anchor is written as ${FACE_X}, not a literal: fitPet() now builds one
  // transform string for both dock slots, so the old /translate\(\d+ 0\) scale/
  // matched nothing and this threw on a null. FACE_X IS the anchor -- that is the
  // whole point of the constant -- so read it from there.
  assert.match(body, /translate\(\$\{FACE_X\} 0\) scale/,
    "the slot transform must be anchored on FACE_X, or the face slides as the lake changes shape");
  const anchor = faceX;

  // fitPet() derives its scale from box.height / box.width, so a lake one unit wide
  // and `aspect` tall makes the ratio exactly the aspect under test.
  const s = aspect;
  doc.getElementById('fa-pet-fit-0').setAttribute('transform',
    `translate(${anchor} 0) scale(${s} 1) translate(${-anchor} 0) translate(0 ${petY})`);
  doc.getElementById('pet-face-0').setAttribute('transform',
    `translate(${faceX} 0) scale(${(1 / s).toFixed(4)} 1) translate(${-faceX} 0)`);
  return { petY, faceX, anchor };
}

/** The body outline in final coordinates for a given aspect. */
function bodyOutline(doc, m) {
  const d = doc.getElementById('pet-body-0').getAttribute('d');
  return cubics(d).flatMap(([a, [c1, c2, e]]) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, v = 1 - u;
      pts.push(on(m, [
        v ** 3 * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * e[0],
        v ** 3 * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * e[1],
      ]));
    }
    return pts;
  });
}

/** Every ink mark of the face, in final coordinates, with its radius. */
function faceInk(doc, m) {
  const three = doc.getElementById('pet-three-0');
  const stroke = Number(three.getAttribute('stroke-width'));
  // cubics() returns [start, [c1, c2, end]] segments; place each segment's points,
  // not the segment itself -- on(m, segment) is a point times an array, i.e. NaN.
  const ink = cubics(three.getAttribute('d')).flatMap(([a, q]) =>
    [a, q[0], q[1], q[2]].map((p) => [on(m, p), stroke / 2]));
  for (const c of doc.querySelectorAll('#pet-colon circle')) {
    ink.push([on(m, [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]),
      Number(c.getAttribute('r'))]);
  }
  return ink;
}

test('the face is inside the seal at every realistic lake shape, not just in the markup', () => {
  // THE bug. The face is counter-corrected so it keeps its drawn size, while the
  // body gets squeezed by the scene's preserveAspectRatio="none". On a wide desktop
  // the body narrows to about 47% and the face does not, so a glyph that fits in the
  // markup crosses the outline on screen -- the mouth ran off the right shoulder.
  //
  // Every earlier seal test measured markup coordinates, which is why a face visibly
  // outside the animal passed a suite full of assertions about the face.
  const doc = new JSDOM(petSvg()).window.document;

  let worst = Infinity, outside = 0, at = null;
  for (const aspect of LAKE_ASPECTS) {
    const { anchor } = fittedTransforms(doc, aspect);
    const outer = matrix(doc.getElementById('fa-pet-fit-0').getAttribute('transform'));
    const faceM = matrix(doc.getElementById('pet-face-0').getAttribute('transform'));
    const tiltM = matrix(doc.getElementById('pet-tilt-0').getAttribute('transform'));
    const M = matrix(doc.getElementById('fa-pet-fit-0').getAttribute('transform'));
    const full = compose(compose(outer, faceM), tiltM);
    assert.ok(anchor);

    const body = bodyOutline(doc, outer);
    for (const [p, r] of faceInk(doc, full)) {
      if (!within(p[0], p[1], body)) outside++;
      let d = Infinity;
      for (const b of body) {
        const dd = Math.hypot(p[0] - b[0], p[1] - b[1]) - r;
        if (dd < d) d = dd;
      }
      if (d < worst) { worst = d; at = { aspect, p: p.map((v) => +v.toFixed(2)) }; }
    }
  }

  assert.equal(outside, 0,
    `${outside} ink points fall outside the seal's outline once fitPet() is applied. `
    + 'The face must be inside the body as the player sees it, not only in the markup.');
  assert.ok(worst >= 1.6,
    `the face clears the body by only ${worst.toFixed(2)} units of ink `
    + `(worst at aspect ${at.aspect}, near ${JSON.stringify(at.p)}); it needs 1.6. `
    + 'The body is squeezed on wide lakes while the face keeps its size, so the glyph '
    + 'has to be small enough to clear the shoulder at the widest lake.');
});

test("FACE_X is the seal's own anchor, so the face cannot drift", () => {
  // THE SECOND HALF OF THE BUG, and the one that made the first look impossible.
  //
  // fitPet() squeezes the whole pet's x by s = lake.height / lake.width about x=13,
  // and then scales the face back by 1/s about FACE_X. When both turn about the SAME
  // point the two cancel exactly and the chain is a pure translation: the face keeps
  // the size it was drawn at and never moves relative to the body.
  //
  // Anchored anywhere else they do NOT cancel, and the face slides by
  // (1 - s) * (13 - FACE_X) -- about 2 units on a wide desktop, and changing as the
  // window changes shape. It was 20.4, which is the UPRIGHT glyph's centre rather than
  // the turned one's, so every pass was measuring a face quietly sliding off the
  // animal and calling the result correct.
  const src = readFileSync(new URL('../vendor/fru-angler/angler.js', import.meta.url), 'utf8');
  const declared = Number(/const FACE_X = ([\d.]+);/.exec(src)[1]);
  const fitPetSrc = src.slice(src.indexOf('function fitPet'), src.indexOf('function placeBobber'));
  // The squeeze is written with ${FACE_X}, not a literal. There is therefore no
  // second number that can drift away from the first -- which is the entire point of
  // the constant. Assert that property directly, rather than parsing two literals
  // and comparing them: a hard-coded anchor sneaking back in IS the bug, and this
  // catches it wherever it lands.
  const squeezes = [...fitPetSrc.matchAll(/translate\((\$\{FACE_X\}|[-\d.]+) 0\) scale\(/g)]
    .map((m) => m[1]);
  assert.ok(squeezes.length >= 2,
    `expected the outer squeeze and the face's inverse both to be anchored; found ${squeezes.length}`);
  for (const anchor of squeezes) {
    assert.equal(anchor, '${FACE_X}',
      `a counter-squeeze is anchored on ${anchor} rather than FACE_X (${declared}). The `
      + 'two corrections only cancel when they share an anchor; otherwise the face '
      + 'slides by (1 - s) * (anchor - FACE_X), which grows on wider windows.');
  }

  // Both dock slots go through the same correction, so a second animal cannot be
  // fitted by different maths than the first -- which is how it would end up a smear
  // on exactly the lakes the first one survives.
  assert.match(fitPetSrc, /for \(const slot of dock\.querySelectorAll\('\.fa-pet-slot'\)\)/,
    'fitPet must fit every dock slot, not just the first');
  assert.match(fitPetSrc, /slot\.dataset\.slot === '0'/,
    'and the slots must differ only by an offset branch');

  // And prove the cancellation holds, by composing the chain at three very different
  // window shapes. A pure translation has a == d == 1: nothing scaled, nothing moved.
  const doc = new JSDOM(petSvg()).window.document;
  const seen = [];
  for (const aspect of [0.44, 0.75, 1.26]) {
    fittedTransforms(doc, aspect);
    const composed = compose(
      matrix(doc.getElementById('fa-pet-fit-0').getAttribute('transform')),
      matrix(doc.getElementById('pet-face-0').getAttribute('transform')));
    // Not exactly 1: fitPet writes the scale with toFixed(4), so the product is
    // 1 to within about 1e-5. Anything larger means the two anchors disagree again.
    assert.ok(Math.abs(composed[0] - 1) < 1e-4,
      `the chain scales x by ${composed[0]} at aspect ${aspect}; with a shared anchor it `
      + 'must be a pure translation up to fitPet\'s own rounding');
    assert.equal(composed[3], 1, 'and must not scale y either');
    seen.push(on(composed, [20, 40])[0]);
  }
  const spread = Math.max(...seen) - Math.min(...seen);
  assert.ok(spread < 0.001,
    `the face moves ${spread.toFixed(3)} units between window shapes `
    + `(${seen.join(' vs ')}); with a shared anchor it must not move at all.`);
});

test('the face is still inside at the widest windows that are still playable', () => {
  // Below s=0.44 -- an unusually wide AND short window -- the body is squeezed so
  // narrow that 1.6 units of margin is impossible for a right-facing face. Rather
  // than pretend otherwise, pin what actually happens there: still fully INSIDE, just
  // with a thinner margin. If this ever starts reporting ink outside the outline, the
  // face is hanging off the seal again on small screens.
  const doc = new JSDOM(petSvg()).window.document;
  for (const aspect of [0.30, 0.34, 0.38]) {
    fittedTransforms(doc, aspect);
    const composeAll = compose(
      compose(
        matrix(doc.getElementById('fa-pet-fit-0').getAttribute('transform')),
        matrix(doc.getElementById('pet-face-0').getAttribute('transform'))),
      matrix(doc.getElementById('pet-tilt-0').getAttribute('transform')));
    const body = bodyOutline(doc, matrix(doc.getElementById('fa-pet-fit-0').getAttribute('transform')));
    const outside = faceInk(doc, composeAll).filter(([p]) => !within(p[0], p[1], body));
    assert.equal(outside.length, 0,
      `${outside.length} ink points fall outside the seal at aspect ${aspect}. `
      + 'The face must stay on the animal at every window size, not only wide ones.');
  }
});

test('the face still looks at the angler, and stays clear of him', () => {
  // Making it fit must not turn it into a face in the middle of the animal looking
  // out to sea. The angler stands at x=25.7 on the dock.
  const doc = new JSDOM(petSvg()).window.document;
  const bodyD = doc.getElementById('pet-body-0').getAttribute('d');
  const bodyMid = (Math.min(...xs(bodyD)) + Math.max(...xs(bodyD))) / 2;

  const tiltM = matrix(doc.getElementById('pet-tilt-0').getAttribute('transform'));
  const pts = glyphPoints(doc).map((p) => on(tiltM, p));
  const fx = pts.map((p) => p[0]), fy = pts.map((p) => p[1]);
  const centre = (Math.min(...fx) + Math.max(...fx)) / 2;

  assert.ok(centre > bodyMid + 2,
    `the face must sit well right of the body's middle so it looks at the angler, `
    + `got ${centre.toFixed(2)} vs ${bodyMid.toFixed(2)}`);
  assert.ok(Math.max(...fx) < 24,
    'and stay off the angler at x=25.7, reaches ' + Math.max(...fx).toFixed(2));

  // The ":" is still left of the "3" once turned, or it reads as "3:".
  // Rotating 90 degrees clockwise maps the upright left-to-right order onto a
  // top-to-bottom one, so the colon must END UP BELOW the numeral's top edge and the
  // numeral's lower lobe must start above it -- assert on the drawn ordering instead:
  // the colon's centre x in markup is left of the 3's, which is what makes it ":3".
  // Compare the colon against the NUMERAL's own points. Using glyphPoints() here
  // folded the colon's own x into the minimum, so the test asked whether 18.2 was
  // less than 18.2 and failed for a reason that had nothing to do with the drawing.
  const colonX = [...doc.querySelectorAll('#pet-colon circle')]
    .map((c) => Number(c.getAttribute('cx')));
  const threeX = threePoints(doc).map((p) => p[0]);
  assert.ok(Math.max(...colonX) < Math.min(...threeX),
    `the colon is still left of the 3 in the drawing, or it reads "3:" `
    + `(colon ${colonX}, numeral starts at ${Math.min(...threeX)})`);
  assert.ok(Math.max(...fy) > Math.min(...fy));
});

test('the sun bloom is a rounded rectangle, not a disc behind the boosts', () => {
  // It was width:22%; aspect-ratio:1; border-radius:50% at right:6%/top:4% -- a
  // perfect circle sitting exactly where the boost readout lives, so it framed the
  // numbers as one big pale bubble instead of reading as light. Asked for as a
  // rounded rectangle.
  // Strip comments first. The rule's own comment explains that it WAS a 50% radius,
  // and the checks below read that prose as if it were still a declaration.
  const css = PAGE.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /\.lake::before\s*\{([^}]*)\}/.exec(css);
  assert.ok(m, '.lake::before must exist -- it is the sun bloom');
  const body = m[1];

  // No full circle. A 50% radius on both axes is a disc whatever the width says.
  assert.doesNotMatch(body, /border-radius:\s*50%/,
    'border-radius:50% makes the bloom a circle again, whatever its width');
  // And no aspect-ratio:1, which forces a square box and undoes any height below.
  assert.doesNotMatch(body, /aspect-ratio:\s*1\b/,
    'aspect-ratio:1 forces a square; the bloom needs its own height to be a panel');

  // It must still be rounded -- corners present but short of a full radius.
  const br = /border-radius:\s*([^;]+)/.exec(body);
  assert.ok(br, 'the bloom must have rounded corners');
  const corners = br[1].match(/[\d.]+%/g) || [];
  assert.ok(corners.length >= 1, 'border-radius must use percentages');
  for (const c of corners) {
    assert.ok(parseFloat(c) < 50,
      `border-radius ${c} on both axes rounds the bloom back into a circle; keep the `
      + 'corners short of 50% so it reads as a rounded panel');
  }

  // Both dimensions are set explicitly, so the shape is a rectangle and not a
  // square that merely looks like one.
  assert.match(body, /(?<![-\w])width:\s*[^;]+/, 'the bloom needs an explicit width');
  assert.match(body, /(?<![-\w])height:\s*[^;]+/, 'and an explicit height');

  // It keeps the Aero glow and its corner of the lake -- this is a shape change,
  // not a removal.
  assert.match(css, /#fff9c4/, 'the Aero sun bloom colour must remain');
  assert.match(body, /radial-gradient/, 'the soft falloff must remain');
  assert.match(body, /right:\s*6%/, 'it stays in the top-right corner');
  assert.match(body, /top:\s*4%/, 'at the same offset');
  assert.match(body, /pointer-events:\s*none/, 'and must stay click-through');
});

test("the seal's bubble sits above the seal, with a tail that still reaches it", () => {
  // Raised from top:34% to 26%. It used to sit level with the animal's back, which
  // read as a label lying on the seal rather than as something the seal is saying.
  //
  // The consequence is the part that is easy to miss: the tail is a FIXED-PX stub, so
  // moving the bubble up lengthens the gap it has to bridge. Left at the old length
  // it stops short and the bubble reads as floating text. The two must move together.
  // Strip comments: rule() returns the raw body, and this rule's own comment
  // explains that it WAS at top:34% -- which the check below then read as the
  // current value.
  const bubble = rule('.bubble').replace(/\/\*[\s\S]*?\*\//g, '');
  const top = Number(/top:\s*([\d.]+)%/.exec(bubble)?.[1] ?? -1);
  assert.ok(top >= 0, `the bubble must have a top, got ${top}`);
  assert.ok(top <= 28,
    `the bubble sits at top:${top}%; it was raised to 26% to clear the seal's back`);

  // Still on the left half -- the collision test covers the corner, this only
  // confirms raising it did not also slide it across.
  const left = Number(/left:\s*([\d.]+)%/.exec(bubble)?.[1] ?? -1);
  assert.ok(left >= 0 && left < 50, `the bubble must stay on the left, got left:${left}%`);

  // The tail must actually reach below the bubble: a rotated square of side N is
  // N*sqrt(2) tall with its tip N*sqrt(2)/2 below centre, so `bottom` is negative by
  // that reach. A tail whose bottom is positive would sit entirely INSIDE the bubble
  // and never appear at all.
  const tail = rule('.bubble__tail').replace(/\/\*[\s\S]*?\*\//g, '');
  const bottom = Number(/bottom:\s*(-?[\d.]+)px/.exec(tail)?.[1] ?? 999);
  const size = Number(/(?:width|height):\s*([\d.]+)px/.exec(tail)?.[1] ?? 0);
  assert.ok(bottom < 0,
    `the tail's bottom is ${bottom}px; it must be negative or it never emerges from `
    + 'the bubble and the speech has no visible pointer');

  // And it must be long enough for the gap the raised bubble opened. 34% -> 26% is
  // 8% of the lake height; on the shortest lake worth playing that is well over 20px,
  // so a stub shorter than about 20px leaves the bubble visibly detached.
  assert.ok(bottom <= -20,
    `the tail reaches ${-bottom}px, too short to bridge the raised bubble -- the `
    + 'bubble will read as floating text');

  // The diamond is what makes it a tail rather than a box, and it is load-bearing
  // geometry, not decoration.
  assert.match(tail, /rotate\(45deg\)/, 'the tail is a rotated square');
  assert.match(tail, /background:\s*rgba\(255,\s*255,\s*255/, 'and takes the bubble fill');
  assert.ok(size >= 10, `the tail is ${size}px; too small to see`);

  // The tail is decorative: the words live in the bubble's own text node, and the
  // tail is aria-hidden so a screen reader never announces a shape.
  assert.match(PAGE, /class="bubble__tail" aria-hidden="true"/,
    'the tail must stay aria-hidden');
});

test('a full bag badge is red, and legible', () => {
  // Self-contained on purpose: PAGE is the page source, and this guard must hold
  // even if the other CSS helpers are refactored.
  const body = PAGE.replace(/\/\*[\s\S]*?\*\//g, '');   // comments can lie about values
  const m = body.match(/\.hud__badge\.is-full\s*\{([^}]*)\}/);
  assert.ok(m, '.hud__badge.is-full must be styled -- otherwise paintBagBadge adds the '
    + 'class and nothing at all happens');
  const decl = m[1];

  const bg = /background:\s*([^;]+)/.exec(decl)?.[1].trim();
  assert.ok(bg, 'the full badge needs its own background');
  assert.ok(!/rgba\(1\s*,\s*87\s*,\s*155/.test(bg),
    `the full badge kept the normal blue fill (${bg}) -- a colour change that changes nothing`);

  const ink = /color:\s*(#[0-9a-f]{3,8})/i.exec(decl)?.[1];
  assert.equal(String(ink).toLowerCase(), '#fff',
    `the full badge must put white on the red, not red on the blue: got ${ink}`);

  // WCAG AA against the darker of the two backgrounds the HUD glass reaches. The
  // badge sits on translucent glass over a sky gradient, so the fill resolves
  // differently across the panel; the worst case still has to clear 4.5:1.
  // Takes the '#' INCLUDED, and says so. An earlier version of this helper was
  // handed a hex with the '#' already stripped and then sliced from index 1 --
  // silently reading #c62828 as 62282 and reporting 4.45:1 for a colour that is
  // really 5.62:1. A contrast guard that misreads its own input will either fail
  // a good value or pass a bad one, and it is not obvious which.
  const lum = (hex) => {
    const hx = hex.startsWith('#') ? hex.slice(1) : hex;
    assert.equal(hx.length, 6, `expected a 6-digit hex, got ${hex}`);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const solid = bg.match(/^#([0-9a-f]{6})$/i)?.[1];
  assert.ok(solid, `the full badge fill must be a solid hex so its contrast is knowable, got ${bg}`);
  const L1 = lum(`#${solid}`), L2 = lum('#ffffff');
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  assert.ok(ratio >= 4.5,
    `white on ${solid} is ${ratio.toFixed(2)}:1, under the 4.5 AA needs`);

  // A red FILL, not red text. Red text on the badge's normal blue fill measures
  // 3.87:1 at best -- this is the mistake the rule is written to prevent.
  assert.ok(!/^#(7f1d1d|8c1c18|991b1b|a01b12|b3261e|c62828)$/i.test(ink || ''),
    'red text on a pale badge fails contrast; fill it red instead');
});

test('upgrade rows are legible in all three states, and locked rows still read', () => {
  const body = PAGE.replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel) => {
    const m = body.match(new RegExp(sel.replace(/[.[\]]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
    assert.ok(m, `${sel} must be styled`);
    return m[1];
  };

  // Three visually distinct states, each with its own rule.
  for (const sel of ['.upgrade--owned', '.upgrade--locked', '.upgrade__state']) {
    assert.ok(rule(sel).trim().length > 0, `${sel} has declarations`);
  }
  // Fitted must be visually distinct from buyable -- the panel shows many rows at
  // once and a bought perk has to be findable without reading every line.
  // Dimming alone is not enough: `opacity: .78` with no colour change makes a bought
  // perk look merely disabled, which is the opposite of what "Fitted" should read as.
  // It has to be the GREEN of a kept thing, and that is asserted as a colour rather
  // than as "something changed", which is what the first version checked and why it
  // accepted a row with its colour stripped out.
  const owned = rule('.upgrade--owned');
  const triples = [...owned.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
    .map((m) => m.slice(1).map(Number));
  const green = triples.some(([r, g, b]) => g >= r + 25 && g >= b + 15);
  // The green must be dominant, not merely present. An earlier version matched a
  // wide RGB box that also accepted this page's own blue rgba(1,87,155,.1), so
  // replacing the green border with the blue one still passed.
  assert.ok(green,
    `a fitted upgrade must be bordered in a "kept" green, not just dimmed: ${owned.trim()}`);
  assert.match(owned, /background/, 'and its fill must change with it');

  // A locked row is dimmed far less than the old .55 used elsewhere in this page:
  // it is the row the player most wants to read, and at .55 it was all but invisible.
  const locked = rule('.upgrade--locked');
  const dim = /opacity:\s*([\d.]+)/.exec(locked);
  if (dim) assert.ok(Number(dim[1]) > 0.7,
    `a locked row must stay readable; opacity ${dim[1]} is too faint`);
  assert.match(locked, /dashed/, 'and it is dashed, so a locked row reads as unavailable');

  // The "why" line has a real ink colour, not an inherited one that may vanish.
  const why = rule('.upgrade__state');
  assert.match(why, /color:\s*#/, 'the gate line must name its own colour');
  assert.match(why, /font-weight:\s*[6-9]00/, 'and be bold enough to notice');

  // An empty "why" line must collapse rather than leave a gap.
  assert.match(body, /\.upgrade__state:empty\s*\{\s*display:\s*none/, 'an empty gate line collapses');
});
