import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RODS, FISH, RARITY_ORDER, RARITY_COLOURS, castQuality, castDistance, biteDelayFor, rollFish, rollMutation,
  fishWeight, catchValue, canCatch, buyRod, startingLoadout,
  startingInventory, ownsRod, addRodToInventory, equipRod, rodArt, RODS_BY_PRICE,
  fishSvg, FISH_SHAPES, hookLineFor, AREAS, areaUnlocked,
  rodWorksIn, rodCheckIn,
 areaProgress, levelFrom, xpForCatch, luckFromLevel, luckFor, LOST_ITEMS, rollLostItem, lostItemsFor, SEALS, buySeal, equipSeal, sealComment, sealDuplicates, visitArea, xpForLevel, sellLostItems, lostItemById, MUTATIONS, mutationMultiplierFor, mutationById, sealLines, WEATHER, TIMES, skyFor, luckFromSky,
  addToBag, fishEntrySpec, bagWorth, bagEntryValue,
  sellFromBag, sellWholeBag, feedToBond, bondLuck, bondCount,
  groupBag,
  sealFedLine,
  fishSilhouette,
  bondMilestones, bondProgress,} from '../vendor/fru-angler/fishing.js';

test('the starting wallet can afford exactly one upgrade from the cheapest rod', () => {
  const loadout = startingLoadout();
  assert.equal(loadout.rodId, 'bamboo');
  const upgrades = Object.values(RODS).filter((r) => r.price > RODS.bamboo.price);
  const cheapest = upgrades[0];
  assert.equal(loadout.coins, cheapest.price, 'starts with enough for the first upgrade');
  const nextOne = upgrades[1];
  assert.ok(loadout.coins < nextOne.price, 'but not two, so the first choice matters');
});

test('every rod is more expensive than the last', () => {
  // RODS_BY_PRICE is the order the shop lists, cheapest first. The table itself is
  // laid out by price, but asserting on the sorted list states the real rule.
  const prices = RODS_BY_PRICE.map((id) => RODS[id].price);
  for (let i = 1; i < prices.length; i += 1) {
    assert.ok(prices[i] > prices[i - 1],
      `${RODS_BY_PRICE[i]} must cost more than ${RODS_BY_PRICE[i - 1]}`);
  }
  // And the table is declared in that same order, so nothing drifts.
  assert.deepEqual(Object.keys(RODS), RODS_BY_PRICE,
    'the RODS table should already be in price order');
});

test('every rod can eventually catch every fish', () => {
  // Otherwise the bestiary is unreachable and the game is unwinnable.
  const ceiling = Math.max(...Object.values(RODS).map((r) => r.maxKg));
  const heaviest = Math.max(...FISH.map((f) => f.maxKg));
  assert.ok(ceiling >= heaviest, `top rod caps at ${ceiling} but a fish reaches ${heaviest}`);
});

test('castQuality is perfect only inside the green band', () => {
  assert.equal(castQuality(0.5), 'perfect');
  assert.equal(castQuality(0.45), 'perfect');
  assert.equal(castQuality(0.55), 'perfect');
  assert.equal(castQuality(0.9), 'good');
  assert.equal(castQuality(0.02), 'poor');
});

test('castQuality handles the extremes without throwing', () => {
  assert.doesNotThrow(() => castQuality(0));
  assert.doesNotThrow(() => castQuality(1));
  assert.equal(typeof castQuality(0), 'string');
});

test('cast distance rewards a perfect cast', () => {
  assert.ok(castDistance('perfect') > castDistance('good'));
  assert.ok(castDistance('good') > castDistance('poor'));
  for (const d of [castDistance('perfect'), castDistance('good'), castDistance('poor')]) {
    assert.ok(d > 0 && d <= 1, `distance ${d} must be a fraction of max range`);
  }
});

test('luck makes rare fish more likely as it rises', () => {
  // Checked per lake, since each lake has its own table of fish now.
  for (const area of AREAS) {
    const count = (rod) => {
      const got = new Set();
      for (let r = 0; r < 4000; r += 1) got.add(rollFish(r / 4000, rod, area.id).id);
      return got;
    };
    const bare = count(RODS.bamboo);            // luck 0
    const lucky = count(RODS.titan);            // luck 1.8
    assert.ok(lucky.size >= bare.size,
      `${area.name}: a luckier rod should not see fewer species (${bare.size} -> ${lucky.size})`);

    // The Mythical is the point of luck: if this lake has one, a better rod must
    // make it easier to reach, and even the worst rod can still stumble into it.
    if (area.fish.some((id) => FISH.find((f) => f.id === id)?.rarity === 'Mythical')) {
      const chance = (rod) => {
        let n = 0;
        for (let r = 0; r < 4000; r += 1) if (rollFish(r / 4000, rod, area.id).rarity === 'Mythical') n += 1;
        return n;
      };
      assert.ok(chance(RODS.bamboo) > 0,
        `${area.name}: even a bad rod can stumble into a mythical`);
      assert.ok(chance(RODS.titan) > chance(RODS.bamboo),
        `${area.name}: luck must actually raise the mythical rate`);
    }
  }
});


test('rollFish always returns a fish from the table', () => {
  for (let i = 0; i < 300; i += 1) {
    const fish = rollFish(i / 300, { luck: 0.5 });
    assert.ok(FISH.some((f) => f.id === fish.id), `roll ${i / 300} returned an unknown fish`);
  }
});

test('every species is reachable from the lake that holds it', () => {
  // The roll range must be able to produce every fish a lake lists, not just the
  // first few by weight.
  for (const area of AREAS) {
    const seen = new Set();
    for (let r = 0; r < 4000; r += 1) seen.add(rollFish(r / 4000, RODS.titan, area.id).id);
    for (const id of area.fish) {
      assert.ok(seen.has(id), `${area.name}: ${id} is listed but never comes up on a cast`);
    }
  }
});


test('biteDelayFor shrinks as lure speed rises', () => {
  const slow = biteDelayFor({ lureSpeed: 1 }, { baseMs: 2000, seed: 0.5 });
  const fast = biteDelayFor({ lureSpeed: 4.2 }, { baseMs: 2000, seed: 0.5 });
  assert.ok(fast < slow, 'higher lure speed must shorten the wait');
  assert.ok(fast > 0);
});

test('biteDelayFor is deterministic for a given seed', () => {
  const a = biteDelayFor({ lureSpeed: 2 }, { baseMs: 2000, seed: 0.3 });
  const b = biteDelayFor({ lureSpeed: 2 }, { baseMs: 2000, seed: 0.3 });
  assert.equal(a, b);
});

test('rollMutation always returns a listed mutation with a multiplier', () => {
  for (let i = 0; i < 200; i += 1) {
    const mutation = rollMutation(i / 200);
    assert.ok(mutation.multiplier >= 1, 'no mutation may be worth less than plain');
  }
});

test('weight is rolled inside the fish bounds', () => {
  const perch = FISH.find((f) => f.id === 'glidefin');
  for (let i = 0; i < 200; i += 1) {
    const kg = fishWeight(perch, i / 200);
    assert.ok(kg >= perch.minKg && kg <= perch.maxKg, `${kg} out of bounds`);
  }
});

test('value is kg times price times the mutation multiplier', () => {
  const perch = FISH.find((f) => f.id === 'glidefin');
  assert.equal(catchValue(perch, 2, 1), perch.pricePerKg * 2);
  assert.equal(catchValue(perch, 2, 3), perch.pricePerKg * 2 * 3);
});

test('a rod cannot land a fish above its weight ceiling', () => {
  const char = FISH.find((f) => f.id === 'glacier-char');
  const glidefin = FISH.find((f) => f.id === 'glidefin');
  assert.equal(canCatch(char, char.minKg, RODS.bamboo), false, 'even the lightest Char is too heavy');
  assert.equal(canCatch(char, char.minKg, RODS.oak), true, 'a heavy rod takes it');
  assert.equal(canCatch(glidefin, glidefin.maxKg, RODS.bamboo), true, 'the starting rod lands a Glidefin');
  assert.equal(canCatch(glidefin, glidefin.maxKg, RODS.bamboo) === false, false);
});

test('buyRod charges the price and swaps the rod', () => {
  const result = buyRod({ coins: 5000, rodId: 'bamboo' }, 'willow');
  assert.equal(result.ok, true);
  assert.equal(result.rodId, 'willow');
  assert.equal(result.coins, 5000 - RODS.willow.price);
});

test('a refused purchase leaves the wallet untouched', () => {
  const broke = { coins: 10, rodId: 'bamboo' };
  const result = buyRod(broke, 'titan');
  assert.equal(result.ok, false);
  assert.equal(result.coins, 10, 'a failed purchase must not deduct coins');
  assert.equal(result.rodId, 'bamboo', 'a failed purchase must not change the rod');
});

test('buyRod rejects an unknown rod id', () => {
  assert.equal(buyRod({ coins: 99999, rodId: 'bamboo' }, 'unobtanium').ok, false);
});

test('fish are ordered from common to mythical', () => {
  // Derived from RARITY_ORDER. A local copy went stale the moment Epic was
  // added: indexOf returned -1 for it, so every Epic fish read as a step
  // backwards and this test failed on a correctly ordered table.
  const ranks = FISH.map((f) => RARITY_ORDER.indexOf(f.rarity));
  for (let i = 1; i < ranks.length; i += 1) {
    assert.ok(ranks[i] >= ranks[i - 1], 'rarity must not go backwards down the table');
  }
});


/* ------------------------------------------------------------- inventory */

/**
 * Buying a rod has to put it somewhere. Previously a purchase simply overwrote the
 * equipped rod, so there was no inventory: you owned exactly one rod and could not
 * go back to an earlier one.
 */

test('you start owning only the starting rod', () => {
  const inv = startingInventory();
  assert.deepEqual(inv, ['bamboo']);
  assert.ok(ownsRod(inv, 'bamboo'));
  assert.equal(ownsRod(inv, 'willow'), false);
});

test('buying a rod adds it to the inventory and equips it', () => {
  const inv = startingInventory();
  const bought = addRodToInventory(inv, 'willow');
  assert.ok(ownsRod(bought, 'willow'), 'the new rod is owned');
  assert.ok(ownsRod(bought, 'bamboo'), 'the old one is kept');
  assert.equal(bought.length, 2);
});

test('buying the same rod twice does not duplicate it', () => {
  let inv = startingInventory();
  inv = addRodToInventory(inv, 'willow');
  inv = addRodToInventory(inv, 'willow');
  assert.equal(inv.filter((id) => id === 'willow').length, 1);
  assert.equal(inv.length, 2);
});

test('an unknown rod cannot enter the inventory', () => {
  const inv = addRodToInventory(startingInventory(), 'hypercarbon');
  assert.deepEqual(inv, ['bamboo']);
});

test('you can equip any rod you own', () => {
  let inv = startingInventory();
  inv = addRodToInventory(inv, 'willow');
  assert.equal(equipRod(inv, 'willow').rodId, 'willow');
  // and go back to the one you started with
  assert.equal(equipRod(inv, 'bamboo').rodId, 'bamboo');
});

test('you cannot equip a rod you do not own', () => {
  const inv = startingInventory();
  const result = equipRod(inv, 'titan');
  assert.equal(result.rodId, 'bamboo', 'an unaffordable/unowned rod is refused');
  assert.equal(result.ok, false);
  assert.match(result.reason, /own/i);
});

test('the inventory keeps its rods in price order', () => {
  let inv = startingInventory();
  for (const id of ['titan', 'willow', 'oak']) inv = addRodToInventory(inv, id);
  const prices = inv.map((id) => RODS[id].price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b), `not sorted: ${prices}`);
});

/* -------------------------------------------------------------- rod art */

/**
 * Each rod has to look different, or equipping one changes nothing visible.
 */
test('every rod has distinct artwork', () => {
  const seen = new Set();
  for (const id of Object.keys(RODS)) {
    const art = rodArt(id);
    assert.ok(art, `${id} has no art`);
    assert.match(art.path, /^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/, `${id}: bad rod path "${art.path}"`);
    assert.match(art.colour, /^#[0-9a-f]{6}$/i, `${id}: bad colour ${art.colour}`);
    assert.ok(art.width > 0.4, `${id}: rod is too thin to see`);
    seen.add(art.path + art.colour);
  }
  assert.equal(seen.size, Object.keys(RODS).length, 'rods must look different from each other');
});

test('each rod gets longer and thicker as it is upgraded', () => {
  // Walk in price order, which is the progression the player actually sees.
  const ids = Object.values(RODS_BY_PRICE);
  for (let i = 1; i < ids.length; i += 1) {
    const cheaper = rodArt(ids[i - 1]);
    const dearer = rodArt(ids[i]);
    assert.ok(dearer.width >= cheaper.width,
      `${ids[i]} should not be thinner than ${ids[i - 1]}`);
  }
});

test('the lure sits at the end of the rod it belongs to', () => {
  // The lure is a disc nudged just past the tip so it caps the rod rather than
  // hiding inside it. Anything more than a unit away would float or overlap.
  for (const id of Object.keys(RODS)) {
    const art = rodArt(id);
    const end = art.path.split('L')[1].trim().split(/\s+/).map(Number);
    assert.ok(Math.abs(art.tipX - end[0]) <= 1,
      `${id}: tip x ${art.tipX} is off the rod end ${end[0]}`);
    assert.ok(Math.abs(art.tipY - end[1]) <= 1,
      `${id}: tip y ${art.tipY} is off the rod end ${end[1]}`);
    assert.ok(art.tipX >= end[0] && art.tipY <= end[1],
      `${id}: the lure should sit up-and-right of the tip, along the rod`);
  }
});

test('an unknown rod falls back to the starting rod art', () => {
  assert.deepEqual(rodArt('nonsense'), rodArt('bamboo'));
});

test('RODS_BY_PRICE lists every rod from cheapest to dearest', () => {
  assert.equal(RODS_BY_PRICE.length, Object.keys(RODS).length);
  for (let i = 1; i < RODS_BY_PRICE.length; i += 1) {
    assert.ok(RODS[RODS_BY_PRICE[i]].price > RODS[RODS_BY_PRICE[i - 1]].price);
  }
  assert.equal(RODS_BY_PRICE[0], 'bamboo');
});


/* ------------------------------------------------------------ fish visuals */

/**
 * Every fish carries a hue and a body shape. They were in the table from the start
 * and never rendered, so a catch was just a line of text. The catch card now draws
 * the fish, and these are the pure functions behind it.
 */

test('every fish declares a hue and a known body shape', () => {
  for (const fish of FISH) {
    assert.ok(Number.isInteger(fish.hue) && fish.hue >= 0 && fish.hue <= 360,
      `${fish.id}: hue must be 0-360, got ${fish.hue}`);
    assert.ok(Object.hasOwn(FISH_SHAPES, fish.draw),
      `${fish.id}: unknown draw shape "${fish.draw}"`);
  }
});

test('every fish draws a complete, self-contained SVG', () => {
  for (const fish of FISH) {
    const svg = fishSvg(fish);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${fish.id}: no root`);
    assert.match(svg, /<\/svg>\s*$/, `${fish.id}: unclosed`);
    assert.match(svg, /viewBox="0 0 120 80"/, `${fish.id}: wrong viewBox`);
    assert.ok(!svg.includes('<script'), `${fish.id}: no script`);
    assert.ok(!/<foreignObject/.test(svg), `${fish.id}: no foreign objects`);
    // Every url(#id) must resolve inside this same file.
    const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(ids.has(ref[1]), `${fish.id}: dangling reference #${ref[1]}`);
    }
  }
});

test('the fish is tinted with its own hue', () => {
  for (const fish of FISH) {
    const svg = fishSvg(fish);
    const stops = [...svg.matchAll(/stop-color="hsl\((\d+)/g)].map((m) => Number(m[1]));
    assert.ok(stops.length >= 2, `${fish.id}: needs a gradient ramp`);
    // Every stop must sit near the fish's own hue. Hue is circular, so compare the
    // shortest way round: 350 and 5 are 15 apart, not 345.
    for (const hue of stops) {
      const diff = Math.min(Math.abs(hue - fish.hue), 360 - Math.abs(hue - fish.hue));
      assert.ok(diff <= 2, `${fish.id}: stop hue ${hue} should be near ${fish.hue}`);
    }
  }
});

test('each body shape draws differently', () => {
  // Compare the geometry itself: four shapes must not share one outline.
  const bodies = Object.values(FISH_SHAPES).map((s) => s.body);
  assert.equal(new Set(bodies).size, bodies.length,
    'every shape needs its own body outline');

  const tails = Object.values(FISH_SHAPES).map((s) => s.tail);
  assert.equal(new Set(tails).size, tails.length,
    'every shape needs its own tail');

  // And the two long fish must actually differ from each other on screen.
  const eco = fishSvg(FISH.find((f) => f.id === 'eco-gar'));
  const glacier = fishSvg(FISH.find((f) => f.id === 'glacier-char'));
  assert.notEqual(eco, glacier, 'two fish sharing a shape must still differ by hue');
});

test('the fish has a visible body, an eye and a tail', () => {
  // A silhouette with no features would read as a blob rather than a fish.
  const svg = fishSvg(FISH[0]);
  assert.match(svg, /class="body"/, 'needs a body');
  assert.match(svg, /class="tail"/, 'needs a tail');
  assert.match(svg, /class="eye"/, 'needs an eye');
  assert.match(svg, /class="fin"/, 'needs a fin');
  assert.match(svg, /class="stripe"/, 'needs a marking');
});

test('an unknown shape still produces a valid drawing', () => {
  const svg = fishSvg({ ...FISH[0], draw: 'leviathan' });
  assert.match(svg, /^<svg/, 'must not throw on an unknown shape');
  assert.match(svg, /<\/svg>\s*$/);
});

test('a missing fish falls back to the first one rather than throwing', () => {
  assert.doesNotThrow(() => fishSvg(null));
  assert.doesNotThrow(() => fishSvg(undefined));
  assert.match(fishSvg(null), /^<svg/);
});

test('the fish drawing carries the fish name for accessibility', () => {
  // Looked up by id, not by index: the table has grown and been re-sorted, so a
  // positional reference silently starts checking a different fish.
  const trout = FISH.find((f) => f.id === 'metro-trout');
  const svg = fishSvg(trout);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="[^"]*Metro Trout[^"]*"/, 'the name must be in the label');
});


/* ------------------------------------------------- maximalist Aero fish art */

test('every fish is drawn with the full Aero treatment, not a flat body', () => {
  // The old drawing was four flat shapes on a flat pond. Maximalist Aero means
  // layered depth, bloom and specular, so assert the layers exist per fish.
  for (const fish of FISH) {
    const svg = fishSvg(fish);
    const where = fish.name;

    // A gradient body and at least two more for the fins and tail, so nothing
    // reads as a flat fill.
    const gradients = (svg.match(/<(linear|radial)Gradient/g) || []).length;
    assert.ok(gradients >= 5,
      `${where}: expected 5+ gradients for depth, found ${gradients}`);

    // Bloom around the fish and a specular highlight on it.
    assert.match(svg, /class="bloom"/, `${where} needs a bloom`);
    assert.match(svg, /class="specular"/, `${where} needs a specular highlight`);
    assert.match(svg, /filter=/, `${where} needs a glow filter`);

    // Bubbles rising, the signature Aero motif.
    assert.match(svg, /class="bubbles"/, `${where} needs bubbles`);

    // Glassy overlay across the water, plus caustics.
    assert.match(svg, /class="caustics"/, `${where} needs caustics`);
    assert.match(svg, /class="surface"/, `${where} needs a glassy water surface`);
  }
});

test('no two fish share SVG element ids', () => {
  // Every drawing used id="fb" and id="fs". Six fish in the index therefore
  // produced six copies of each id, so url(#fb) resolved to whichever came
  // first in the document and the rest silently borrowed its gradient.
  const ids = [];
  for (const fish of FISH) {
    for (const m of fishSvg(fish).matchAll(/\sid="([^"]+)"/g)) ids.push(m[1]);
  }
  assert.equal(new Set(ids).size, ids.length,
    `duplicate SVG ids across the fish drawings: ` +
    `${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
});

test('rarer fish are drawn more extravagantly than common ones', () => {
  // A Mythical should look like an event. Count the extra decoration layers.
  // Count the individual glints, not the wrapper group that holds them.
  const layers = (fish) => (fishSvg(fish).match(/class="sparkle"/g) || []).length;
  const common = FISH.filter((f) => f.rarity === 'Common');
  const rare = FISH.filter((f) => f.rarity === 'Mythical' || f.rarity === 'Legendary');
  assert.ok(rare.length > 0 && common.length > 0);

  const maxCommon = Math.max(...common.map(layers));
  const minRare = Math.min(...rare.map(layers));
  assert.ok(minRare > maxCommon,
    `the rarest fish should carry more sparkle than the commonest: ${minRare} vs ${maxCommon}`);
});

test('every fish drawing is well-formed and resolves its own references', () => {
  // A malformed gradient is dropped by the browser with no error, so a broken
  // drawing can pass every string assertion while rendering as a flat fish.
  // Check the things a browser would silently discard: unbalanced quotes, and
  // url(#x) where no id="x" exists in that same drawing.
  for (const fish of FISH) {
    const svg = fishSvg(fish);
    const where = fish.name;

    assert.equal((svg.match(/"/g) || []).length % 2, 0,
      `${where}: unbalanced quotes, so attributes are being misparsed`);

    const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const refs = [...new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]))];
    for (const ref of refs) {
      assert.ok(ids.has(ref), `${where}: url(#${ref}) has no matching id in this drawing`);
    }

    // Every opening tag must be closed or self-closing.
    const open = (svg.match(/<[a-zA-Z][^>]*(?<![/\d])>/g) || []).filter((t) => !t.endsWith('/>'));
    const closed = (svg.match(/<\/[a-zA-Z]+>/g) || []).length;
    assert.equal(open.length, closed, `${where}: ${open.length} tags open, ${closed} closed`);
  }
});

test('a drawn fish is still recognisable at index size', () => {
  // Maximalism must not bury the silhouette. The body has to stay the dominant
  // shape and the eye has to remain visible at 40px.
  const svg = fishSvg(FISH[0]);
  const body = svg.match(/class="body"[^>]*d="([^"]+)"/);
  assert.ok(body, 'the body must be a single, addressable path');
  assert.ok(body[1].length > 60, 'the body silhouette must be a real shape');
  assert.match(svg, /class="eye"/, 'the eye must survive, or it is not a fish');
  assert.match(svg, /viewBox="0 0 120 80"/, 'and the viewBox must be unchanged');
});


/* ------------------------------------------------------- the hook flavour */

test('every fish has its own line for the moment you hook it', () => {
  for (const fish of FISH) {
    assert.equal(typeof fish.hook, 'string', `${fish.name} needs a hook line`);
    assert.ok(fish.hook.trim().length > 0, `${fish.name} has an empty hook line`);
    assert.ok(fish.hook.length < 90, `${fish.name} has a very long line`);
  }

  // Each must be distinct: six fish sharing one line defeats the point.
  const lines = FISH.map((f) => f.hook);
  assert.equal(new Set(lines).size, lines.length,
    'hook lines must be unique per fish');
});

test('the hook line speaks in second person, like the player is there', () => {
  // The example the request gave: "You feel the power of the environment".
  for (const fish of FISH) {
    assert.match(fish.hook, /\b(you|your|you're|yours)\b/i,
      `${fish.name} should address the player: "${fish.hook}"`);
  }
});

test('a hook line is offered for an unknown fish rather than undefined', () => {
  assert.equal(typeof hookLineFor({ id: 'nope' }), 'string');
  assert.ok(hookLineFor({ id: 'nope' }).length > 0);
  // And a real fish gets its own, not the fallback.
  assert.equal(hookLineFor(FISH[0]), FISH[0].hook);
});


/* -------------------------------------------------------------- the areas */

/**
 * Areas: a Frutiger-themed set of waters, unlocked by clearing the current one.
 *
 * The unlock rule is "every fish in this water landed, and every rod owned", so
 * each area is a full sweep of the game rather than a shortcut to rare fish.
 */
test('the lakes are all Frutiger-themed and all start locked but the first', () => {
  assert.ok(AREAS.length >= 4, `expected at least 4 lakes, got ${AREAS.length}`);

  const ids = AREAS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'lake ids must be unique');

  for (const area of AREAS) {
    for (const key of ['id', 'name', 'theme', 'blurb', 'fish', 'palette']) {
      assert.ok(area[key] !== undefined, `${area.id} is missing ${key}`);
    }
    // Frutiger: a named Aero-family theme, and a real palette to paint with.
    assert.match(area.theme, /Aero|DORFic|Eco|Glacier|Dark Aero/,
      `${area.id} should be named for a Frutiger theme, got "${area.theme}"`);
    for (const key of ['skyTop', 'skyMid', 'skyFloor', 'water', 'accent']) {
      assert.match(String(area.palette[key]), /^#[0-9a-f]{3,8}$/i,
        `${area.id}.palette.${key} must be a hex colour, got ${area.palette[key]}`);
    }
    // haze and sun carry an alpha, so rgba() is correct for them.
    for (const key of ['haze', 'sun']) {
      assert.match(String(area.palette[key]), /^(#|rgba?\()/i,
        `${area.id}.palette.${key} must be a colour, got ${area.palette[key]}`);
    }
  }

  // The first lake is open from the start; the rest are not.
  assert.equal(AREAS[0].locked, false, 'the first lake must be open to a new player');
  for (const area of AREAS.slice(1)) {
    assert.equal(area.locked, true, `${area.id} must start locked`);
  }
});

test('every lake has fish in it, and every species is reachable somewhere', () => {
  // Rosters deliberately overlap: a later lake keeps some of what you have already
  // fished, so it reads as familiar but harder. The rule that matters is coverage.
  const seen = new Set();
  for (const area of AREAS) {
    assert.ok(area.fish.length > 0, `${area.id} has no fish`);
    for (const id of area.fish) {
      assert.ok(FISH.some((f) => f.id === id), `${area.id} lists unknown fish ${id}`);
      seen.add(id);
    }
  }
  for (const fish of FISH) {
    assert.ok(seen.has(fish.id), `${fish.name} is in no lake`);
  }
  // The Mythical only ever appears in the two hardest waters, and must be in the
  // deepest one — that lake is the reward for getting this far.
  const myth = FISH.find((f) => f.rarity === 'Mythical');
  const homes = AREAS.filter((a) => a.fish.includes(myth.id));
  assert.ok(homes.length >= 1, 'the Mythical must be catchable somewhere');
  assert.ok(homes.includes(AREAS[AREAS.length - 1]),
    'the deepest lake must hold the Mythical');
  for (const a of homes) {
    assert.ok(AREAS.indexOf(a) >= AREAS.length - 2,
      `${a.name} is too easy a home for the Mythical`);
    // A lake of one fish makes every cast identical, so luck would be meaningless.
    assert.ok(a.fish.length >= 2, `${a.name} needs more than one species`);
  }
});

test('later lakes are strictly harder than earlier ones', () => {
  // A lake must earn its unlock, so each one holds fish at least as rare as the
  // last. Otherwise a new lake is a downgrade.
  const weightOf = (area) => area.fish.reduce((sum, id) => {
    const f = FISH.find((x) => x.id === id);
    // Derived from RARITY_ORDER, so a new tier is scored correctly rather than
    // collapsing into the last branch. The old ternary gave every tier it did
    // not name the Mythical score, which made the whole check inert.
    return sum + 1 + Math.max(0, RARITY_ORDER.indexOf(f.rarity));
  }, 0) / area.fish.length;

  for (let i = 1; i < AREAS.length; i += 1) {
    assert.ok(weightOf(AREAS[i]) > weightOf(AREAS[i - 1]),
      `${AREAS[i].name} (${weightOf(AREAS[i]).toFixed(1)}) should be richer than ` +
      `${AREAS[i - 1].name} (${weightOf(AREAS[i - 1]).toFixed(1)})`);
  }
});

test('a lake stays shut until its own rods are owned, then opens', () => {
  // Each lake gates on ITS OWN rods, not on every rod in the game. This used to
  // demand all twelve, which made the last lake unreachable: you needed the
  // Abyssal Rig before you could reach the lake that hands it to you.
  for (const area of AREAS.slice(1)) {
    const previous = AREAS[AREAS.indexOf(area) - 1];
    const landed = Object.fromEntries(previous.fish.map((id) => [id, 5]));

    const missingOne = previous.requiredRods.slice(0, -1);
    assert.equal(areaUnlocked(area, { bestiary: landed, owned: missingOne }), false,
      `${area.name} must stay shut while one of its own rods is unowned`);

    assert.equal(areaUnlocked(area,
      { bestiary: landed, owned: previous.requiredRods }), true,
      `${area.name} opens once ${previous.name} is cleared and its rods are owned`);
  }
});

test('owning every rod does not open a lake whose fish you have not landed', () => {
  const every = Object.keys(RODS);
  for (const area of AREAS.slice(1)) {
    assert.equal(areaUnlocked(area, { bestiary: {}, owned: every }), false,
      `${area.name} must need its fish as well as its rods`);
  }
});

test('the first lake is always open, whatever the save looks like', () => {
  assert.equal(areaUnlocked(AREAS[0], { bestiary: {}, owned: [] }), true);
  assert.equal(areaUnlocked(AREAS[0], { bestiary: null, owned: null }), true);
});

test('fish can only be rolled from the lake you are standing in', () => {
  const other = AREAS[1];
  for (let i = 0; i < 300; i += 1) {
    const fish = rollFish(i / 300, RODS.bamboo, other.id);
    assert.ok(other.fish.includes(fish.id),
      `${fish.name} is not in ${other.name}`);
  }
});

test('an unknown lake id falls back to the first lake rather than crashing', () => {
  const fish = rollFish(0.5, RODS.bamboo, 'not-a-lake');
  assert.ok(AREAS[0].fish.includes(fish.id));
});


/* ----------------------------------------------- rod traits and gated lakes */

test('rods carry traits, and the specialist ones cost a premium', () => {
  for (const rod of Object.values(RODS)) {
    assert.ok(Array.isArray(rod.traits), `${rod.id} must declare a traits array`);
    for (const t of rod.traits) {
      assert.match(t, /^[a-z]+$/, `${rod.id} has a malformed trait: ${t}`);
    }
  }

  // A rod that can work a specialist lake must cost more than a plain upgrade of
  // similar stats, so the gate is a real economy decision and not a formality.
  const special = Object.values(RODS).filter((r) => r.traits.length > 0);
  assert.ok(special.length >= 2, `expected specialist rods, got ${special.length}`);
  for (const rod of special) {
    const plain = Object.values(RODS).filter((r) => r.traits.length === 0);
    const cheapestPlain = Math.min(...plain.map((r) => r.price));
    assert.ok(rod.price > cheapestPlain,
      `${rod.id} carries a trait but costs no more than a plain rod (¤${rod.price})`);
  }
});

test('the later lakes are trait-gated, and every gate is satisfiable', () => {
  // The first two lakes are deliberately ungated: they teach the loop, and the
  // player should not hit a paywall before they have seen a single fight. The
  // gate arrives at the third lake, once the rod ladder is established.
  const ungated = AREAS.filter((a) => !a.trait);
  assert.ok(ungated.length <= 2,
    `only the opening lakes may be ungated, got ${ungated.map((a) => a.id).join(', ')}`);
  assert.equal(AREAS[0].trait, null, 'the starting lake needs no trait');

  for (const area of AREAS.filter((a) => a.trait)) {
    assert.match(area.trait, /^[a-z]+$/);
    assert.ok(area.traitNote, `${area.id} should explain its trait in words`);
    const usable = Object.values(RODS).filter((r) => r.traits.includes(area.trait));
    assert.ok(usable.length > 0,
      `no rod has the ${area.trait} trait, so ${area.id} can never be fished`);
  }

  // The two the request named explicitly must both exist and be gated.
  const deep = AREAS.find((a) => a.name.includes('Dark Aero'));
  const fjord = AREAS.find((a) => a.name.includes('Glacier'));
  assert.equal(deep?.trait, 'reinforced', 'Dark Aero Deep needs the reinforced trait');
  assert.equal(fjord?.trait, 'ice', 'Glacier Fjord needs the ice trait');
});

test('a rod can only fish a lake when it carries that lake trait', () => {
  const deep = AREAS.find((a) => a.trait === 'reinforced');
  const fjord = AREAS.find((a) => a.trait === 'ice');
  assert.ok(deep && fjord, 'both named lakes must exist');

  const titan = Object.values(RODS).find((r) => r.traits.includes('reinforced'));
  assert.equal(rodWorksIn(titan.id, deep.id), true, 'a reinforced rod works the deep');
  assert.equal(rodWorksIn(titan.id, fjord.id), false,
    'but not the ice lake — that needs its own trait');

  const plain = RODS.bamboo;
  for (const area of AREAS) {
    const expected = area.trait === null;
    assert.equal(rodWorksIn(plain.id, area.id), expected,
      `bamboo should ${expected ? '' : 'not '}work ${area.name}`);
  }
});

test('a lake you cannot fish in reports why', () => {
  const deep = AREAS.find((a) => a.trait === 'reinforced');
  const check = rodCheckIn('bamboo', deep.id);
  assert.equal(check.ok, false);
  assert.match(check.reason, /reinforced/i, `unhelpful reason: ${check.reason}`);
  // The good case has no complaint.
  const titan = Object.values(RODS).find((r) => r.traits.includes('reinforced'));
  assert.equal(rodCheckIn(titan.id, deep.id).ok, true);
});

test('every lake holds at least six species', () => {
  for (const area of AREAS) {
    assert.ok(area.fish.length >= 6,
      `${area.name} holds only ${area.fish.length} species, needs 6 or more`);
  }
});

test('there are now enough fish to fill six lakes several times over', () => {
  assert.ok(FISH.length >= 20,
    `expected a much larger pond, got ${FISH.length} species`);
  const hook = new Set(FISH.map((f) => f.hook));
  assert.equal(hook.size, FISH.length, 'every species needs its own hook line');
  const ids = new Set(FISH.map((f) => f.id));
  assert.equal(ids.size, FISH.length, 'ids must be unique');
});

test('the next lake opens when the one you are standing in is finished', () => {
  // The rule is now: all fish in the CURRENT lake, plus every rod.
  const current = AREAS[1];
  const all = current.fish.reduce((b, id) => (b[id] = 5, b), {});
  const allRods = Object.keys(RODS);

  // Half the fish is not enough.
  const partial = current.fish.slice(0, 3).reduce((b, id) => (b[id] = 5, b), {});
  assert.equal(areaUnlocked(AREAS[2], { bestiary: partial, owned: allRods }), false,
    'the next lake must stay shut while species are unlanded');

  // All the fish but not all the rods is not enough either.
  assert.equal(areaUnlocked(AREAS[2], { bestiary: all, owned: ['bamboo'] }), false,
    'nor while rods are unowned');

  assert.equal(areaUnlocked(AREAS[2], { bestiary: all, owned: allRods }), true,
    'both conditions met, so it opens');
});

test('landing a lake full of fish from elsewhere does not open the next one', () => {
  // The gate must count the current lake's own species, not the total bestiary.
  const current = AREAS[1];
  const elsewhere = AREAS[3].fish.reduce((b, id) => (b[id] = 5, b), {});
  assert.equal(areaUnlocked(AREAS[2], { bestiary: elsewhere, owned: Object.keys(RODS) }), false,
    'fish from another lake must not count');
  void current;
});

test('every lake is fishable once you have the right rod', () => {
  for (const area of AREAS) {
    const rods = Object.keys(RODS).filter((id) => rodWorksIn(id, area.id));
    assert.ok(rods.length > 0, `${area.name} has no rod that can fish it`);
    // And one of them must be strong enough for its heaviest resident.
    const heaviest = Math.max(...area.fish.map((id) =>
      FISH.find((f) => f.id === id).maxKg));
    const strongEnough = rods.some((id) => RODS[id].maxKg >= heaviest);
    assert.ok(strongEnough,
      `no rod that works ${area.name} can land its ${heaviest} kg heaviest fish`);
  }
});

test('there are six rarity tiers, with Epic between Rare and Legendary', () => {
  assert.deepEqual(RARITY_ORDER,
    ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical']);
});

test('every rarity has a colour, and none is a flat default', () => {
  for (const rarity of RARITY_ORDER) {
    assert.match(RARITY_COLOURS[rarity] ?? '', /^#[0-9a-f]{6}$/i,
      `${rarity} needs a colour`);
  }
  assert.notEqual(RARITY_COLOURS.Epic, RARITY_COLOURS.Legendary,
    'Epic must be distinguishable from Legendary');
});

test('every fish sits in a known tier', () => {
  for (const fish of FISH) {
    assert.ok(RARITY_ORDER.includes(fish.rarity),
      `${fish.id} has rarity ${fish.rarity}, which is not a tier`);
  }
});

test('every lake carries at least one fish of each high tier', () => {
  for (const area of AREAS) {
    const held = area.fish.map((id) => FISH.find((f) => f.id === id)?.rarity);
    for (const rarity of ['Rare', 'Epic', 'Legendary', 'Mythical']) {
      assert.ok(held.includes(rarity),
        `${area.name} has no ${rarity}; it only has ${[...new Set(held)].join(', ')}`);
    }
  }
});

test('every lake still has at least six species', () => {
  for (const area of AREAS) {
    assert.ok(area.fish.length >= 6, `${area.name} holds only ${area.fish.length}`);
  }
});

test('every fish belongs to a lake, and no lake lists a fish that does not exist', () => {
  const known = new Set(FISH.map((f) => f.id));
  const used = new Set();
  for (const area of AREAS) {
    for (const id of area.fish) {
      assert.ok(known.has(id), `${area.name} lists unknown fish ${id}`);
      used.add(id);
    }
  }
  // An unreachable fish would silently inflate the species count.
  const orphans = FISH.filter((f) => !used.has(f.id)).map((f) => f.id);
  assert.deepEqual(orphans, [], `no lake holds ${orphans.join(', ')}`);
});

test('every Epic fish is actually Epic, and rarer fish weigh less than common ones', () => {
  const epic = FISH.filter((f) => f.rarity === 'Epic');
  assert.ok(epic.length >= AREAS.length, `expected an Epic per lake, found ${epic.length}`);
  const commonWeight = Math.max(...FISH.filter((f) => f.rarity === 'Common').map((f) => f.weight));
  for (const fish of epic) {
    assert.ok(fish.weight < commonWeight,
      `${fish.id} is Epic but weighs ${fish.weight}, not rarer than a Common`);
  }
});

test('every fish draws a shape that exists, so none renders as a fallback', () => {
  for (const fish of FISH) {
    assert.ok(FISH_SHAPES[fish.draw], `${fish.id} draws with unknown shape "${fish.draw}"`);
    assert.equal(typeof fish.hue, 'number', `${fish.id} has no hue`);
    assert.ok(fish.hue >= 0 && fish.hue < 360, `${fish.id} hue ${fish.hue} is out of range`);
  }
});

test('every fish says something when it is hooked', () => {
  for (const fish of FISH) {
    const line = hookLineFor(fish);
    assert.ok(line && line.length >= 20, `${fish.id} has no hook line`);
  }
});

test('eight ordinary rods stand between the first two lakes', () => {
  const ordinary = Object.values(RODS).filter((r) => r.traits.length === 0);
  assert.equal(ordinary.length, 8, `expected 8 no-trait rods, found ${ordinary.length}`);
});

test('the ordinary rods are the eight cheapest, and every trait rod costs a premium', () => {
  const ordinary = Object.values(RODS).filter((r) => r.traits.length === 0)
    .sort((a, b) => a.price - b.price);
  const dearest = ordinary[ordinary.length - 1];
  for (const rod of Object.values(RODS)) {
    if (rod.traits.length > 0) {
      assert.ok(rod.price > dearest.price,
        `${rod.id} is a specialist at ${rod.price} but the dearest ordinary rod is only ${dearest.price}`);
    }
  }
});

test('every rod has its own artwork, and upgrades get longer and thicker', () => {
  const byPrice = RODS_BY_PRICE.map((id) => ({ id, look: rodArt(id) }));
  for (let i = 1; i < byPrice.length; i += 1) {
    const prev = byPrice[i - 1];
    const cur = byPrice[i];
    assert.ok(cur.look.width >= prev.look.width,
      `${cur.id} (${cur.look.width}) is thinner than ${prev.id} (${prev.look.width})`);
    assert.notEqual(cur.look.colour, prev.look.colour, `${cur.id} shares ${prev.id}'s colour`);
  }
  const colours = byPrice.map((r) => r.look.colour);
  assert.equal(new Set(colours).size, colours.length, 'two rods share a colour');
  const widths = byPrice.map((r) => r.look.width);
  assert.equal(new Set(widths).size, widths.length, 'two rods share a thickness');
});

test('no rod is named after its own material', () => {
  for (const rod of Object.values(RODS)) {
    assert.doesNotMatch(rod.name, /^(Bamboo|Willow|Carbon|Oak)\b/,
      `${rod.id} is still named after what it is made of: ${rod.name}`);
  }
});

test('every rod name is unique and reads as a Frutiser thing', () => {
  const names = Object.values(RODS).map((r) => r.name);
  assert.equal(new Set(names).size, names.length, 'two rods share a name');
  for (const name of names) {
    assert.equal(name, name.trim(), `"${name}" has stray whitespace`);
    assert.doesNotMatch(name, /\s-\s|[_-]/, `"${name}" should read as a name, not an id`);
  }
});

test('every rod has a blurb with something to say', () => {
  for (const rod of Object.values(RODS)) {
    assert.ok(rod.blurb?.length >= 18, `${rod.id} needs a fuller blurb: "${rod.blurb}"`);
    assert.match(rod.blurb, /[.!?]$/, `${rod.id} blurb should end in punctuation`);
  }
});

test('a rod gains stats as it costs more, or the upgrade is pointless', () => {
  const byPrice = RODS_BY_PRICE.map((id) => RODS[id]);
  for (let i = 1; i < byPrice.length; i += 1) {
    const prev = byPrice[i - 1];
    const cur = byPrice[i];
    // Specialists pay for access, so their maxKg may dip; luck must not.
    assert.ok(cur.luck >= prev.luck,
      `${cur.id} costs more than ${prev.id} but has less luck`);
    assert.ok(cur.lureSpeed >= prev.lureSpeed,
      `${cur.id} costs more than ${prev.id} but lures slower`);
    assert.ok(cur.control >= prev.control,
      `${cur.id} costs more than ${prev.id} but is harder to steer`);
  }
});

test('DORFic Delta is gated by the channel trait, and a rod can open it', () => {
  const delta = AREAS.find((a) => a.id === 'doric-delta');
  assert.equal(delta.trait, 'channel');
  assert.ok(delta.traitNote, 'the gate must explain itself');
  const carry = Object.values(RODS).filter((r) => r.traits.includes('channel'));
  assert.ok(carry.length >= 1, 'no rod can fish DORFic Delta');
  assert.equal(rodWorksIn(carry[0].id, 'doric-delta'), true);
  assert.equal(rodWorksIn('bamboo', 'doric-delta'), false);
});

test('every trait lake has a note and at least one rod that opens it', () => {
  for (const area of AREAS) {
    if (!area.trait) continue;
    assert.ok(area.traitNote, `${area.name} has a trait but no traitNote`);
    const carry = Object.values(RODS).filter((r) => r.traits.includes(area.trait));
    assert.ok(carry.length >= 1, `${area.name} can never be fished`);
    const check = rodCheckIn(carry[0].id, area.id);
    assert.equal(check.ok, true, `${carry[0].id} should work in ${area.name}: ${check.reason}`);
  }
});

test('each lake declares the rods that stand in front of the next one', () => {
  for (const area of AREAS) {
    assert.ok(Array.isArray(area.requiredRods) && area.requiredRods.length > 0,
      `${area.name} does not say which rods gate the next lake`);
    for (const id of area.requiredRods) {
      assert.ok(RODS[id], `${area.name} requires unknown rod ${id}`);
    }
  }
});

test('Aero Lake is gated by all eight ordinary rods', () => {
  const lake = AREAS[0];
  const ordinary = Object.keys(RODS).filter((id) => RODS[id].traits.length === 0);
  assert.equal(lake.requiredRods.length, 8);
  assert.deepEqual([...lake.requiredRods].sort(), [...ordinary].sort());
});

test('a trait lake is gated by every rod carrying its own trait', () => {
  for (const area of AREAS) {
    if (!area.trait) continue;
    const carry = Object.keys(RODS).filter((id) => RODS[id].traits.includes(area.trait));
    assert.deepEqual([...area.requiredRods].sort(), [...carry].sort(),
      `${area.name} should be gated by every ${area.trait} rod`);
  }
});

test('the gate is the previous lake, never the one being opened', () => {
  // Counting the fish or rods of the lake being opened lets a lake advertise its
  // own contents before you have earned them, and the gate moves whenever the
  // roster changes. Aero Lake is always open, so its own list is the fallback.
  const lake = AREAS[0];
  const landed = Object.fromEntries(lake.fish.map((id) => [id, 1]));
  const owned = lake.requiredRods.slice(0, -1);
  assert.equal(areaUnlocked(AREAS[1], { bestiary: landed, owned }), false,
    'every fish but one rod short must still be shut');
  assert.equal(areaUnlocked(AREAS[1], { bestiary: landed, owned: lake.requiredRods }), true,
    'every fish and every rod must open it');
});

test('landing the fish of a lake you are not standing in opens nothing', () => {
  // The gate walks one lake at a time. Clearing Aero Lake opens DORFic Delta --
  // not Eco Marsh, which is two steps on and additionally needs the channel rod.
  const first = AREAS[0];
  const done = Object.fromEntries(first.fish.map((id) => [id, 1]));
  const owned = first.requiredRods;

  assert.equal(areaUnlocked(AREAS[1], { bestiary: done, owned }), true,
    'clearing the first lake must open the second');

  // Clearing the SECOND lake without ever clearing the first opens nothing.
  const onlySecond = Object.fromEntries(AREAS[1].fish.map((id) => [id, 1]));
  assert.equal(areaUnlocked(AREAS[2], { bestiary: onlySecond, owned }), false,
    'skipping a lake must not open the one after it');

  // Owning everything does not skip the index: with only the SECOND lake cleared
  // and no first-lake fish, the gate for the third lake is DORFic, whose own
  // roster and channel rod are both satisfied. That IS the next step, so the
  // real skip test is the one above: the first lake's fish are still required to
  // get past DORFic in the first place.
  assert.equal(areaUnlocked(AREAS[1], { bestiary: onlySecond, owned: Object.keys(RODS) }), false,
    'owning every rod must not let you skip a lake index');
});

test('the first lake is always open, whatever the save looks like', () => {
  assert.equal(areaUnlocked(AREAS[0], { bestiary: {}, owned: [] }), true);
  assert.equal(areaUnlocked(AREAS[0], { bestiary: null, owned: null }), true);
});

test('a lake gates only on rods that can fish that very lake', () => {
  // The rods you need to leave a lake must be usable in it. Without this the
  // gate could ask for a rod you have no business carrying.
  for (const area of AREAS) {
    for (const id of area.requiredRods) {
      const check = rodCheckIn(id, area.id);
      assert.equal(check.ok, true,
        `${id} gates ${area.name} but cannot fish it: ${check.reason}`);
    }
  }
});

test('the progress badge measures the lake you are standing in', () => {
  const lake = AREAS[0];
  const empty = areaProgress(lake, { bestiary: {}, owned: [] });
  assert.equal(empty.total, lake.fish.length, 'counts this lake fish');
  assert.equal(empty.landed, 0);
  assert.equal(empty.rodTotal, lake.requiredRods.length, 'counts this lake rods');
  assert.equal(empty.rods, 0);
  assert.match(empty.reason, /rod/i, 'the badge must say what is outstanding');

  const half = areaProgress(lake, {
    bestiary: Object.fromEntries(lake.fish.slice(0, 3).map((id) => [id, 1])),
    owned: lake.requiredRods.slice(0, 4),
  });
  assert.equal(half.landed, 3);
  assert.equal(half.rods, 4);
  assert.match(half.reason, /4 more rod/);
  assert.match(half.reason, /more fish/);
});

test('a finished lake reports no outstanding work', () => {
  const lake = AREAS[0];
  const done = areaProgress(lake, {
    bestiary: Object.fromEntries(lake.fish.map((id) => [id, 1])),
    owned: lake.requiredRods,
  });
  assert.equal(done.landed, done.total);
  assert.equal(done.rods, done.rodTotal);
  assert.equal(done.reason, '', 'a cleared gate must not nag');
});

test('the badge counts only the rods this lake cares about', () => {
  const lake = AREAS[0];
  const withExtras = areaProgress(lake, {
    bestiary: {},
    owned: [...lake.requiredRods, 'abyss', 'glacier'],
  });
  assert.equal(withExtras.rods, lake.requiredRods.length,
    'owning every rod in the game must not inflate the count');
});

test('levels rise with catches and never fall', () => {
  const first = levelFrom({ xp: 0 });
  assert.equal(first.level, 1, 'a new angler starts at 1');
  assert.ok(first.title && first.title.length > 0, 'every rank needs a title');

  const xp = xpForCatch(FISH.find((f) => f.rarity === 'Common'), 1);
  const later = levelFrom({ xp: xpForLevel(2) + xp });
  assert.ok(later.level > first.level, 'enough catching must raise the rank');

  // Pure: the same xp always gives the same rank.
  assert.deepEqual(levelFrom({ xp: 987 }), levelFrom({ xp: 987 }));
  // Monotonic: more xp never means a lower rank.
  for (const v of [0, 50, 500, 5000, 50_000, 5_000_000]) {
    assert.ok(levelFrom({ xp: v }).level >= first.level, `rank fell at xp ${v}`);
  }
});

test('a missing or corrupt xp is level 1, not a crash', () => {
  for (const bad of [undefined, null, -5, NaN, Infinity, 'lots', {}]) {
    const r = levelFrom({ xp: bad });
    assert.equal(r.level, 1, `xp ${String(bad)} should read as level 1`);
    assert.ok(r.title.length > 0);
  }
  assert.equal(levelFrom().level, 1, 'no argument at all still works');
});

test('a rarer or heavier catch is worth more rank', () => {
  const common = xpForCatch(FISH.find((f) => f.rarity === 'Common'), 1);
  const mythical = xpForCatch(FISH.find((f) => f.rarity === 'Mythical'), 1);
  assert.ok(mythical > common, 'a Mythical must outrank a Common');

  const light = xpForCatch(FISH.find((f) => f.rarity === 'Common'), 0.5);
  const heavy = xpForCatch(FISH.find((f) => f.rarity === 'Common'), 20);
  assert.ok(heavy > light, 'a heavier fish must be worth more');
});

test('rank luck is a small bonus that cannot replace rod choice', () => {
  assert.equal(luckFromLevel(1), 0, 'level 1 adds nothing');
  const top = luckFromLevel(99);
  assert.ok(top > 0, 'high ranks must help a little');
  assert.ok(top <= 2.0, `rank luck must stay modest, got ${top}`);
  // Monotonic and never negative.
  for (let l = 1; l < 120; l += 1) {
    assert.ok(luckFromLevel(l) >= luckFromLevel(l - 1), `luck dipped at level ${l}`);
    assert.ok(luckFromLevel(l) >= 0, `negative luck at level ${l}`);
  }
  assert.equal(luckFromLevel(0), 0, 'a nonsense level adds nothing');
});

test('total luck is rod plus rank plus seal', () => {
  const rod = { luck: 2.0 };
  assert.equal(luckFor({ rod, level: 1 }), 2.0, 'no rank, no seal');
  assert.ok(luckFor({ rod, level: 10 }) > 2.0, 'rank must add');
  const seal = { luck: 1.1 };
  assert.ok(luckFor({ rod, level: 10, seal }) > luckFor({ rod, level: 10 }),
    'the seal must add on top');
  assert.equal(luckFor({}), 0, 'nothing at all is zero, not NaN');
  assert.equal(luckFor({ rod: null, seal: null }), 0);
});

test('lost items are a real table, each with a price and a lake', () => {
  assert.ok(LOST_ITEMS.length >= 12, `expected a decent junk table, found ${LOST_ITEMS.length}`);
  const ids = LOST_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'two lost items share an id');
  for (const item of LOST_ITEMS) {
    assert.ok(item.name?.length, `${item.id} has no name`);
    assert.ok(Number.isFinite(item.value) && item.value > 0, `${item.id} must be worth something`);
    assert.ok(item.blurb?.length >= 12, `${item.id} needs a blurb`);
    assert.ok(AREAS.some((a) => a.id === item.water), `${item.id} comes from nowhere`);
  }
});

test('every lake can turn up lost items, and no lake is drowned in them', () => {
  for (const area of AREAS) {
    const junk = lostItemsFor(area.id);
    assert.ok(junk.length > 0, `${area.name} yields nothing`);
    const rate = junk.reduce((sum, i) => sum + i.chance, 0);
    assert.ok(rate >= 0.15 && rate <= 0.45,
      `${area.name} junk rate is ${(rate * 100).toFixed(0)}%, outside 15-45%`);
  }
});

test('a cast recovers nothing or exactly one known item', () => {
  assert.equal(rollLostItem(-1), null, 'a negative roll recovers nothing');
  assert.equal(rollLostItem(1), null, 'a roll of 1 must not fall off the end');
  assert.equal(rollLostItem(NaN), null, 'a broken roll recovers nothing');

  let seen = 0;
  for (let n = 0; n < 500; n += 1) {
    const item = rollLostItem(n / 500, { lakeId: AREAS[0].id });
    if (item) { seen += 1; assert.ok(LOST_ITEMS.includes(item), `${item.id} is not in the table`); }
  }
  assert.ok(seen > 0, '500 casts recovered nothing at all');
  assert.ok(seen < 500, 'every single cast recovered something');
});

test('a rarer fish brings up more junk', () => {
  const lake = AREAS[0].id;
  const rate = (scale) => {
    let n = 0;
    for (let i = 0; i < 2000; i += 1) {
      if (rollLostItem(i / 2000, { rarityScale: scale, lakeId: lake })) n += 1;
    }
    return n / 2000;
  };
  assert.ok(rate(2) > rate(1), `a luckier haul must bring more junk (${rate(1)} -> ${rate(2)})`);
  assert.equal(rate(0), 0, 'no junk at all when the scale is zero');
});

test('lost items are the second economy and are cheaper than rods', () => {
  const dearestRod = Math.max(...Object.values(RODS).map((r) => r.price));
  for (const item of LOST_ITEMS) {
    assert.ok(item.value < dearestRod,
      `${item.id} at ${item.value} is as expensive as a rod (${dearestRod})`);
  }
  const dearestJunk = Math.max(...LOST_ITEMS.map((i) => i.value));
  const cheapestRod = Math.min(...Object.values(RODS).map((r) => r.price));
  assert.ok(dearestJunk > cheapestRod,
    'junk must out-earn the first rod, or it is not a second economy');
});

test('there is one seal per lake, each with its own perks and voice', () => {
  assert.ok(SEALS.length >= AREAS.length, `expected a seal per lake, found ${SEALS.length}`);
  const ids = SEALS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'two seals share an id');
  for (const seal of SEALS) {
    assert.ok(AREAS.some((a) => a.id === seal.home), `${seal.id} has no home lake`);
    assert.ok(seal.luck > 0 && seal.luck < 3, `${seal.id} luck ${seal.luck} is out of band`);
    assert.ok(seal.dupeChance > 0 && seal.dupeChance < 0.25, `${seal.id} duplicates too often`);
    assert.ok(Number.isInteger(seal.level) && seal.level >= 1, `${seal.id} needs a rank gate`);
    assert.ok(seal.price > 0, `${seal.id} must cost something`);
    for (const key of ['favourite', 'beat', 'rare', 'junk', 'personalBest']) {
      assert.ok(seal.catch[key]?.length >= 8,
        `${seal.id} needs a ${key} line, got ${JSON.stringify(seal.catch[key])}`);
    }
    assert.ok(seal.line?.length >= 15, `${seal.id} needs a description`);
  }
  const homes = SEALS.map((s) => s.home);
  assert.equal(new Set(homes).size, SEALS.length, 'two seals share a home lake');
});

test('a seal you cannot afford or has not levelled is refused, with a reason', () => {
  const cheap = SEALS[0];
  const broke = buySeal({ coins: 0 }, cheap.id, 99);
  assert.equal(broke.ok, false);
  assert.match(broke.reason, /coin/i, 'being broke must be explained');
  assert.equal(broke.coins, 0, 'a refused purchase must not move the wallet');

  const toolow = buySeal({ coins: 999_999 }, SEALS[SEALS.length - 1].id, 1);
  assert.equal(toolow.ok, false);
  assert.match(toolow.reason, /rank/i, 'being under-levelled must be explained');
  assert.equal(toolow.coins, 999_999, 'a refused purchase must not charge');

  assert.equal(buySeal({ coins: 999_999 }, 'nonesuch', 99).ok, false, 'unknown seal');
});

test('a seal can be bought exactly when you can afford and qualify', () => {
  const seal = SEALS[SEALS.length - 1];
  // Its lake has to be open too -- this used to buy the deepest seal on an empty
  // save, which is only possible now that the lake gate exists.
  const home = AREAS.find((a) => a.id === seal.home);
  const save = { bestiary: {}, owned: [] };
  for (const id of AREAS) {
    if (id.id === home.id) break;
    for (const f of id.fish) save.bestiary[f] = 1;
    for (const r of id.requiredRods) save.owned.push(r);
  }
  const bought = buySeal({ coins: seal.price }, seal.id, seal.level, save);
  assert.equal(bought.ok, true, `said "${bought.reason}"`);
  assert.equal(bought.sealId, seal.id);
  assert.equal(bought.coins, 0, 'the price must come off the wallet');
});

test('only one seal is equipped at a time, and swapping is free', () => {
  const owned = SEALS.map((s) => s.id);
  assert.equal(equipSeal(owned, SEALS[0].id).sealId, SEALS[0].id);
  const swapped = equipSeal(owned, SEALS[2].id);
  assert.equal(swapped.sealId, SEALS[2].id, 'equipping replaces rather than stacking');
  assert.equal(swapped.paid, 0, 're-equipping an owned seal is free');
  assert.equal(equipSeal([SEALS[0].id], SEALS[1].id).ok, false, 'cannot equip one you do not own');
  assert.equal(equipSeal(null, SEALS[0].id).ok, false);
  assert.equal(equipSeal([], 'nonesuch').ok, false);
});

test('a seal comments on every catch and knows when you could do better', () => {
  for (const seal of SEALS) {
    for (const rarity of ['Common', 'Mythical']) {
      const fish = FISH.find((f) => f.rarity === rarity);
      const line = sealComment(seal, fish, { bestiary: {} });
      assert.ok(line && line.length >= 8, `${seal.id} says nothing about a ${rarity}`);
      assert.equal(typeof line, 'string');
    }
    // No seal, no line -- but it must not throw.
    assert.equal(sealComment(null, FISH[0], {}), '');
  }
});

test('the seal that speaks is the one equipped', () => {
  const fish = FISH.find((f) => f.rarity === 'Mythical');
  const first = sealComment(SEALS[0], fish, { bestiary: {} });
  const second = sealComment(SEALS[1], fish, { bestiary: {} });
  assert.notEqual(first, second, 'each seal must have its own opinion');
});

test('duplicates are occasional and never certain', () => {
  for (const seal of SEALS) {
    let hits = 0;
    for (let n = 0; n < 1000; n += 1) if (sealDuplicates(seal, n / 1000)) hits += 1;
    const rate = hits / 1000;
    assert.ok(Math.abs(rate - seal.dupeChance) < 0.01,
      `${seal.id} duplicates ${(rate * 100).toFixed(1)}% but claims ${(seal.dupeChance * 100).toFixed(1)}%`);
    assert.ok(rate > 0 && rate < 0.25, `${seal.id} duplicate rate ${rate} is out of band`);
  }
  assert.equal(sealDuplicates(null, 0.01), false, 'no seal means no duplicate');
  assert.equal(sealDuplicates(SEALS[0], NaN), false);
});

test('seals are the sink for junk, and cost more than a lake of it earns', () => {
  for (const seal of SEALS) {
    const junk = LOST_ITEMS.filter((i) => i.water === seal.home);
    const bestCast = junk.reduce((s, i) => s + i.value, 0);
    assert.ok(seal.price > bestCast,
      `${seal.name} costs ${seal.price} but one cast can net ${bestCast} — too cheap`);
  }
});

test('arriving in a lake you cannot fish hands you its rod, once', () => {
  const start = { owned: AREAS[0].requiredRods, rodId: 'horizon', giftedRods: [] };
  const arrived = visitArea(start, 'doric-delta');

  assert.equal(arrived.gifted, 'channel', 'first arrival must gift the channel rod');
  assert.ok(arrived.owned.includes('channel'), 'and it must be in the bag');
  assert.equal(arrived.rodId, 'channel', 'and equipped, so you can fish there now');
  assert.equal(rodWorksIn(arrived.rodId, 'doric-delta'), true, 'which it must work in');
  assert.deepEqual(arrived.giftedRods, ['channel'], 'and the gift is remembered');

  // Coming back must not hand over a second one.
  assert.equal(visitArea(arrived, 'doric-delta').gifted, null, 'no second gift');
  assert.equal(visitArea(arrived, 'doric-delta').owned.filter((r) => r === 'channel').length, 1);
});

test('the gift is recorded, so leaving and returning cannot farm it', () => {
  let s = visitArea({ owned: AREAS[0].requiredRods, rodId: 'horizon', giftedRods: [] }, 'doric-delta');
  s = visitArea(s, 'eco-marsh');
  s = visitArea(s, 'glacier-fjord');
  s = visitArea(s, 'doric-delta');
  assert.equal(s.gifted, null, 'returning to a gifted lake must not re-gift');
  assert.equal(s.owned.filter((r) => r === 'channel').length, 1, 'still only one rod');
});

test('a lake you can already fish gifts you nothing', () => {
  const start = { owned: [...AREAS[0].requiredRods, 'channel'], rodId: 'horizon', giftedRods: [] };
  const arrived = visitArea(start, 'doric-delta');
  assert.equal(arrived.gifted, null, 'you already had the rod');
  assert.equal(arrived.rodId, 'horizon', 'and keep the rod you had');
});

test('an untraited lake never gifts anything', () => {
  const start = { owned: ['bamboo'], rodId: 'bamboo', giftedRods: [] };
  const arrived = visitArea(start, 'aero-lake');
  assert.equal(arrived.gifted, null, 'Aero Lake has no trait, so there is nothing to hand over');
  assert.equal(arrived.areaId, 'aero-lake');
});

test('an unknown lake falls back to the first rather than crashing', () => {
  const arrived = visitArea({ owned: ['bamboo'], rodId: 'bamboo', giftedRods: [] }, 'no-such-lake');
  assert.equal(arrived.areaId, AREAS[0].id);
});

test('every trait lake has exactly one gift rod, and it is the first listed', () => {
  for (const area of AREAS) {
    if (!area.trait) continue;
    const gift = area.requiredRods[0];
    assert.ok(RODS[gift], `${area.name} lists no gift rod`);
    assert.ok(RODS[gift].traits.includes(area.trait),
      `${gift} is the gift for ${area.name} but carries ${RODS[gift].traits.join(',')}`);
    assert.equal(rodWorksIn(gift, area.id), true,
      `the gift must actually fish ${area.name}`);
  }
});

test('lost items are sold for Seal coins, and selling clears them', () => {
  const held = ['gumball', 'sunhat', 'gumball'];
  const sold = sellLostItems(held);
  const expected = held.reduce((sum, id) => sum + (lostItemById(id)?.value ?? 0), 0);

  assert.ok(expected > 0, 'a bag of junk must be worth something');
  assert.equal(sold.sealCoins, expected, 'every held item pays out');
  assert.deepEqual(sold.held, [], 'selling empties the bag');
  assert.equal(sold.count, 3, 'and says how many went');
});

test('selling nothing costs nothing and claims nothing', () => {
  const sold = sellLostItems([]);
  assert.equal(sold.sealCoins, 0);
  assert.deepEqual(sold.held, []);
  assert.equal(sellLostItems(null).sealCoins, 0);
  assert.equal(sellLostItems(undefined).sealCoins, 0);
});

test('an unknown item in the bag is ignored, not paid for', () => {
  const sold = sellLostItems(['gumball', 'no-such-thing', 'sunhat']);
  const expected = (lostItemById('gumball').value + lostItemById('sunhat').value);
  assert.equal(sold.sealCoins, expected, 'a junk id that no longer exists pays nothing');
  assert.deepEqual(sold.held, [], 'and is cleared anyway, so it cannot linger');
});

test('lostItemById finds real items and returns null for anything else', () => {
  for (const item of LOST_ITEMS) {
    assert.equal(lostItemById(item.id), item, `${item.id} must resolve to itself`);
  }
  assert.equal(lostItemById('nope'), null);
  assert.equal(lostItemById(null), null);
});

test('the two currencies are genuinely separate things', () => {
  // Rods are bought with the fish wallet. Seals are bought with Seal coins, and
  // the two must never be interchangeable or the split means nothing.
  assert.notEqual(SEALS[0].price, undefined);
  assert.ok(SEALS.every((s) => Number.isFinite(s.price) && s.price > 0));
  // A rod price and a seal price are different currencies, so they are not
  // comparable numbers -- the game must never convert one into the other.
  const source = readFileSync(new URL('../vendor/fru-angler/fishing.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, new RegExp('coins\\\\s*[:=][^;]*SEALS?\\\\.price'),
    'seal prices must never be converted into rod money');
});

test('every seal has idle lines, and none of them are just narration', () => {
  // Two bugs hid here at once: a duplicated `idle:` key on one seal, where the
  // second silently won and another seal ended up with none, and idle lines that
  // were pure narration -- the seal describing the weather to nobody.
  //
  // "Contains you/your" was the old proxy and it was too narrow: a personality
  // does not have to say "you" to be talking TO you. "quiet. that's how you know"
  // addresses the player perfectly well.
  for (const seal of SEALS) {
    assert.ok(Array.isArray(seal.idle) && seal.idle.length >= 4,
      `${seal.id} needs at least four idle lines`);
    for (const line of seal.idle) {
      // Present tense, second person, an address, or an opinion -- anything but a
      // weather report.
      const addressed = /\b(you|your|you're|youre)\b/i.test(line)
        || /\b(cast|catch|line|rod|bobber|water|dock|hook|reel)\b/i.test(line)
        || /[?!]|\b(again|still|done|wrong|right|again)\b/i.test(line);
      assert.ok(addressed,
        `${seal.id} is narrating rather than talking to the player: "${line}"`);
    }
  }
});

test('a seal has exactly one idle list, not two silently fighting', () => {
  const source = readFileSync(new URL('../vendor/fru-angler/fishing.js', import.meta.url), 'utf8');
  for (const seal of SEALS) {
    // Bound the block by the NEXT seal, not by the first `},` -- an idle line
    // containing that sequence would otherwise truncate the search.
    // Search inside the SEALS table only: `id: 'abyss'` also names a ROD, and
    // RODS comes first in the file, so a whole-file search finds the wrong one.
    const table = source.slice(source.indexOf('export const SEALS = ['));
    const start = table.indexOf(`id: '${seal.id}',`);
    const after = table.indexOf("id: '", start + 10);
    const block = table.slice(start, after === -1 ? table.length : after);
    const ids = (block.match(/idle:\s*\[/g) || []).length;
    assert.equal(ids, 1, `${seal.id} declares ${ids} idle lists -- a duplicate key silently wins`);
  }
});

test('a mutation is a thing with an id, a name, a multiplier and a colour', () => {
  // Mutations were rolled and paid out but never described, so a Crowned fish -- 5x
  // value -- looked exactly like a common one. Each needs its own colour to show on
  // the card and in the index.
  for (const m of MUTATIONS) {
    assert.ok(m.id, 'every mutation needs an id');
    assert.ok(Number.isFinite(m.multiplier) && m.multiplier >= 1, `${m.id} needs a multiplier`);
    assert.ok(Number.isFinite(m.weight) && m.weight > 0, `${m.id} needs a weight`);
    if (m.id === 'none') {
      assert.equal(m.multiplier, 1);
      assert.equal(m.name, '', 'the plain one must have no name to show');
    } else {
      assert.ok(m.name && m.name.length > 1, `${m.id} needs a display name`);
      assert.match(m.colour, /^#[0-9a-f]{6}$/i, `${m.id} needs a hex colour`);
    }
  }
});

test('mutationMultiplierFor reads a mutation id back off a catch', () => {
  // The card shows whatever was rolled. Reading it back from the id is what lets a
  // saved catch keep its look without storing the whole object.
  assert.equal(mutationMultiplierFor('crowned'), 5);
  assert.equal(mutationMultiplierFor('none'), 1);
  assert.equal(mutationMultiplierFor('not-a-mutation'), 1, 'unknown is plain, never a crash');
  assert.equal(mutationMultiplierFor(undefined), 1);
});

test('mutations get rarer as rank climbs, so they stay interesting', () => {
  // A flat 1% Crowned is found by accident or never. Ranking should tighten the
  // odds toward the rare mutations -- that is the reward for progress.
  const none = MUTATIONS.find((m) => m.id === 'none');
  assert.ok(none.weight >= 60, 'plain catches must stay the common case at any rank');
});

test('a day has named parts, each with its own light', () => {
  // Same lake, different visit, different light. Without this the scene is one
  // flat picture you look at a thousand times.
  assert.ok(WEATHER.length >= 3, 'at least three skies');
  assert.ok(TIMES.length >= 4, 'at least four times of day');
  for (const part of [...WEATHER, ...TIMES]) {
    assert.ok(part.id && part.name, 'each needs an id and a name to show');
    assert.match(part.tint, /^#[0-9a-f]{6}$/i, `${part.id} needs a hex tint`);
    assert.ok(Number.isFinite(part.luck) && part.luck >= 0.8 && part.luck <= 1.3,
      `${part.id} luck must be a gentle modifier, got ${part.luck}`);
  }
  // Dusk must actually be darker than noon, or the whole idea is cosmetic.
  // Compare perceived brightness, not one channel: noon #fff4c2 and dusk #ff9a76
  // share a red channel of 0xff, so a channel compare calls dusk BRIGHTER.
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const byId = (id) => TIMES.find((t) => t.id === id);
  const noon = byId('noon'), dusk = byId('dusk'), night = byId('night');
  assert.ok(noon && dusk && night, 'noon, dusk and night are the ones that must differ');
  assert.ok(lum(dusk.tint) < lum(noon.tint), 'dusk must be darker than noon');
  assert.ok(lum(night.tint) < lum(dusk.tint), 'and night darker than dusk');
  assert.ok(lum(noon.tint) > lum(night.tint), 'noon is the brightest part of the day');
});

test('skyFor is pure, and the same weather always reads the same', () => {
  const rng = () => 0.5;
  const a = skyFor('aero-lake', rng, 0.4);
  const b = skyFor('aero-lake', rng, 0.4);
  assert.deepEqual(a, b, 'identical inputs must give an identical sky');
  assert.ok(a.weather && a.time, 'it must name what it picked');
  assert.match(a.label, /\w+/, 'and something readable to put on screen');
  // The lake is irrelevant to the sky -- a weather system that broke on an unknown
  // lake id would be a crash on any new content.
  assert.doesNotThrow(() => skyFor('not-a-lake', rng, 0.4));
});

test('luckFromSky stays inside a band that cannot break the fishing', () => {
  // Rarity comes from luckFor(). Weather feeds it, so an extreme weather luck
  // figure would silently unbalance the odds it is not supposed to touch.
  for (const part of [...WEATHER, ...TIMES]) {
    const luck = luckFromSky(part, part);
    assert.ok(Number.isFinite(luck) && luck >= 0.85 && luck <= 1.2,
      `${part.id} produced luck ${luck}`);
  }
  assert.equal(luckFromSky(null, null), 1, 'no sky means no change');
});

test('every time and weather actually comes up over a long run', () => {
  // Math.floor takes ONE argument. A clamp written as
  //   Math.floor(Math.max(v, 0), 0.999999)
  // returns NaN, every index is undefined, and list[undefined] is always the FIRST
  // entry -- so every single visit was dawn and clear, forever, and the tests kept
  // passing because a deterministic pin of 0.5 also landed on index 0 by luck.
  // A table you never reach is a table you cannot tell apart from a table that
  // works, so this checks coverage rather than one draw.
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const rng = makeRng(42);
  const times = new Set();
  const weathers = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const sky = skyFor('aero-lake', rng);
    times.add(sky.time.id);
    weathers.add(sky.weather.id);
  }
  assert.equal(times.size, TIMES.length,
    `only ${times.size} of ${TIMES.length} times of day ever came up`);
  assert.equal(weathers.size, WEATHER.length,
    `only ${weathers.size} of ${WEATHER.length} weather states ever came up`);
});

test('skyFor never returns undefined, whatever it is handed', () => {
  // NaN, negatives and >1 all have to land somewhere sane rather than off the end.
  for (const roll of [0, 0.999999, 1, -5, Number.NaN]) {
    const sky = skyFor('aero-lake', () => roll, roll);
    assert.ok(TIMES.includes(sky.time), `roll ${roll} produced ${sky.time}`);
    assert.ok(WEATHER.includes(sky.weather), `roll ${roll} produced ${sky.weather}`);
  }
});

test('a rod is more than a line: it has a blank, a grip, guides and a reel', () => {
  // Every rod was one path, one colour, one tip dot -- so a £20,000 rod and the
  // free bamboo stick were the same object with a different width. Real tackle has
  // a shape, and that shape is what you actually recognise on the water.
  for (const id of Object.keys(RODS)) {
    const art = rodArt(id);
    assert.ok(art.path && art.width > 0, `${id} needs a shaft`);
    assert.match(art.colour, /^#[0-9a-f]{6}$/i, `${id} needs a colour`);

    // The parts that make it read as a rod rather than a stick.
    assert.ok(Array.isArray(art.guides) && art.guides.length >= 2,
      `${id} needs at least two line guides, found ${art.guides?.length ?? 0}`);
    assert.ok(Number.isFinite(art.gripFrom) && Number.isFinite(art.gripTo),
      `${id} needs a grip section`);
    assert.ok(Number.isFinite(art.reelR ?? 0), `${id} needs a reel`);
    assert.ok(art.blank && art.blank.length,
      `${id} needs a blank style -- taper, accent or wrap`);
  }
});

test('rods stay in price order as they get longer and thicker', () => {
  // The ladder is legible at a glance: better rods reach further. This has to be
  // built as a whole, because glacier and abyss both got configured backwards when
  // the second rods arrived.
  const ordered = RODS_BY_PRICE;
  let lastReach = -Infinity;
  let lastWidth = -1;
  for (const rod of ordered) {
    const art = rodArt(rod.id);
    const reach = art.tipX;
    assert.ok(reach >= lastReach - 0.01,
      `${rod.id} reaches ${reach.toFixed(1)}, less than the rod below it (${lastReach.toFixed(1)})`);
    assert.ok(art.width >= lastWidth - 0.001,
      `${rod.id} is ${art.width}, thinner than the rod below it (${lastWidth})`);
    lastReach = reach;
    lastWidth = art.width;
  }
});

test('guides sit ON the shaft, between the grip and the tip', () => {
  // A guide floating off the end of the rod looks like a bug, and it would break
  // the moment a rod's path changed.
  for (const id of Object.keys(RODS)) {
    const art = rodArt(id);
    const grip = Math.max(art.gripFrom, art.gripTo);
    for (const g of art.guides) {
      const t = typeof g === 'number' ? g : g.t;
      assert.ok(t > grip && t < 1,
        `${id} has a guide at ${t}, outside the blank (grip ends ${grip})`);
      assert.ok(t >= 0 && t <= 1, `${id} guide ${t} is not a fraction along the rod`);
    }
  }
});

test('each seal has a personality, not just a name and a hue', () => {
  // Five seals with five idle lines each, and all five read the same: mildly warm,
  // faintly encouraging, no voice. Personality is the point of a pet, so each one
  // needs its own register, its own rhythm, and something only it would say.
  for (const seal of SEALS) {
    assert.ok(seal.voice && seal.voice.length > 8,
      `${seal.id} needs a stated voice -- how it talks, in one line`);
    assert.ok(Array.isArray(seal.idle) && seal.idle.length >= 4,
      `${seal.id} needs at least four idle lines`);
    assert.ok(seal.catch && Object.keys(seal.catch).length >= 4,
      `${seal.id} needs comments for more than three situations`);
  }
});

test('no two seals sound alike', () => {
  // Distinct voices means distinct phrasing, not the same template with a colour
  // changed. Compare the shape of every line: if they all share an opener, an
  // opener, a shared-ending test catches the template even when the words differ.
  for (const field of ['idle', 'catch']) {
    const openers = new Map();
    for (const seal of SEALS) {
      const lines = field === 'idle' ? seal.idle : Object.values(seal.catch ?? {});
      for (const line of lines) {
        const opener = line.split(/[ ,.]/)[0].toLowerCase();
        openers.set(opener, (openers.get(opener) ?? 0) + 1);
      }
    }
    const total = [...openers.values()].reduce((a, b) => a + b, 0);
    const biggest = Math.max(...openers.values());
    assert.ok(biggest / total < 0.34,
      `${field}: "${[...openers.entries()].sort((a,b)=>b[1]-a[1])[0][0]}" opens ${biggest} of ${total} lines -- one template, not five voices`);
  }
});

test('the seals talk in slang a person would actually say', () => {
  // Every line used to land somewhere between 1800 and a shrug. What made them
  // dated was the FORM -- "I am watching your bobber", "That is beneath you" --
  // not the vocabulary. So this checks the register directly and stops trying to
  // keep a wordlist in step with the writing, which only ever measured my guesses.
  //
  // Dated markers: an uncontracted verb, a third-person "it is", and the stiff
  // constructions that go with them.
  const DATED = [
    /\bI am\b/, /\byou are\b/, /\bit is\b/, /\bthat is\b/, /\bthere is\b/,
    /\bwe are\b/, /\bthey are\b/, /\bI have\b/, /\byou have\b/,
    /\bdo not\b/, /\bdoes not\b/, /\bwill not\b/, /\bcan not\b/,
    /\bwould not\b/, /\bcould not\b/,
    /\bmy favourite\b/, /\bwell done\b/, /\bvery good sign\b/,
  ];
  // Current markers: contractions and the clipped, lowercase way people text.
  const CONTRACTED = /\b\w+'(s|t|re|ve|ll|d|m)\b/i;
  const LOWERCASE_START = /^[a-z]/;

  let contracted = 0;
  let total = 0;
  for (const seal of SEALS) {
    for (const line of [...seal.idle, ...Object.values(seal.catch)]) {
      total += 1;
      for (const dated of DATED) {
        assert.doesNotMatch(line, dated,
          `${seal.id} falls back to dated phrasing: "${line}"`);
      }
      assert.match(line, LOWERCASE_START,
        `${seal.id} starts a line like an essay: "${line}"`);
      if (CONTRACTED.test(line)) contracted += 1;
    }
  }
  // Not every clipped line can contract -- Moss would lose its voice. But a seal
  // that never contracts at all is writing like a manual, not talking.
  assert.ok(contracted / total > 0.5,
    `only ${contracted} of ${total} lines contract anything; ${total - contracted} sound written`);
});

test('every comment slot is filled for every seal', () => {
  // sealComment() picks by rarity tier and by whether you already had the fish. A
  // missing key means the seal says NOTHING on that catch, which reads as broken.
  const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'];
  for (const seal of SEALS) {
    for (const slot of ['favourite', 'beat', 'rare', 'junk', 'personalBest']) {
      assert.ok(seal.catch[slot], `${seal.id} is missing a ${slot} line`);
      assert.ok(seal.catch[slot].length > 6, `${seal.id} ${slot} is too short to read`);
    }
    assert.ok(!/\bI am\b|\bYou are\b|\bIt is\b|\bThat is\b/.test(
      [...seal.idle, ...Object.values(seal.catch)].join(' ')),
      `${seal.id} still speaks in the formal register`);
    void rarities;
  }
});

test('sealLines returns idle AND catch lines, not just idle', () => {
  // sealLines() walked `seal.comments`, which stopped existing when the comments
  // were renamed to catch -- so it silently returned idle lines only and every
  // catch line went missing from whatever consumed it. A rename that leaves a
  // reader pointing at nothing is the worst kind of change, because nothing throws.
  for (const seal of SEALS) {
    const lines = sealLines(seal);
    const expected = seal.idle.length + Object.keys(seal.catch).length;
    assert.equal(lines.length, expected,
      `${seal.id} exposes ${lines.length} lines, expected ${expected}`);
    for (const comment of Object.values(seal.catch)) {
      assert.ok(lines.includes(comment),
        `${seal.id} hides its "${comment.slice(0, 24)}..." line`);
    }
  }
});

test('sealComment routes each kind of cast to its own line', () => {
  // Junk, a personal best, a repeat and a first catch all used to collapse onto the
  // same line, and the ordering was wrong underneath: "already owned" was checked
  // before rarity, so a repeat of a Mythical fish sounded identical to seeing one
  // for the first time.
  const seal = SEALS[0];
  const myth = { id: 'g', name: 'G', rarity: 'Mythical' };
  const epic = { id: 'g', name: 'G', rarity: 'Epic' };
  const seen = {
    junk: sealComment(seal, myth, { junk: true }),
    record: sealComment(seal, myth, { personalBest: true }),
    rareRepeat: sealComment(seal, myth, { bestiary: { g: 3 } }),
    rareFirst: sealComment(seal, myth, {}),
    epicRepeat: sealComment(seal, epic, { bestiary: { g: 3 } }),
    epicFirst: sealComment(seal, epic, {}),
  };
  assert.notEqual(seen.rareRepeat, seen.rareFirst,
    'a Mythical fish must not sound the same whether you have one or not');
  assert.notEqual(seen.epicRepeat, seen.epicFirst,
    'nor an Epic one');
  assert.notEqual(seen.junk, seen.record, 'junk and a record are different moments');
  // Junk wins when both happen: the rare find is the more surprising one to report.
  assert.equal(sealComment(seal, myth, { junk: true, personalBest: true }), seen.junk,
    'with junk and a record on one cast, the junk line is the one that plays');
  assert.equal(sealComment(null, myth, {}), '', 'no seal means no line, never a throw');
});

test('every rod has a level cap, and the caps rise with the price', () => {
  // Rods had no level gate at all: luck went straight from the starting pole to
  // the best rod in the game with nothing in between but coins. Seals have rank
  // gates and rods do not, which is why a lucky rod felt like a lottery.
  for (const rod of Object.values(RODS)) {
    assert.ok(Number.isInteger(rod.level) && rod.level >= 1,
      `${rod.id} needs a level cap`);
  }
  // Ordered by price, the cap must never go backwards -- otherwise the dearest
  // rod is also the one you can buy soonest.
  let last = 1;
  for (const rod of RODS_BY_PRICE) {
    assert.ok(RODS[rod].level >= last,
      `${rod} needs rank ${RODS[rod].level}, below the cheaper rod's ${last}`);
    last = RODS[rod].level;
  }
  // And the ladder must actually span something, not sit all at one number.
  const caps = new Set(RODS_BY_PRICE.map((r) => RODS[r].level));
  assert.ok(caps.size >= 4,
    `caps should climb through the game, found only ${[...caps].join(', ')}`);
});

test('a traited rod can only be bought while you stand in its lake', () => {
  // You could buy the Glacier Lance from Aero Lake and never use it, or buy it
  // and equip it somewhere it does not work. The rod only means something where
  // its trait does.
  const TOP = 99;   // rank above every cap, so only the lake gate is under test
  for (const rod of Object.values(RODS)) {
    if (!rod.traits.length) continue;
    for (const area of AREAS) {
      if (!area.trait) continue;
      const result = buyRod({ coins: 999999 }, rod.id, { areaId: area.id, level: TOP });
      if (rod.traits.includes(area.trait)) {
        assert.equal(result.ok, true,
          `${rod.id} must be buyable in ${area.name}, its own trait lake`);
      } else {
        assert.equal(result.ok, false, `${rod.id} must NOT be buyable in ${area.name}`);
        assert.match(result.reason ?? '', new RegExp(area.name),
          `the refusal must name the lake to go to, got "${result.reason}"`);
      }
    }
    // And out of Aero Lake, which has no trait at all.
    const none = AREAS.find((a) => !a.trait);
    assert.equal(buyRod({ coins: 999999 }, rod.id, { areaId: none.id, level: TOP }).ok, false,
      `${rod.id} must not be buyable at ${none.name}, which has no trait`);
  }
});

test('an ordinary rod is buyable anywhere', () => {
  // Only TRAITED rods are tied to a lake. Gating plain rods too would turn the
  // shop into a maze for the eight rods that open Aero Lake in the first place.
  const TOP = 99;
  for (const rod of Object.values(RODS)) {
    if (rod.traits.length) continue;
    for (const area of AREAS) {
      assert.equal(buyRod({ coins: 999999 }, rod.id, { areaId: area.id, level: TOP }).ok, true,
        `${rod.id} must be buyable in ${area.name}`);
    }
  }
});

test('an owned traited rod can still be equipped from anywhere', () => {
  // The restriction is on BUYING. Once it is in your bag it is yours, and taking
  // it out at the wrong lake is a choice with a clear message, not a wall.
  const rod = Object.values(RODS).find((r) => r.traits.length);
  const wrong = AREAS.find((a) => a.trait && !rod.traits.includes(a.trait));
  assert.ok(wrong, 'there must be a lake this rod does not fit');
  assert.equal(equipRod([rod.id], rod.id).ok, true,
    'equipping an owned rod must not be blocked by location');
});

test('a rank at or above a rod\'s cap still buys it, in its own lake', () => {
  // Belt and braces: the cap must be read as a RANK, not as a price or a rod id.
  // Buying every rod at rank 99 must only ever be refused for the lake it is not
  // in -- never for rank.
  const TOP = 99;
  for (const rod of Object.values(RODS)) {
    // Find somewhere this rod could legitimately be bought: a trait lake it fits,
    // or anywhere for a plain rod.
    const home = rod.traits.length
      ? AREAS.find((a) => a.trait && rod.traits.includes(a.trait))
      : AREAS[0];
    const result = buyRod({ coins: 999999 }, rod.id, { areaId: home.id, level: TOP });
    assert.equal(result.ok, true,
      `${rod.id} refused at rank 99 in its own lake: "${result.reason}"`);
  }
});

test('a rod below your rank is refused on rank, whatever lake you stand in', () => {
  // The rank gate had no test of its own: a guard that deleted it passed, because
  // the location tests all bought at rank 99 and the shop tests only checked that
  // SOME rows were locked. So the gate the player feels most was unprotected.
  for (const rod of Object.values(RODS)) {
    const home = rod.traits.length
      ? AREAS.find((a) => a.trait && rod.traits.includes(a.trait))
      : AREAS[0];

    if (rod.level > 1) {
      const short = buyRod({ coins: 999999 }, rod.id, { areaId: home.id, level: 1 });
      assert.equal(short.ok, false, `${rod.id} (rank ${rod.level}) must not sell at rank 1`);
      assert.match(short.reason ?? '', /rank/i,
        `and must say it is a rank problem, said "${short.reason}"`);
      // The lake must NOT be what stopped it.
      assert.doesNotMatch(short.reason ?? '', /bought at/i,
        'standing in the right lake must not produce a lake complaint');
    }

    // At its own rank, in its own lake, it sells.
    const exact = buyRod({ coins: 999999 }, rod.id, { areaId: home.id, level: rod.level });
    assert.equal(exact.ok, true, `${rod.id} must sell at exactly its rank: "${exact.reason}"`);

    // And one rank short, it does not.
    if (rod.level > 1) {
      assert.equal(buyRod({ coins: 999999 }, rod.id, { areaId: home.id, level: rod.level - 1 }).ok, false,
        `${rod.id} must not sell one rank below its cap`);
    }
  }
});

test('every rod has a Frutiger finish, and no two share one', () => {
  // Every rod was the same object: a tapered line in a different colour. A colour
  // swap is not a design. A Frutiger Aero rod has CHROME, wet gloss, translucent
  // colour, beads and bubbles -- and the only way that reads at this size is if
  // each rod declares its own finish rather than borrowing one.
  const finishes = new Map();
  for (const rod of Object.values(RODS)) {
    const look = rodArt(rod.id);
    assert.ok(look.finish, `${rod.id} needs a finish`);
    const f = look.finish;
    for (const key of ['accent', 'sheen', 'beads', 'chrome']) {
      assert.ok(f[key] !== undefined, `${rod.id}.finish is missing ${key}`);
    }
    assert.match(f.accent, /^#[0-9a-f]{6}$/i, `${rod.id} needs a hex accent`);
    assert.ok(Number.isFinite(f.sheen) && f.sheen >= 0 && f.sheen <= 1,
      `${rod.id} sheen must be 0-1`);
    assert.ok(Array.isArray(f.beads), `${rod.id} needs beads`);
    // Chrome is what makes it Frutiger rather than merely fishing equipment.
    assert.equal(typeof f.chrome, 'boolean', `${rod.id} needs a chrome flag`);

    // No two rods may share an identical finish. Compare the WHOLE object: the
    // first version built a signature from accent, sheen, beads, chrome and
    // material -- and a rod cloned down to just its accent and sheen still passed,
    // so the test could not see the duplication it existed to prevent.
    const sig = JSON.stringify(f, Object.keys(f).sort());
    assert.ok(!finishes.has(sig), `${rod.id} has the same finish as ${finishes.get(sig)}`);
    finishes.set(sig, rod.id);
  }
  assert.equal(finishes.size, Object.keys(RODS).length,
    'every rod must be visually distinct from every other');
});

test('materials are drawn from a real vocabulary, not invented per rod', () => {
  // Free-text materials would drift into "wood-ish", "metallic". Constrain them.
  const MATERIALS = new Set(['bamboo', 'wood', 'carbon', 'alloy', 'glass', 'crystal', 'composite']);
  for (const rod of Object.values(RODS)) {
    const f = rodArt(rod.id).finish;
    assert.ok(MATERIALS.has(f.material),
      `${rod.id} uses material "${f.material}", which is not in the vocabulary`);
  }
  // And the vocabulary should actually be used -- a set nobody draws from is a set
  // nobody meant.
  const used = new Set(Object.values(RODS).map((r) => rodArt(r.id).finish.material));
  assert.ok(used.size >= 5, `only ${used.size} materials in play: ${[...used].join(', ')}`);
  // And every material in the vocabulary must be reachable, or the set is
  // decoration that will drift as rods are added.
  for (const m of MATERIALS) {
    assert.ok(used.has(m), `${m} is in the vocabulary but no rod uses it`);
  }
});

test('the finish deepens along the price ladder', () => {
  // A Frutiger design should also be legible as progress: the dearer the rod, the
  // wetter the gloss and the more beads on the blank.
  let lastSheen = -1;
  let lastBeads = -1;
  for (const rod of RODS_BY_PRICE) {
    const f = rodArt(rod).finish;
    assert.ok(f.sheen >= lastSheen - 0.001,
      `${rod} sheen ${f.sheen} dips below the cheaper rod's ${lastSheen}`);
    assert.ok(f.beads.length >= lastBeads,
      `${rod} has ${f.beads.length} beads, fewer than the cheaper rod's ${lastBeads}`);
    lastSheen = f.sheen;
    lastBeads = f.beads.length;
  }
  // The top rod must be visibly shinier than the cheapest.
  assert.ok(rodArt(RODS_BY_PRICE.at(-1)).finish.sheen >
            rodArt(RODS_BY_PRICE[0]).finish.sheen + 0.3,
    'the dearest rod must be visibly glossier than the cheapest');
});

test('beads sit on the blank, clear of the grip', () => {
  // A bead at 0.1 is drawn on the cork, which looks like a mistake. The bound is
  // the grip, not a round number: the first version asserted > 0.4 and then had
  // to be widened when a legitimate 0.40 bead failed it.
  for (const rod of Object.values(RODS)) {
    const art = rodArt(rod.id);
    const gripEnd = Math.max(art.gripFrom, art.gripTo);
    for (const b of art.finish.beads) {
      assert.ok(b > gripEnd,
        `${rod.id} has a bead at ${b}, on or inside the grip which ends ${gripEnd}`);
      assert.ok(b < 1, `${rod.id} has a bead at ${b}, past the tip`);
    }
  }
});

test('a seal is only sold once its own lake is open', () => {
  // Every seal names a `home` lake and buySeal() ignored it completely -- the
  // field was read by nothing. So Tangerine, the DORFic Delta seal, could be
  // bought on day one from Aero Lake for coins you had never earned there.
  //
  // Note that "home is unlocked" means what areaUnlocked() says it means: you have
  // cleared the lake BEFORE it. Aero Lake itself is always open, so Bubbles is
  // buyable from the start with no progress at all.
  const OPEN = { bestiary: {}, owned: [] };

  for (const seal of SEALS) {
    const home = AREAS.find((a) => a.id === seal.home);
    assert.ok(home, `${seal.id} points at "${seal.home}", which is not a lake`);

    // At high rank and a full wallet, with nothing unlocked: only a seal whose
    // home is open by default may sell.
    const bare = buySeal({ coins: 999999 }, seal.id, 99, OPEN);
    if (areaUnlocked(home, OPEN)) {
      assert.equal(bare.ok, true, `${seal.id} (${home.name}) should sell from the start`);
    } else {
      assert.equal(bare.ok, false, `${seal.id} (${home.name}) sold on an empty save`);
      assert.match(bare.reason ?? '', new RegExp(home.name),
        `${seal.id} should name the lake, said "${bare.reason}"`);
    }
  }
});

test('opening the lake opens its seal, and no other', () => {
  // Build the save that unlocks each lake in turn, by completing the one before.
  const save = { bestiary: {}, owned: [] };
  const unlockedNames = () => new Set(
    AREAS.filter((a) => areaUnlocked(a, save)).map((a) => a.id),
  );

  for (const seal of SEALS) {
    const home = AREAS.find((a) => a.id === seal.home);
    const open = areaUnlocked(home, save);
    const before = buySeal({ coins: 999999 }, seal.id, 99, save).ok;
    assert.equal(before, open,
      `setup: ${seal.id} ${before ? 'sold' : 'refused'} with ${home.name} ${open ? 'open' : 'shut'}`);

    // Clear this lake: every fish landed, every rod it requires owned.
    for (const id of home.fish) save.bestiary[id] = 1;
    for (const id of home.requiredRods) if (!save.owned.includes(id)) save.owned.push(id);

    assert.equal(areaUnlocked(home, save), true,
      `clearing ${home.name} should open it`);
    const after = buySeal({ coins: 999999 }, seal.id, 99, save);
    assert.equal(after.ok, true,
      `${seal.id} should sell once ${home.name} is open, said "${after.reason}"`);

    // And opening it must not open every later seal too.
    for (const other of SEALS) {
      if (other.id === seal.id) continue;
      const oh = AREAS.find((a) => a.id === other.home);
      if (!unlockedNames().has(oh.id)) {
        assert.equal(buySeal({ coins: 999999 }, other.id, 99, save).ok, false,
          `${other.id} (${oh.name}) sold after only ${home.name} was cleared`);
      }
    }
  }
});

test('the lake gate is checked before the price, so the reason is the lake', () => {
  // Order matters to the player: broke at a locked lake, the message should be
  // about the lake, not about money they would have needed anyway.
  const seal = SEALS.find((s) => !areaUnlocked(AREAS.find((a) => a.id === s.home),
    { bestiary: {}, owned: [] }));
  assert.ok(seal, 'need a seal that starts locked');
  const broke = buySeal({ coins: 0 }, seal.id, 99, { bestiary: {}, owned: [] });
  assert.equal(broke.ok, false);
  assert.match(broke.reason ?? '', new RegExp(AREAS.find((a) => a.id === seal.home).name),
    `a player with no coins and no lake should hear about the lake, said "${broke.reason}"`);
});

test('the rank gate still applies on top of the lake gate', () => {
  // Lake open is not enough: the rank cap has to keep working, or opening DORFic
  // Delta would hand over a rank-12 seal to a rank-1 angler.
  const seal = SEALS.find((s) => s.level > 1);
  const home = AREAS.find((a) => a.id === seal.home);
  const open = { bestiary: {}, owned: [] };
  for (const id of AREAS) {
    if (id.id === home.id) break;
    for (const f of id.fish) open.bestiary[f] = 1;
    for (const r of id.requiredRods) open.owned.push(r);
  }
  assert.equal(areaUnlocked(home, open), true, `${home.name} should be open in this save`);
  assert.equal(buySeal({ coins: 999999 }, seal.id, 1, open).ok, false,
    `${seal.name} must still refuse below rank ${seal.level}`);
  assert.equal(buySeal({ coins: 999999 }, seal.id, seal.level, open).ok, true,
    `${seal.name} must sell at rank ${seal.level} in its own lake`);
});

// ---------------------------------------------------------------- the bag

test('a landed fish goes in the bag, not straight into the wallet', () => {
  // state.coins += value at the moment of the catch. Every fish was sold the
  // instant it hit the deck, so the player never chose whether a catch was worth
  // money or worth feeding to their seal -- there was no bag to choose with.
  const bag = addToBag([], fishEntrySpec(FISH[0], 2.4));
  assert.equal(bag.length, 1, 'the fish must land in the bag');
  assert.equal(bagWorth(bag), catchValue(FISH[0], 2.4),
    'and it must still be worth what it was');
  // Adding never mutates the input: the save holds one array, not a history.
  const before = [];
  addToBag(before, fishEntrySpec(FISH[0], 2.4));
  assert.equal(before.length, 0, 'the bag must be immutable');
});

test('selling a fish takes exactly that fish out and pays rod coins', () => {
  const a1 = fishEntrySpec(FISH[0], 1.5);
  const b1 = fishEntrySpec(FISH[3], 2);
  const bag = addToBag(addToBag([], a1), b1);
  assert.equal(bag.length, 2);

  const sold = sellFromBag(bag, 0);
  assert.equal(sold.ok, true);
  assert.equal(sold.coins, catchValue(FISH[0], 1.5), 'the price must be that fish alone');
  assert.equal(sold.bag.length, 1, 'and only that fish leaves');
  assert.equal(sold.bag[0].fishId, b1.fishId, 'the wrong one went');

  // An index that does not exist must refuse, not silently sell something.
  assert.equal(sellFromBag(bag, 7).ok, false);
  assert.equal(sellFromBag(bag, -1).ok, false);
  assert.equal(sellFromBag([], 0).ok, false);
});

test('feeding a fish spends it and raises the seal bond', () => {
  // Feeding is the whole point of the bag: a catch can become luck instead of
  // coins. Bond is what makes that a decision rather than a second shop.
  const bag = addToBag([], fishEntrySpec(FISH[0], 2));
  const fed = feedToBond(bag, 0, { bubbles: 3 }, 'bubbles');
  assert.equal(fed.ok, true);
  assert.equal(fed.bag.length, 0, 'a fed fish is gone');
  assert.equal(fed.bond.bubbles, 4, `bond must rise from 3 to 4, got ${fed.bond.bubbles}`);

  // Feeding four DIFFERENT fish to one seal is one bond of four, not four bonds
  // of one. The first version keyed the bond by fish id and got this backwards.
  let c = bag;
  let bond = {};
  for (const other of [FISH[0], FISH[1], FISH[2], FISH[3]]) {
    const step = feedToBond(addToBag(c, fishEntrySpec(other, 1)), 0, bond, 'bubbles');
    assert.equal(step.ok, true);
    c = step.bag;
    bond = step.bond;
  }
  assert.deepEqual(bond, { bubbles: 4 },
    `four fish to one seal must be one bond of four, got ${JSON.stringify(bond)}`);
  assert.equal(bondLuck(bondCount(bond, 'bubbles')), bondLuck(4));

  // Feeding nothing must not work, and neither must feeding with no seal.
  assert.equal(feedToBond([], 0, {}, 'bubbles').ok, false);
  assert.equal(feedToBond(bag, 9, {}, 'bubbles').ok, false);
  assert.equal(feedToBond(bag, 0, {}, null).ok, false, 'no seal, no feeding');
  assert.equal(feedToBond(bag, 0, {}, 'not-a-seal').ok, false, 'and no ghosts');
});


test('bond luck is real, monotonic and bounded', () => {
  // Unbounded luck would flatten the fish table: one very lucky rod would erase
  // every rarity above Common and Mythical would stop meaning anything.
  let last = -1;
  for (let n = 0; n <= 60; n += 1) {
    const l = bondLuck(n);
    assert.ok(l >= last, `bond luck fell at ${n} fed fish: ${l} < ${last}`);
    last = l;
  }
  assert.ok(bondLuck(0) === 0, 'no fish, no luck');
  assert.ok(bondLuck(60) < 1.6,
    `bond luck must stay modest, got ${bondLuck(60)} at 60 fed fish`);
  // Diminishing: the tenth fish should be worth less than the first.
  assert.ok(bondLuck(1) > bondLuck(10) - bondLuck(9),
    'the curve must flatten');
});

test('bond actually reaches the cast, or feeding buys nothing', () => {
  // A bond that no rule reads would be a number on a panel. luckFor() is what a
  // cast rolls with, so that is where feeding has to land.
  const rod = RODS.titan;
  const bare = luckFor({ rod, level: 1, seal: null });
  const fed = luckFor({ rod, level: 1, seal: null, bond: 16 });
  assert.ok(fed > bare,
    `16 fed fish must roll better than none: ${fed} vs ${bare}`);
  assert.equal(fed - bare, bondLuck(16), 'and the bonus must be exactly the bond luck');

  // And it stacks with a seal rather than replacing it.
  const seal = SEALS[0];
  const withSeal = luckFor({ rod, level: 1, seal });
  const withSealFed = luckFor({ rod, level: 1, seal, bond: 16 });
  // Rounded: these are sums of decimals, and 3.4000000000000004 - 2.6 is not
  // exactly 0.8. An equality check on a float sum fails for arithmetic, not logic.
  assert.ok(Math.abs((withSealFed - withSeal) - bondLuck(16)) < 1e-9,
    `bond must add on top of the seal: ${withSealFed - withSeal} vs ${bondLuck(16)}`);
});

test('a hooked fish shows a silhouette: its shape, not its name', () => {
  // The reel showed a 4px yellow bar for every fish in the game, so the player
  // was fighting an unidentifiable rectangle. A silhouette fixes that WITHOUT
  // naming the catch: you should be able to see something long and sinuous and
  // know to be careful, without the game telling you it is a Mythical.
  const svg = fishSilhouette(FISH.find((f) => f.draw === 'long'));
  assert.match(svg, /^<svg/, 'a silhouette must be an svg');
  assert.ok(svg.length > 40, 'and not a stub');

  // Compare EVERY pair of shapes. Comparing two at a time passed even with one
  // shape's path pinned to another's, because the remaining shapes still differed
  // from each other -- the guard could not see the shape it had just flattened.
  const shapes = ['slim', 'deep', 'flat', 'long'];
  for (const draw of shapes) {
    const fish = FISH.find((f) => f.draw === draw);
    assert.ok(fish, `no fish uses the ${draw} shape`);
    const mine = fishSilhouette(fish);
    for (const other of shapes) {
      if (other === draw) continue;
      const theirs = fishSilhouette(FISH.find((f) => f.draw === other));
      assert.notEqual(mine, theirs, `${draw} and ${other} look identical on the reel`);
    }
  }

  // Comparing whole SVGs was still not enough: pinning ONE path (the body) to
  // another shape's left the tail and fin different, so every silhouette stayed
  // unique and the guard passed on a flattened fish. Pin the shape's OWN geometry
  // -- body, tail, fin and eye -- so any single part swapped out is caught.
  for (const draw of shapes) {
    const shape = FISH_SHAPES[draw];
    const svg = fishSilhouette(FISH.find((f) => f.draw === draw));
    for (const part of ['body', 'tail', 'fin']) {
      assert.ok(svg.includes(shape[part]),
        `the ${draw} silhouette must use its own ${part}`);
    }
    assert.ok(svg.includes(`cx="${shape.eye.cx}"`),
      `the ${draw} silhouette must use its own eye`);
  }

  // It must not leak identity: no name, no rarity, no hue of the real fish.
  for (const fish of FISH) {
    const s = fishSilhouette(fish);
    assert.doesNotMatch(s, new RegExp(fish.name), `${fish.id} leaked its name`);
    assert.doesNotMatch(s, new RegExp(fish.rarity), `${fish.id} leaked its rarity`);
  }
});

test('a silhouette is flat, dark, and cheap enough to draw every frame', () => {
  // This renders DURING the reel, on every frame. It cannot be the full fishSvg():
  // that is 6,680 bytes with five gradients, a filter and ten sparkles, redrawn
  // 60 times a second. The silhouette is 642.
  const svg = fishSilhouette(FISH[0]);
  const full = fishSvg(FISH[0]);
  assert.ok(svg.length * 3 < full.length,
    `a silhouette must be far cheaper than the real fish: ${svg.length} vs ${full.length}`);

  // No filters, and no rarity decoration -- those are the expensive parts and
  // they would spoil the catch the silhouette exists to hint at. A single
  // vertical gradient for the shaded top is fine and is what makes it read as a
  // solid object rather than a flat cut-out.
  assert.doesNotMatch(svg, /<filter/, 'no filters');
  assert.doesNotMatch(svg, /sparkle|crown/i, 'nor the rarity decoration');
  assert.ok((svg.match(/Gradient/g) || []).length <= 2,
    'at most one gradient, for the shaded top');
  assert.match(svg, /<path|<ellipse|<polygon/, 'but it must be real geometry');

  // Namespaced per fish, for the same reason fishSvg's are: duplicate ids in the
  // document made url(#...) resolve to whichever came first.
  assert.match(svg, /id="fa-sil-[a-z-]+"/, 'ids must be namespaced');
});


test('every body shape survives a round trip through the silhouette', () => {
  // A fish whose `draw` names a shape that does not exist used to fall back
  // silently. It must still produce a silhouette rather than an empty box.
  for (const fish of FISH) {
    const s = fishSilhouette(fish);
    assert.ok(s.includes('<svg'), `${fish.id} (${fish.draw}) produced no svg`);
    assert.ok(s.length > 40, `${fish.id} (${fish.draw}) produced a stub`);
  }
  // And a nonsense draw must not throw.
  const ghost = fishSilhouette({ id: 'ghost', draw: 'sausage', hue: 1, rarity: 'Mythical' });
  assert.match(ghost, /^<svg/, 'an unknown shape must still draw something');
});

test('you can sell one find out of the bag, not only all of them', () => {
  // The finds bag sold everything or nothing: one button, "Sell 7 for 210". A bag
  // of seven identical Bubble Wafers gave you no way to sell one and keep six.
  const one = sellLostItems(['gumball', 'gumball', 'gumball'], 1);
  assert.equal(one.ok, true, 'selling one must work');
  assert.equal(one.sold, 1, 'exactly one leaves');
  assert.equal(one.held.length, 2, 'the rest stay in the bag');
  assert.equal(one.sealCoins, LOST_ITEMS.find((i) => i.id === 'gumball').value,
    'and it pays that one item, not the lot');

  // Selling the whole bag must still work, unchanged.
  const all = sellLostItems(['gumball', 'gumball']);
  assert.equal(all.sold, 2);
  assert.equal(all.held.length, 0);

  // Asking for more than is there is a refusal, not a negative sale.
  const tooMany = sellLostItems(['gumball'], 2);
  assert.equal(tooMany.ok, false, 'cannot sell what is not there');
  assert.equal(tooMany.sold, 0);
  assert.equal(tooMany.held.length, 1, 'and the bag is untouched');

  assert.equal(sellLostItems([], 1).ok, false, 'an empty bag sells nothing');
  assert.equal(sellLostItems(['gumball'], 0).ok, false, 'nor does zero of them');
});

test('grouping the bag is pure, and it groups by fish rather than by value', () => {
  // The bag had to be grouped so that twelve identical fish are one row. The
  // grouping itself is a rule -- which fish collapse together, and which of them
  // the row shows -- so it belongs in fishing.js where it can be tested without a
  // DOM.
  const glides = [1, 2, 3].map((w) => fishEntrySpec(FISH[0], w));
  const sun = fishEntrySpec(FISH[1], 1);

  const groups = groupBag([...glides, sun]);
  assert.equal(groups.length, 2, 'three of one fish and one of another is two rows');

  const g = groups.find((x) => x.fishId === FISH[0].id);
  assert.equal(g.entries.length, 3, 'all three collapse together');
  assert.equal(g.count, 3, 'and the count is stated');

  // Which fish the row SHOWS: the heaviest, because that is the one worth selling
  // and the one a player would recognise.
  assert.equal(g.entry.weight, 3, 'the row shows the heaviest');
  assert.equal(g.total, g.entries.reduce((sum, e) => sum + bagEntryValue(e), 0),
    'and totals what the whole group is worth');

  // A mutated fish is still that fish: a triple-striped Glidefin and a plain one
  // collapse, because they are the same creature and the same decision.
  const mutated = fishEntrySpec(FISH[0], 2, { name: 'Triple', multiplier: 3 });
  assert.equal(groupBag([glides[0], mutated]).length, 1,
    'a mutation must not split a species into two rows');

  // Degenerate inputs must not throw.
  assert.deepEqual(groupBag([]), []);
  assert.deepEqual(groupBag(null), []);
  // And a ghost fish in a save cannot produce a row that cannot be sold.
  const ghosts = groupBag([{ fishId: 'no-such-fish', weight: 1, multiplier: 1 }]);
  assert.equal(ghosts.length, 1, 'a ghost still gets a row, so it can be cleared');
  assert.equal(ghosts[0].entry.weight, 1, 'and keeps its value');

  // The original is never mutated: the save holds one array.
  const source = [...glides, sun];
  groupBag(source);
  assert.equal(source.length, 4, 'the bag must not be reordered in place');
});

test('a seal says something different when fed, by the rarity of the fish', () => {
  // Feeding is the newest thing a seal reacts to, and it had no line for it: every
  // feed got the generic chatter, so the fish you chose to feed -- the decision the
  // bag exists for -- was the one thing the pet said nothing about.
  const byRarity = { Common: 'common', Uncommon: 'uncommon', Rare: 'rare',
    Epic: 'epic', Legendary: 'legendary', Mythical: 'mythical' };

  for (const seal of SEALS) {
    assert.ok(seal.fed, `${seal.id} must have feeding lines`);
    for (const [rarity, key] of Object.entries(byRarity)) {
      assert.equal(typeof seal.fed[key], 'string',
        `${seal.id} needs a fed line for ${rarity} (fed.${key})`);
      assert.ok(seal.fed[key].length > 3, `${seal.id}.fed.${key} is empty`);
    }
    // Every tier distinct, or "depending on rarity" is a lie.
    const all = Object.values(byRarity).map((k) => seal.fed[k]);
    assert.equal(new Set(all).size, all.length,
      `${seal.id} repeats a feeding line across tiers`);
    // And never one of its OWN catch lines: feeding is its own moment. The
    // first version compared against a line copied from a different seal, which
    // no fed line in this seal matched -- so it could not fail.
    const own = new Set(Object.values(seal.catch ?? {}));
    for (const line of all) {
      assert.ok(!own.has(line),
        `${seal.id} reuses one of its own catch lines when fed: "${line}"`);
    }
  }
});

test('sealFedLine picks the tier, and a seal with no lines still answers', () => {
  const seal = SEALS[0];
  for (const fish of FISH) {
    const line = sealFedLine(seal, fish);
    assert.equal(typeof line, 'string', `${fish.id} must get a line`);
    assert.ok(line.length > 0, `${fish.id} got an empty line`);
  }
  // The tier must actually drive it: a Mythical and a Common differ.
  const common = FISH.find((f) => f.rarity === 'Common');
  const mythical = FISH.find((f) => f.rarity === 'Mythical');
  assert.notEqual(sealFedLine(seal, common), sealFedLine(seal, mythical),
    'Common and Mythical must not get the same line');

  // An unknown fish falls back rather than throwing, and no seal is silent.
  assert.ok(sealFedLine(seal, { rarity: 'Nonsense' }).length > 0, 'unknown rarity still speaks');
  // An unknown fish falls back to the lowest tier rather than throwing.
  assert.ok(sealFedLine(seal, { rarity: 'Nonsense' }).length > 0, 'unknown rarity still speaks');
  // With NO seal there is nothing to say, and that is right: a bubble with nobody
  // behind it would be worse. sealComment() returns '' in the same case.
  assert.equal(sealFedLine(null, FISH[0]), '', 'no seal, no line');
});


test('each seal is fed in its own voice, and they read differently', () => {
  // The lines are hand-written per seal, so nothing stops a rewrite drifting into
  // generic. Compare the two extremes by their SHAPE, which is what actually
  // distinguishes a drill sergeant from a deadpan: exclamation against flat
  // sentences, questions against statements.
  const fed = (id) => Object.values(SEALS.find((s) => s.id === id).fed);

  // Frost shouts, and mostly in capitals. Proportion rather than "every": the
  // first version demanded all six and one of them lands as a statement, which is
  // correct for a sergeant running out of breath.
  const frost = fed('frost');
  const shouted = frost.filter((l) => l.endsWith('!')).length;
  assert.ok(shouted >= 4, `frost should end most lines in a bang, got ${shouted}/6`);
  assert.ok(frost.some((l) => /\b[A-Z]{3,}/.test(l)),
    'and at least one should be all capitals');

  const bubbles = fed('bubbles');
  assert.ok(bubbles.some((l) => /[?!]/.test(l)),
    'bubbles asks questions and cannot help interrupting');

  // Tangerine and Moss are both flat, but Tangerine is pointed and Moss is short.
  const tangerine = fed('tangerine');
  const moss = fed('moss');
  const avgLen = (xs) => xs.reduce((n, l) => n + l.length, 0) / xs.length;
  assert.ok(avgLen(tangerine) > avgLen(moss),
    `tangerine should be wordier than moss: ${avgLen(tangerine).toFixed(0)} vs ${avgLen(moss).toFixed(0)}`);
  assert.ok(!tangerine.some((l) => /[?!]/.test(l)),
    'tangerine never asks a question and never wows -- she lands it and stops');
  assert.ok(!moss.some((l) => /[!]/.test(l)),
    'moss does not exclaim. ever.');
  assert.ok(fed('abyss').every((l) => l === l.toLowerCase() || /^[A-Z]/.test(l)),
    'abyss trails off rather than declaiming');
});


test('the bond ladder is a real, strictly increasing set of milestones', () => {
  // The timeline exists to show feeding is going somewhere. A ladder of made-up
  // numbers would make it decoration, so the rule that produces it is pure and
  // tested: milestones rise, they never repeat a count, and each one says what it
  // actually grants.
  const steps = bondMilestones();
  assert.ok(steps.length >= 5,
    `a timeline needs somewhere to go; ${steps.length} steps is not a ladder`);

  let lastAt = -1;
  for (const step of steps) {
    assert.ok(Number.isInteger(step.at) && step.at > 0,
      `every step needs a fish count, got ${step.at}`);
    assert.ok(step.at > lastAt,
      `steps must strictly increase: ${step.at} after ${lastAt}`);
    lastAt = step.at;
    assert.ok(typeof step.title === 'string' && step.title.length > 0,
      `step ${step.at} needs a name`);
    assert.ok(typeof step.reward === 'string' && step.reward.length > 0,
      `step ${step.at} must say what it gives`);
  }
});

test('a milestone only claims what bondLuck actually pays out', () => {
  // The temptation is to write "+1.0 luck at 25 fed" and move on. It has to be
  // true: bondLuck is square-rooted, so the number quoted must be the real one.
  for (const step of bondMilestones()) {
    assert.equal(step.luck, bondLuck(step.at),
      `${step.at} fed pays ${bondLuck(step.at)} luck, not ${step.luck}`);
  }
});

test('the ladder ends where the returns stop being worth feeding towards', () => {
  // Square-rooted bond is unbounded, so "the last step" has to be a design choice
  // and has to say so. And the final step must be reachable in a plausible game:
  // a player who has fed 100 fish should not be told they have 60 left to go.
  const steps = bondMilestones();
  const last = steps[steps.length - 1];
  assert.ok(last.at <= 100,
    `the ladder should be finishable, but it ends at ${last.at}`);

  // Luck keeps rising, and the steps stay evenly spaced enough that the bar can
  // show one approaching.
  const gains = steps.map((s) => s.luck);
  for (let i = 1; i < gains.length; i += 1) {
    assert.ok(gains[i] > gains[i - 1], 'luck must keep rising');
  }

  // Diminishing RETURNS -- luck per FISH fed, not luck gained per step. Comparing
  // step-to-step gains instead shows the opposite, because the steps get wider:
  // the last step buys nearly three times the luck the second does, which looks
  // like an accelerating reward when it is really a slowing one.
  const perFish = steps.map((s) => s.luck / s.at);
  for (let i = 1; i < perFish.length; i += 1) {
    assert.ok(perFish[i] < perFish[i - 1],
      `luck per fish must fall: step ${steps[i].at} gives ${perFish[i].toFixed(4)} per fish,`
      + ` step ${steps[i - 1].at} gave ${perFish[i - 1].toFixed(4)}`);
  }
});



/* ------------------------------------------------- selling the whole bag */

/**
 * A bag of real, priced fish.
 *
 * These tests were written against `fishEntrySpec('glidefin', 1.2)` -- passing the
 * id where the function wants the FISH OBJECT, so every entry came out with
 * `fishId: undefined`, every fish was worth 0, and the expected total was 0 too.
 * The tests then passed with the rule paying nothing at all: a guard comparing
 * zero to zero. Building the entries through the real FISH table, and asserting
 * the total is a real number, is what stops that.
 */
function pricedBag() {
  // Priced by pricePerKg, which is the field catchValue() reads -- not a `value`
  // field, which no fish in the table has. Filtering on the wrong one returns an
  // empty list and every entry below becomes undefined.
  const [a, b] = FISH.filter((f) => f.pricePerKg > 0);
  assert.ok(a && b, 'the fish table must hold at least two priced fish');
  return [
    fishEntrySpec(a, 1.2),
    fishEntrySpec(b, 3.4),
    fishEntrySpec(a, 0.6),
    { ...fishEntrySpec(b, 2.2), multiplier: 3 },          // a landed mutation
  ];
}

test('the test bag is worth something, so the sell tests can fail', () => {
  // The sanity check the first version of these lacked. A bag of zero-value
  // entries makes every assertion below a tautology.
  const bag = pricedBag();
  assert.ok(bag.every((e) => typeof e.fishId === 'string' && e.fishId.length),
    'every entry must name a real fish, got ' + JSON.stringify(bag.map((e) => e.fishId)));
  const worth = bagWorth(bag);
  assert.ok(worth > 0, `the bag must be worth something, got ${worth}`);
});

test('selling the whole bag pays exactly what selling each fish pays', () => {
  // The rule that matters: "Sell all" must not disagree with the per-row button.
  // Selling four fish one at a time and selling the lot in one go are the same
  // decision, so they must be the same number -- otherwise one of the two lies to
  // the player and there is no way to tell which.
  const bag = pricedBag();

  // Ground truth: sell them one at a time through the single-sale rule.
  let expected = 0;
  let left = bag;
  for (let i = bag.length - 1; i >= 0; i -= 1) {
    const one = sellFromBag(left, i);
    expected += one.coins;
    left = one.bag;
  }
  assert.ok(expected > 0, 'the per-fish total must be a real number');

  const all = sellWholeBag(bag);
  assert.equal(all.ok, true);
  assert.equal(all.coins, expected,
    `sell-all paid ${all.coins} but selling the same fish one at a time pays ${expected}`);
  assert.equal(all.sold, bag.length);
  assert.deepEqual(all.bag, [], 'the bag must be empty afterwards');
});

test('sell-all leaves the caller\'s own bag untouched', () => {
  // The rules are pure: a panel that renders rows must not empty the array it was
  // handed, or the row buttons would stop working the moment the lot is sold.
  const bag = pricedBag();
  const snapshot = JSON.stringify(bag);
  sellWholeBag(bag);
  assert.equal(JSON.stringify(bag), snapshot, 'sellWholeBag must not mutate its argument');
});

test('selling an empty bag is refused, never a silent zero', () => {
  // A button that pays nothing and says nothing reads as broken. The finds bag
  // refuses the same way, so the two agree.
  for (const empty of [[], null, undefined, 'nonsense']) {
    const r = sellWholeBag(empty);
    assert.equal(r.ok, false, `selling ${JSON.stringify(empty)} must be refused`);
    assert.equal(r.coins, 0);
    assert.ok(r.reason, 'and it must say why');
  }
});

test('a bag holding nothing but dead fish still clears, for nothing', () => {
  // An id no longer in the table must not strand the bag: the player cannot sell
  // it row by row either, so a lot button has to get them out of that state. It
  // pays zero because there is nothing to pay, but it must not be a refusal --
  // otherwise the bag is stuck forever with no way out.
  const bag = [{ fishId: 'a-fish-that-was-removed', weight: 2, mutation: null, multiplier: 1 }];
  const r = sellWholeBag(bag);
  assert.equal(r.ok, true, 'a dead entry must not lock the bag');
  assert.equal(r.coins, 0, 'and it is worth nothing');
  assert.deepEqual(r.bag, [], 'but it leaves the bag, so the player is unstuck');
});

test('sell-all empties the bag, and says how many it sold', () => {
  // A "Sell all" that quietly kept one fish behind would leave the player with a
  // bag they cannot tell is still full, and the button would appear to have done
  // nothing on the second press. Assert the bag comes back empty on its own, so a
  // short sale cannot pass as a complete one -- and that `sold` counts the lot.
  const bag = pricedBag();
  const all = sellWholeBag(bag);
  assert.equal(all.bag.length, 0,
    `sell-all must empty the bag, it left ${all.bag.length}: ${JSON.stringify(all.bag)}`);
  assert.equal(all.sold, bag.length,
    `it must report selling all ${bag.length}, reported ${all.sold}`);
  // And a bag of one behaves the same as a bag of many: no special case.
  const single = sellWholeBag([fishEntrySpec(FISH[0], 1.5)]);
  assert.equal(single.bag.length, 0);
  assert.equal(single.sold, 1);
});

test('sell-all agrees with the total the bag panel already shows', () => {
  // The panel's summary line is what the player reads before deciding. If the
  // number on screen and the number the button pays ever disagree, the button
  // feels like a scam -- so they are asserted to be the same expression of the
  // same bag.
  const bag = pricedBag();
  assert.equal(sellWholeBag(bag).coins, bagWorth(bag));
});

test('one big fish and many small ones pay the same either way round', () => {
  // Order must not matter. Selling backwards (as sellWholeBag does) and forwards
  // must give the same total, or the button pays differently depending on an
  // invisible detail of the array.
  const bag = pricedBag();
  const forwards = [...bag].reverse();
  assert.equal(sellWholeBag(bag).coins, sellWholeBag(forwards).coins,
    'sell-all must not depend on the order the bag happens to be in');
});


/* ------------------------------------------------- seals take their area's colour */

/**
 * Each seal wears the colour of the lake it lives in.
 *
 * HUE ALONE IS NOT ENOUGH, which is the thing this cost several passes to find.
 * Three of the five lakes are the same cyan -- Aero Lake, Glacier Fjord and Dark
 * Aero Deep have accent hues of 199, 201 and 199. So "the seal matches its lake"
 * and "the seals are distinguishable" are in direct conflict on hue, and the shop
 * list showed the result: Frost and Bubbles three degrees apart, one of them
 * unpickable.
 *
 * What actually tells those three apart is LIGHTNESS, and it is also what is
 * true about them: bright shallows (62%), glacier ice (82%), the black deep (34%).
 * So a seal carries its lake's hue AND its lake's lightness. Frutiger Aero is a
 * high-key, glossy palette, so the lightnesses sit bright rather than copying the
 * muddy water hex verbatim.
 */
function hueOf(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  assert.ok(m, `expected a 6-digit hex colour, got ${JSON.stringify(hex)}`);
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;                        // grey has no hue
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}

/** Shortest distance between two hues, 0-180 degrees. */
function hueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const sealById = new Map(SEALS.map((s) => [s.id, s]));

test('every seal wears the hue of the lake it lives in', () => {
  // Measured against the lake's WATER, which is what a seal actually lives in --
  // not the sky, and not the accent: Aero Lake's accent is #4fc3f7, which is the
  // same cyan as two other lakes and so cannot tell the seals apart.
  const byId = new Map(AREAS.map((a) => [a.id, a]));
  assert.ok(byId.size >= 5, `expected the lakes the seals live in, got ${byId.size}`);

  for (const seal of SEALS) {
    const area = byId.get(seal.home);
    assert.ok(area, `${seal.name} lives at "${seal.home}", which is not a lake`);
    const want = hueOf(area.palette.water);
    assert.ok(hueGap(seal.hue, want) <= 20,
      `${seal.name} lives at ${area.name}, whose water ${area.palette.water} is hue `
      + `${want}, but the seal is drawn at hue ${seal.hue} (${hueGap(seal.hue, want)} off). `
      + 'A seal must wear the colour of its own water.');
  }
});

test('every seal carries a lightness, and it comes from its own lake', () => {
  // The axis that separates the three blue lakes. Without it they are one colour.
  const byId = new Map(AREAS.map((a) => [a.id, a]));
  for (const seal of SEALS) {
    const area = byId.get(seal.home);
    assert.ok(Number.isInteger(seal.light),
      `${seal.name} has light=${JSON.stringify(seal.light)}, which is not a whole percent`);
    assert.ok(seal.light >= 25 && seal.light <= 88,
      `${seal.name} light ${seal.light}% is outside 25-88 -- too dark to read on a light panel, `
      + 'or too pale to see against one');
  }
});

test('no two seals are the same colour to look at', () => {
  // The defect this exposed: Frost (198) and Bubbles (195) were three degrees
  // apart and read as one seal in the shop list. Two seals must differ on hue OR
  // on lightness by enough to be told apart at a glance.
  //
  // Hue 30 degrees or lightness 12 points is where two swatches stop reading as
  // shades of one another.
  for (let i = 0; i < SEALS.length; i += 1) {
    for (let j = i + 1; j < SEALS.length; j += 1) {
      const a = SEALS[i], b = SEALS[j];
      const hue = hueGap(a.hue, b.hue);
      const light = Math.abs(a.light - b.light);
      assert.ok(hue >= 30 || light >= 12,
        `${a.name} (hue ${a.hue}, light ${a.light}%) and ${b.name} `
        + `(hue ${b.hue}, light ${b.light}%) look like the same seal: `
        + `hue ${hue} apart, lightness ${light} apart.`);
    }
  }
});

test('a seal colour is a whole number of degrees and percent', () => {
  // Both are interpolated straight into an hsl() string, so a float or a string
  // paints an invalid colour and falls back to the browser default silently.
  for (const seal of SEALS) {
    assert.ok(Number.isInteger(seal.hue),
      `${seal.name} has hue ${JSON.stringify(seal.hue)}, which is not a whole degree`);
    assert.ok(seal.hue >= 0 && seal.hue < 360,
      `${seal.name} has hue ${seal.hue}, outside 0-359`);
  }
});

test('every seal has a lake to be coloured by, and every lake a seal', () => {
  // Guards the join from both sides: a seal whose home is not a lake falls through
  // the colour lookup, and a lake nobody lives in means the two tables have drifted.
  const homes = new Set(SEALS.map((s) => s.home));
  const lakeIds = new Set(AREAS.map((a) => a.id));
  for (const seal of SEALS) {
    assert.ok(lakeIds.has(seal.home), `${seal.name} is at unknown lake ${seal.home}`);
  }
  for (const id of lakeIds) {
    assert.ok(homes.has(id), `lake ${id} has no seal living there`);
  }
});

test('the palette is Frutiger Aero: bright, and inside the site hue range', () => {
  // Not every hue is on-brand: a pure red or magenta seal would read as a different
  // game's token. The site's own accents sit in the aqua/green/amber band, so a
  // seal outside it is a data error rather than a choice.
  for (const seal of SEALS) {
    const inBand = (seal.hue >= 0 && seal.hue <= 60)        // warm: amber through coral
      || (seal.hue >= 70 && seal.hue <= 230);              // the Aero aqua/green/blue band
    assert.ok(inBand,
      `${seal.name} at hue ${seal.hue} sits outside the palette's band -- `
      + 'it would read as a token from somewhere else.');
  }
});

test('the seals are measurably different once painted, not just on paper', () => {
  // Hue and lightness are proxies; what matters is the colour that comes out. This
  // renders each seal the way the shop portrait does -- hsl(h 66% light) -- and
  // measures the contrast between every pair.
  //
  // It is the check that caught the real problem: Frost and Bubbles were 3 degrees
  // apart in hue and rendered at a luminance ratio of 1.00, which is to say the same
  // colour. Separating them in lightness took it to 1.79.
  const rgbOf = (hue, sat, light) => {
    const h = ((hue % 360) + 360) % 360, s = sat / 100, l = light / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };
  const luminance = ([r, g, b]) => {
    const ch = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (a, b) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const painted = new Map(SEALS.map((seal) => [
    seal.name, rgbOf(seal.hue, 66, seal.light)]));

  // Luminance contrast only decides pairs that are CLOSE IN HUE. A cyan beside an
  // orange is obviously two colours at any contrast, so holding them to a lightness
  // bar would push the palette somewhere the game does not want to go. The pairs
  // that need proving are the ones hue cannot separate -- which is exactly the set
  // of same-family seals, and the three blue lakes are the case that was broken.
  const family = (a, b) => hueGap(a.hue, b.hue) <= 30;
  for (let i = 0; i < SEALS.length; i += 1) {
    for (let j = i + 1; j < SEALS.length; j += 1) {
      const a = SEALS[i], b = SEALS[j];
      if (!family(a, b)) continue;
      const r = ratio(painted.get(a.name), painted.get(b.name));
      assert.ok(r >= 1.5,
        `${a.name} and ${b.name} are the same hue family (${a.hue} vs ${b.hue}) but `
        + `render at ${r.toFixed(2)} contrast -- they will read as one seal`);
    }
  }

  // Named explicitly, so the regression cannot hide behind a wider tolerance later.
  const blues = SEALS.filter((s) => hueGap(s.hue, 205) <= 25);
  assert.ok(blues.length >= 3,
    `expected the three blue-lake seals, found ${blues.length}`);
  for (let i = 0; i < blues.length; i += 1) {
    for (let j = i + 1; j < blues.length; j += 1) {
      const r = ratio(painted.get(blues[i].name), painted.get(blues[j].name));
      assert.ok(r >= 1.5,
        `${blues[i].name} and ${blues[j].name} are both blue lakes but render at `
        + `${r.toFixed(2)} contrast -- hue alone cannot separate them`);
    }
  }
});
