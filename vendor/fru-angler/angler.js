/**
 * Frutiger Angler: input, timing and rendering.
 *
 * Every rule lives in fishing.js (rods, casts, fish, economy) and reel.js (the
 * minigame maths). This file only turns their output into pixels, and is the
 * only part that touches the DOM.
 */
import {
  RODS, FISH, RARITY_ORDER, RARITY_COLOURS,
  castQuality, castDistance, biteDelayFor, rollFish, rollMutation,
  skyFor, luckFromSky,
  fishWeight, canCatch, catchValue, startingLoadout, buyRod, recordCatch,
  startingInventory, ownsRod, addRodToInventory, equipRod, rodArt, RODS_BY_PRICE,
  fishById, fishSvg, fishSilhouette,
 fishIndex,
 hookLineFor,
 AREAS,
 areaUnlocked,
 areaProgress,
 rodWorksIn,
 rodCheckIn,
 fishEntry, visitArea,
 SEALS, LOST_ITEMS,
 levelFrom, xpForCatch, xpForLevel, luckFor, luckFromLevel,
 rollLostItem, lostItemsFor, sellLostItems, lostItemById,
 addToBag, fishEntrySpec, bagWorth, bagEntryValue,
 sellFromBag, feedToBond, bondLuck, bondCount, groupBag,
 buySeal, equipSeal, sealComment, sealDuplicates, sealIdleLine, sealFedLine, bondProgress,
} from './fishing.js?v=2026-10-04-y';
import {
  reelConfig, stepReel as advance, reelOutcomeFor, isCaught, lineSnapped,
} from './reel.js?v=2026-10-04-y';

/* ------------------------------------------------------------------ tuning */

const CAST_SPEED = 1.05;      // meter fractions per second while held
const SHAKE_INTERVAL_MS = 900;
const SHAKE_BONUS_MS = 420;   // bite delay removed per shake pressed
const SHAKE_MAX_ON_SCREEN = 3;
const REEL_DT = 1 / 60;
const SAVE_KEY = 'fru-angler-save';
/* How long the player has to set the hook after a bite. Generous, because this
 * is the first time they see the prompt, but finite: without a deadline the
 * "click to hook" rule is only a suggestion. */
const HOOK_WINDOW_MS = 2600;
const IDLE_HINT = 'Hold Space or press and hold, then release in the green band.';

/* --------------------------------------------------------------------- dom */

const el = (id) => document.getElementById(id);
const ui = {
  lake: el('lake'), bobber: el('bobber'), splash: el('splash'),
  boostList: el('boost-list'), boostTotal: el('boost-total'),
  cast: el('cast'), castFill: el('cast-fill'),
  bite: el('bite'), hookSet: el('hook-set'),
  reel: el('reel'), reelPlayer: el('reel-player'), reelFish: el('reel-fish'),
  reelLine: el('reel-line'),
  reelFill: el('reel-fill'),
  catch: el('catch'), catchName: el('catch-name'), catchMeta: el('catch-meta'),
  catchValue: el('catch-value'), catchAgain: el('catch-again'),
  catchArt: el('catch-art'), catchWeight: el('catch-weight'), catchWorth: el('catch-worth'),
  catchMutation: el('catch-mutation'),
  shopPanel: el('shop-panel'), shopList: el('shop-list'), shopCoins: el('shop-coins'),
  shopOpen: el('shop-open'), shopClose: el('shop-close'),
  // The inventory: rods and the bestiary. Historically called "a bag".
  inventory: el('inventory-panel'), inventoryRods: el('inventory-rods'),
  inventoryFish: el('inventory-fish'),
  inventoryEmpty: el('inventory-empty'), inventoryCount: el('inventory-count'),
  inventoryOpen: el('inventory-open'), inventoryClose: el('inventory-close'),
  // The fish bag: unsold catches. Two panels are "a bag"; they are not
  // the same one, and a duplicate key here silently kills a panel.
  bagPanel: el('bag-panel'), bagList: el('bag-list'),
  bagSummary: el('bag-summary'), bagOpenBtn: el('bag-open'),
  bagCloseBtn: el('bag-close'), bagCount: el('bag-count'),
  bondOpen: el('bond-open'), bondClose: el('bond-close'),
 bondPanel: el('bond-panel'), bondHead: el('bond-head'),
  bondFill: el('bond-fill'), bondTimeline: el('bond-timeline'),
  indexPanel: el('index-panel'), indexList: el('index-list'),
  indexOpen: el('index-open'), indexClose: el('index-close'),
  lakePicker: el('lake-picker'), lakePanel: el('lake-panel'),
  lakeList: el('lake-list'), lakeName: el('lake-name'),
  skyName: el('sky-name'),
  lakeClose: el('lake-close'),
  coins: el('coins'), rod: el('rod'), rodStats: el('rod-stats'), bestiary: el('bestiary'),
  message: el('message'),
  line: el('line'),
  level: el('level'), levelTitle: el('level-title'), levelBar: el('level-progress'),
  sealWallet: el('seal-coins'),      // HUD
  bubble: el('fa-bubble'), bubbleText: el('fa-bubble-text'),
  notify: el('notify'),
  sealShopCoins: el('seal-shop-coins'),  // inside the seal shop
  sealHint: el('seal-shop-hint'),  // only shown with an empty dock
  findsList: el('finds-list'), sellFinds: el('sell-finds'),
  findsRows: el('finds-rows'),
  pet: el('fa-pet'),
  sealPanel: el('seal-shop-panel'), sealList: el('seal-shop-list'),
  sealCoins: el('seal-shop-coins'),
  sealOpen: el('seal-shop-open'), sealClose: el('seal-shop-close'),
  rodShaft: el('rod-shaft'), rodTipDot: el('rod-tip'),
  rodHeel: el('rod-heel'), rodGloss: el('rod-gloss'), rodStripe: el('rod-stripe'),
  rodGrip: el('rod-grip'), rodGuides: el('rod-guides'), rodReel: el('rod-reel'),
  rodChrome: el('rod-chrome'), rodBeads: el('rod-beads'),
  rodReelBody: el('rod-reel-body'), rodReelHub: el('rod-reel-hub'), rodReelArm: el('rod-reel-arm'),
  rarity: el('catch-rarity'),
};

/* ------------------------------------------------------------------- state */

const state = {
  phase: 'idle',        // idle | casting | waiting | reeling | result
  rodId: 'bamboo',
  owned: startingInventory(),   // everything bought so far; rodId is one of these
  coins: 0,
  meter: 0,
  holding: false,
  hooked: null,         // the fish on the line
  reel: null,
  shakeTimer: null,
  biteAt: 0,
  bestiary: {},         // fishId -> heaviest weight landed
  hookAt: 0,            // when the bite window closes
  bitten: null,         // the fish on the line, waiting to be hooked
  areaId: AREAS[0].id,  // the water you are standing in
  xp: 0,               // rank progress; levelFrom() turns this into a level
  ownedSeals: [],      // every seal bought, cheapest first
  equippedSeal: null,  // the ONE of them sitting on the dock with you
  lost: [],            // lost items recovered, newest last
  sealCoins: 0,        // the seal economy; sold finds are the ONLY way in
  giftedRods: [],      // rods handed over on arrival, so they cannot be farmed
  bag: [],           // landed fish, unsold. They are worth nothing until you act.
  duplicates: 0,        // seal copies handed over, all time
  bond: {},            // sealId -> how many fish it has been fed
};

const rod = () => RODS[state.rodId];

/* ------------------------------------------------------------------- save */

function load() {
  const fresh = startingLoadout();
  state.rodId = fresh.rodId;
  state.coins = fresh.coins;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Number.isFinite(saved.coins) && saved.coins >= 0) state.coins = saved.coins;
    // Repair the inventory before trusting the equipped rod: a save from before
    // this feature has no 'owned' list at all.
    state.owned = startingInventory();
    if (Array.isArray(saved.owned)) {
      for (const id of saved.owned) state.owned = addRodToInventory(state.owned, id);
    }
    // Only equip something actually owned, otherwise the HUD would lie.
    if (RODS[saved.rodId] && ownsRod(state.owned, saved.rodId)) state.rodId = saved.rodId;
    else if (!ownsRod(state.owned, state.rodId)) state.rodId = state.owned[0];
    if (saved.bestiary && typeof saved.bestiary === 'object') state.bestiary = saved.bestiary;

    // Rank. Absent in every save written before ranks existed; that is rank 1.
    if (Number.isFinite(saved.xp) && saved.xp >= 0) state.xp = saved.xp;

    // Seals. Filtered against the real table so a save naming a seal that no
    // longer exists cannot put a ghost on the dock.
    state.ownedSeals = Array.isArray(saved.ownedSeals)
      ? saved.ownedSeals.filter((id) => SEALS.some((seal) => seal.id === id))
      : [];
    // Only honour an equipped seal we actually own, or the HUD would lie.
    state.equippedSeal = state.ownedSeals.includes(saved.equippedSeal)
      ? saved.equippedSeal
      : null;

    state.lost = Array.isArray(saved.lost)
      ? saved.lost.filter((id) => LOST_ITEMS.some((item) => item.id === id))
      : [];
    // Seal coins. A save from BEFORE the split has no sealCoins key at all, and
    // its lost items were paid straight into the rod wallet at the time -- so
    // those finds are already sold and must not be paid for a second time.
    //
    // The test for "before the split" is the ABSENCE of the key. Testing the value
    // is wrong: Array.isArray(0) is false, so every save written since the split
    // (which stores sealCoins: 0) was treated as legacy and had its bag sold off
    // behind the player's back the moment they reloaded.
    state.sealCoins = Number.isFinite(saved.sealCoins) && saved.sealCoins > 0 ? saved.sealCoins : 0;
    if (!('sealCoins' in saved)) {
      state.lost = [];
    }
    // Duplicate count. Absent in every save written before it existed.
    if (Number.isFinite(saved.duplicates) && saved.duplicates > 0) {
      state.duplicates = saved.duplicates;
    }
    // The bag. Filtered against the fish table so a save naming a fish that
    // no longer exists cannot put a ghost in the bag.
    const storedBag = Array.isArray(saved.bag) ? saved.bag : saved.creel;
    state.bag = Array.isArray(storedBag)
      ? storedBag.filter((e) => e && FISH.some((f) => f.id === e.fishId))
      : [];
    // Bond, per seal. Unknown seal ids are dropped for the same reason.
    state.bond = saved.bond && typeof saved.bond === 'object'
      ? Object.fromEntries(
        Object.entries(saved.bond)
          .filter(([id, n]) => SEALS.some((s) => s.id === id) && Number.isFinite(n) && n > 0),
      )
      : {};
    // Rods already handed over. An old save has none, which correctly means the
    // player has not been gifted yet -- they will be, on their first arrival.
    state.giftedRods = Array.isArray(saved.giftedRods)
      ? saved.giftedRods.filter((id) => RODS[id])
      : [];
    // A saved lake is only honoured if it is genuinely open. A save naming a lake
    // the player has not earned must not drop them into the Mythical water.
    if (typeof saved.areaId === 'string') {
      const area = AREAS.find((a) => a.id === saved.areaId);
      if (area && areaUnlocked(area, state)) state.areaId = area.id;
    }

    // Normalise the rename now rather than on the next change: a legacy save
    // with `creel` is rewritten as `bag` the moment it loads, so the migration
    // happens once instead of on every load, and no save ever holds both keys.
    if (Array.isArray(saved.creel)) save();
  } catch {
    // Corrupt or blocked storage: the fresh loadout above already stands.
  }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      coins: state.coins, rodId: state.rodId, owned: state.owned, bestiary: state.bestiary,
      areaId: state.areaId,
      // Rank and companions. A save predating these simply has none of them, and
      // load() repairs each field rather than dropping the whole save.
      xp: state.xp,
      ownedSeals: state.ownedSeals,
      equippedSeal: state.equippedSeal,
      lost: state.lost,
      sealCoins: state.sealCoins,
      giftedRods: state.giftedRods,
      bag: state.bag,
      bond: state.bond,
      // Duplicates ever handed over. It was bumped in memory and never written
      // anywhere, so it only ever existed for the session that counted it.
      duplicates: state.duplicates ?? 0,
    }));
  } catch {
    // Storage blocked: the session still plays, it just will not persist.
  }
}

/* ------------------------------------------------------------------ chrome */

/** Draw the equipped rod. This is what makes buying a rod visible. */
function paintRod() {
  const art = rodArt(state.rodId);
  const at = art.pointAt;
  const pt = (t) => {
    const p = at(t);
    return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  };
  const seg = (from, to) => `M${pt(from)} L${pt(to)}`;

  // A blank tapers; SVG cannot taper a single stroke, so the butt is a second,
  // fatter round-capped stroke meeting the shaft. Same colour, so the join reads
  // as one swelling piece of carbon rather than two shapes.
  ui.rodHeel?.setAttribute('d', seg(0, 0.34));
  ui.rodHeel?.setAttribute('stroke', art.colour);
  ui.rodHeel?.setAttribute('stroke-width', String(art.heelWidth));

  ui.rodShaft?.setAttribute('d', art.path);
  ui.rodShaft?.setAttribute('stroke', art.colour);
  ui.rodShaft?.setAttribute('stroke-width', String(art.width));

  // The Frutiger finish: how wet the blank looks, whether it picks up a chrome
  // highlight, and the beads caught along it. This is what makes two rods read as
  // different OBJECTS rather than the same stick in two colours.
  const finish = art.finish ?? {};
  const sheen = Number.isFinite(finish.sheen) ? finish.sheen : 0;
  const accent = finish.accent ?? '#ffffff';

  ui.rodGloss?.setAttribute('d', seg(0.18, 0.98));
  ui.rodGloss?.setAttribute('stroke-width', String(Math.max(art.width * (0.18 + sheen * 0.32), 0.4)));
  // A mirror-finish rod gets a hard white line; a matte one barely catches light.
  ui.rodGloss?.setAttribute('stroke-opacity', String(0.12 + sheen * 0.62));

  const styles = art.blank ?? [];
  ui.rodChrome?.setAttribute('d', finish.chrome ? seg(0.3, 0.94) : '');
  if (finish.chrome) {
    ui.rodChrome.setAttribute('stroke', '#ffffff');
    ui.rodChrome.setAttribute('stroke-opacity', String(0.35 + sheen * 0.5));
    ui.rodChrome.setAttribute('stroke-width', String(Math.max(art.width * 0.16, 0.22)));
  }

  ui.rodStripe?.setAttribute('d', seg(0.2, 0.96));
  ui.rodStripe?.setAttribute('stroke', styles.includes('stripe') ? accent : '#ffffff');
  ui.rodStripe?.setAttribute('stroke-opacity', styles.includes('stripe') ? '.75' : '.3');
  ui.rodStripe?.setAttribute('stroke-width', String(Math.max(art.width * 0.26, 0.35)));

  // The grip, in cork, EVA or crystal -- the part your hand actually reads.
  ui.rodGrip?.setAttribute('d', seg(art.gripFrom, art.gripTo));
  ui.rodGrip?.setAttribute('stroke', art.gripColour);
  ui.rodGrip?.setAttribute('stroke-width', String(art.width * 1.55));

  // Beads. More of them and brighter as the rod gets dearer, so the ladder reads.
  if (ui.rodBeads) {
    ui.rodBeads.textContent = '';
    const r0 = Math.max(art.width * 0.34, 0.42);
    for (const t of finish.beads ?? []) {
      const at2 = at(t);
      const bead = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bead.setAttribute('cx', String(at2.x));
      bead.setAttribute('cy', String(at2.y));
      bead.setAttribute('r', String(r0));
      // A bubble: pale centre, accent rim, one specular dot.
      bead.setAttribute('fill', '#ffffff');
      bead.setAttribute('fill-opacity', String(0.35 + sheen * 0.45));
      bead.setAttribute('stroke', accent);
      bead.setAttribute('stroke-opacity', String(0.4 + sheen * 0.45));
      bead.setAttribute('stroke-width', String(Math.max(r0 * 0.28, 0.12)));
      ui.rodBeads.appendChild(bead);

      const spark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      spark.setAttribute('cx', String(at2.x - r0 * 0.3));
      spark.setAttribute('cy', String(at2.y - r0 * 0.3));
      spark.setAttribute('r', String(r0 * 0.28));
      spark.setAttribute('fill', '#ffffff');
      spark.setAttribute('fill-opacity', String(0.5 + sheen * 0.45));
      ui.rodBeads.appendChild(spark);
    }
  }

  // Line guides, bigger at the butt and finer toward the tip, as they are fitted.
  if (ui.rodGuides) {
    ui.rodGuides.textContent = '';
    for (const g of art.guidePoints) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(g.x));
      ring.setAttribute('cy', String(g.y));
      ring.setAttribute('r', String(g.r));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#e8f6ff');
      ring.setAttribute('stroke-opacity', '.85');
      ring.setAttribute('stroke-width', String(Math.max(g.r * 0.4, 0.18)));
      ui.rodGuides.appendChild(ring);
    }
  }

  // The reel, for the rods that carry one. A bamboo stick has none, and showing
  // furniture the rod does not have is what made them all look alike.
  if (ui.rodReel) {
    if (!art.reelR) {
      ui.rodReel.setAttribute('hidden', '');
    } else {
      ui.rodReel.removeAttribute('hidden');
      const { x, y } = art.reelAt;
      ui.rodReelBody?.setAttribute('cx', String(x));
      ui.rodReelBody?.setAttribute('cy', String(y));
      ui.rodReelBody?.setAttribute('r', String(art.reelR));
      ui.rodReelBody?.setAttribute('stroke', '#dfe9f2');
      ui.rodReelBody?.setAttribute('stroke-width', String(Math.max(art.reelR * 0.3, 0.2)));
      ui.rodReelHub?.setAttribute('cx', String(x));
      ui.rodReelHub?.setAttribute('cy', String(y));
      ui.rodReelHub?.setAttribute('r', String(art.reelR * 0.28));
      ui.rodReelHub?.setAttribute('fill', finish.accent ?? art.colour);
      // A crank arm, so the reel turns rather than sitting there as a ring.
      ui.rodReelArm?.setAttribute('d',
        `M${x} ${y} L${x + art.reelR * 0.9} ${y + art.reelR * 0.5}`);
      ui.rodReelArm?.setAttribute('stroke', '#dfe9f2');
      ui.rodReelArm?.setAttribute('stroke-width', String(Math.max(art.reelR * 0.24, 0.16)));
    }
  }

  ui.rodTipDot?.setAttribute('cx', String(art.tipX));
  ui.rodTipDot?.setAttribute('cy', String(art.tipY));
  ui.rodTipDot?.setAttribute('fill', art.colour);
  ui.rodTipDot?.setAttribute('r', String(1 + art.width / 3));
  // The line starts at the rod's new tip, so move it there immediately.
  placeBobber(parseFloat(ui.bobber.style.left) || 60, parseFloat(ui.bobber.style.top) || 70);
}

/**
 * Every boost the player is carrying, always visible.
 *
 * Luck is rod + rank + seal + weather and it decides which fish you meet, but
 * nothing on screen ever showed it. You could own the best rod in the game and
 * have no way to tell it did anything. Every row is always present: a row reading
 * zero says "not earned yet", where a missing row reads as a bug.
 */
function paintBoosts() {
  if (!ui.boostList || !ui.boostTotal) return;
  const current = rod();
  const rank = levelFrom({ xp: state.xp }).level;
  const seal = SEALS.find((item) => item.id === state.equippedSeal) ?? null;
  const sky = state.sky ?? skyFor(state.areaId);

  const rows = [
    // Named, not labelled: a row reading "Rod" says a rod is paying you but
    // not which one, so swapping rods changed the total with nothing on screen
    // to account for it. Same for the seal.
    { key: 'rod', name: current ? current.name : 'No rod', value: Number(current?.luck) || 0 },
    { key: 'rank', name: `Rank ${rank}`, value: luckFromLevel(rank) },
    { key: 'seal', name: seal ? seal.name : 'No seal', value: Number(seal?.luck) || 0 },
    // Fed fish. Its own row rather than folded into the seal's, so the player can
    // see what feeding bought -- otherwise the seal row would silently grow and
    // there would be no way to tell feeding from a better seal.
    {
      key: 'bond',
      name: seal ? `${seal.name}'s bond` : 'Seal bond',
      value: bondLuck(seal ? bondCount(state.bond, seal.id) : 0),
    },
    // Weather's own contribution only. The seal is a row of its own, so folding
    // it in here too would show every boost twice.
    {
      key: 'weather',
      name: `${sky.weather.name}, ${sky.time.name}`,
      value: Math.round((luckFromSky(sky.time, sky.weather) - 1) * 100) / 100,
    },
  ];

  ui.boostList.textContent = '';
  for (const row of rows) {
    const el = document.createElement('span');
    el.className = 'lake__boost' + (row.value > 0 ? '' : ' lake__boost--none');
    // Keyed by source, not label: the seal row is titled with the seal's own name.
    el.dataset.key = row.key;
    // Titled on the row as well, so hovering or a screen reader says which
    // source is being quoted rather than leaving a bare figure.
    el.title = row.name + ': ' + row.value + ' luck';
    const name = document.createElement('span');
    name.className = 'lake__boost-name';
    name.textContent = row.name;
    const value = document.createElement('span');
    value.className = 'lake__boost-value';
    value.textContent = row.value ? String(row.value) : '0';
    el.append(name, value);
    ui.boostList.appendChild(el);
  }

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  ui.boostTotal.textContent = String(Math.round(total * 100) / 100);
  ui.boostTotal.dataset.luck = String(total);
}

/** What is in the bag, and what selling it would pay. */
function paintFinds() {
  if (!ui.findsList || !ui.sellFinds) return;
  const bag = Array.isArray(state.lost) ? state.lost : [];
  const worth = bag.reduce((sum, id) => sum + (lostItemById(id)?.value ?? 0), 0);
  paintFindRows(bag);

  if (bag.length === 0) {
    ui.findsList.textContent = 'Nothing in the bag yet. Fish a while.';
    ui.sellFinds.disabled = true;
    ui.sellFinds.textContent = 'Sell your finds';
    return;
  }
  // Grouped by name, so a bag of nine of the same thing reads as nine.
  const tally = new Map();
  for (const id of bag) tally.set(id, (tally.get(id) ?? 0) + 1);
  const list = [...tally.entries()]
    .map(([id, n]) => `${lostItemById(id)?.name ?? id}${n > 1 ? ` ×${n}` : ''}`)
    .join(', ');
  ui.findsList.textContent = `${bag.length} found: ${list}. Worth ${worth} seal coins.`;
  ui.sellFinds.disabled = false;
  ui.sellFinds.textContent = `Sell all ${bag.length} for ${worth} seal coins`;
}

/** Sell the whole bag into Seal coins. Rod coins are never touched. */
/**
 * One row per distinct find, so a bag of seven of something can part with one.
 * There was a single button for the whole bag, so the only choice on offer was
 * sell everything or sell nothing.
 */
function paintFindRows(bag) {
  if (!ui.findsRows) return;
  ui.findsRows.textContent = '';

  const tally = new Map();
  for (const id of bag) tally.set(id, (tally.get(id) ?? 0) + 1);

  for (const [id, n] of tally) {
    const item = lostItemById(id);
    if (!item) continue;

    const row = document.createElement('div');
    row.className = 'find';

    const what = document.createElement('div');
    what.className = 'find__what';

    const name = document.createElement('span');
    name.className = 'find__name';
    name.textContent = item.name;
    what.appendChild(name);

    if (n > 1) {
      const count = document.createElement('span');
      count.className = 'find__count';
      count.textContent = `\u00d7${n}`;
      what.appendChild(count);
    }

    const value = document.createElement('span');
    value.className = 'find__value';
    value.textContent = `${item.value} each`;
    what.appendChild(value);

    const sell = document.createElement('button');
    sell.className = 'btn btn--small btn--tiny find__sell';
    sell.textContent = 'Sell one';
    sell.addEventListener('click', () => sellOne(id, item));

    row.append(what, sell);
    ui.findsRows.appendChild(row);
  }
}

/** Sell a single find, leaving the rest of the bag alone. */
function sellOne(id, item) {
  // The FIRST of that item, so the count on its row stays honest.
  const at = state.lost.indexOf(id);
  if (at === -1) return;
  const sold = sellLostItems(state.lost.slice(at, at + 1), 1);
  if (!sold.ok) return say(sold.reason);
  state.sealCoins += sold.sealCoins;
  state.lost = [...state.lost.slice(0, at), ...state.lost.slice(at + 1)];
  say(`Sold one ${item.name} for ${sold.sealCoins} seal coins.`);
  save();
  paintFinds();
  paintChrome();
  renderSealShop();
}

function sellFinds() {
  const sold = sellLostItems(state.lost);
  if (sold.count === 0) return;
  state.sealCoins += sold.sealCoins;
  state.lost = sold.held;
  say(`Sold ${sold.count} thing${sold.count === 1 ? '' : 's'} for ${sold.sealCoins} seal coins.`);
  save();
  paintFinds();
  paintChrome();
  renderSealShop();
}

/**
 * Say something out of the seal's mouth.
 *
 * A bubble rather than only the message line: the message line is shared, so a
 * sale or a gift would overwrite the seal's opinion. The bubble belongs to the
 * pet and nothing else competes for it.
 */
function hideBubble() {
  if (!ui.bubble) return;
  clearTimeout(state.bubbleTimer);
  state.bubbleTimer = null;
  ui.bubble.classList.remove('is-speaking');
  ui.bubble.setAttribute('hidden', '');
  ui.bubbleText.textContent = '';
}

/** How long a line stays up. Long enough to actually read it. */
const BUBBLE_MS = 4200;

function sealSays(line, ms = BUBBLE_MS) {
  if (!ui.bubble) return;
  clearTimeout(state.bubbleTimer);
  state.bubbleTimer = null;

  // No seal, or nothing to say: the bubble goes away entirely. It must not sit
  // there empty, and it must not keep the last line on screen.
  if (!line || !String(line).trim()) {
    hideBubble();
    return;
  }

  // No truncation any more. The bubble is HTML and wraps, so cutting the words off
  // at 42 characters was solving a problem that no longer exists -- and it cut off
  // half the sentence.
  ui.bubbleText.textContent = String(line);
  ui.bubble.classList.add('is-speaking');
  ui.bubble.removeAttribute('hidden');

  // It disappears on its own. A bubble that never fades leaves stale words up
  // long after the seal stopped talking.
  if (ms > 0) {
    state.bubbleTimer = setTimeout(hideBubble, ms);
  }
}

/**
 * Have the seal say something on its own.
 *
 * Called when a seal is equipped and whenever the player returns to idle, so the
 * dock is not silent. `n` advances which idle line comes out, which keeps it
 * deterministic for tests.
 */
let chatter = 0;
function sealChatter() {
  const seal = SEALS.find((item) => item.id === state.equippedSeal) ?? null;
  if (!seal) return;
  chatter += 1;
  sealSays(sealIdleLine(seal, { areaId: state.areaId, count: chatter }));
}

/**
 * A brief card for a find, a duplicate, a gift or a sale.
 *
 * These STACK. It used to clear the container first, so a find raised at the same
 * moment as a duplicate wiped the duplicate away -- and the seal speaks on the same
 * catch, so the two things worth knowing collide constantly. Each card times itself
 * out, and the cap stops a long unlucky run from covering the lake.
 */
const NOTICE_MS = 4200;
const NOTICE_MAX = 3;
let noticeTimers = new Set();

function notify(text, tone = '') {
  if (!ui.notify || !text) return;
  const card = document.createElement('div');
  card.className = 'notice' + (tone ? ` notice--${tone}` : '');
  card.textContent = text;
  ui.notify.appendChild(card);

  // Trim the oldest rather than clearing everything: an old notice going stale is
  // fine, but a find must not erase a duplicate that arrived after it.
  while (ui.notify.children.length > NOTICE_MAX) {
    ui.notify.firstElementChild?.remove();
  }

  const timer = setTimeout(() => {
    card.remove();
    noticeTimers.delete(timer);
  }, NOTICE_MS);
  noticeTimers.add(timer);
}

/** Drop every notice. Used when a reset or a lake change should clear the slate. */
function clearNotices() {
  for (const t of noticeTimers) clearTimeout(t);
  noticeTimers = new Set();
  if (ui.notify) ui.notify.textContent = '';
}

/** The seal on the dock, tinted per seal and hidden when there is none. */
function paintPet() {
  if (!ui.pet) return;
  const seal = SEALS.find((item) => item.id === state.equippedSeal) ?? null;
  // Hide the WRAPPER, not the pet: parentNode is the fitted group, and the pet
  // is its own nearest 'g' ancestor, so closest('g') here returns the pet itself
  // and the wrapper -- the thing that is actually visible -- never changes.
  const holder = ui.pet?.parentNode;
  if (holder) {
    if (seal) holder.removeAttribute('hidden');
    else holder.setAttribute('hidden', '');
  }
  if (!seal) { sealSays(''); return; }
  fitPet();
  const stops = ui.pet.querySelectorAll('stop');
  if (stops[1]) stops[1].setAttribute('stop-color', `hsl(${seal.hue} 82% 74%)`);
  if (stops[2]) stops[2].setAttribute('stop-color', `hsl(${seal.hue} 62% 30%)`);
}

function paintChrome() {
  const current = rod();
  ui.coins.textContent = state.coins;
  if (ui.sealWallet) ui.sealWallet.textContent = state.sealCoins;
  ui.rod.textContent = current.name;
  ui.rodStats.textContent =
    `control ${current.control.toFixed(2)} · resilience ${current.resilience.toFixed(2)} · ` +
    `luck ${current.luck.toFixed(1)} · up to ${current.maxKg} kg`;
  const found = Object.keys(state.bestiary).length;
  ui.bestiary.textContent = `${found}/${FISH.length} species landed`;

  // Rank. Deliberately not a fish count: it moves on every catch, junk included.
  const rank = levelFrom({ xp: state.xp });
  if (ui.level) ui.level.textContent = String(rank.level);
  if (ui.levelTitle) ui.levelTitle.textContent = rank.title;
  // The bar shows progress toward the NEXT rank, so a single small catch moves
  // something even when the level number does not.
  if (ui.levelBar) {
    const floor = xpForLevel(rank.level);
    const span = Math.max(1, rank.next - floor);
    ui.levelBar.value = Math.min(span, Math.max(0, rank.xp - floor));
    ui.levelBar.max = span;
    ui.levelBar.dataset.xp = String(rank.xp);
    ui.levelBar.dataset.level = String(rank.level);
  }
  paintPet();
  paintBoosts();
  paintFinds();

  // The button says how many rods you carry, so the inventory is findable at a glance.
  if (ui.inventoryCount) {
    const rods = state.owned.length;
    ui.inventoryCount.textContent = `${rods} ${rods === 1 ? 'rod' : 'rods'}`;
  }
  paintRod();
}

function setPhase(phase) {
  state.phase = phase;
  ui.lake.dataset.phase = phase;
  ui.cast.hidden = phase !== 'casting';
  ui.reel.hidden = phase !== 'reeling';
  ui.catch.hidden = phase !== 'result';
  if (ui.bite) ui.bite.hidden = phase !== 'bite';
  if (phase !== 'waiting') clearShake();
}

function say(text) {
  ui.message.hidden = !text;
  ui.message.textContent = text || '';
}

/* ------------------------------------------------------------------- shake */

/** Throw a SHAKE prompt at a random spot. Missing one only costs time. */
function throwShake() {
  if (ui.lake.querySelectorAll('.shake').length >= SHAKE_MAX_ON_SCREEN) return;
  const button = document.createElement('button');
  button.className = 'shake';
  button.type = 'button';
  button.textContent = 'SHAKE';
  const w = ui.lake.clientWidth || 320;
  const h = ui.lake.clientHeight || 240;
  button.style.left = `${40 + Math.random() * Math.max(1, w - 150)}px`;
  button.style.top = `${40 + Math.random() * Math.max(1, h - 170)}px`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    state.biteAt -= SHAKE_BONUS_MS;
    button.remove();
  });
  button.addEventListener('mousedown', (event) => event.stopPropagation());
  ui.lake.appendChild(button);
}

function clearShake() {
  clearInterval(state.shakeTimer);
  state.shakeTimer = null;
  for (const node of ui.lake.querySelectorAll('.shake')) node.remove();
}

/**
 * Where the rod tip actually renders, as a percentage of the lake.
 *
 * This has to be measured, not read from the lure's cx/cy: those are pre-transform
 * viewBox units, and the scene uses preserveAspectRatio="none" plus a counter-scale
 * on the figure group. Reading the attributes gave a point that was nowhere near
 * where the rod actually ended, so the line started in mid-air.
 */
function rodTip() {
  const lure = ui.lake.querySelector('.scene__lure');
  if (!lure || !ui.lake.getBoundingClientRect) return { x: 60, y: 33 };

  const lake = ui.lake.getBoundingClientRect();
  const dot = lure.getBoundingClientRect();
  if (!lake.width || !lake.height || !dot.width) return { x: 60, y: 33 };

  return {
    x: ((dot.left + dot.width / 2 - lake.left) / lake.width) * 100,
    y: ((dot.top + dot.height / 2 - lake.top) / lake.height) * 100,
  };
}

/**
 * The scene stretches to fill the lake, so a square viewBox on a wide box turns the
 * round blob into an oval. Undo that for the figure group only: scale x by the
 * ratio of the lake's height to its width, about the blob's own centre.
 */
function fitFigure() {
  const group = document.getElementById('angler-fit');
  const box = ui.lake.getBoundingClientRect();
  if (!group || !box.width || !box.height) return;

  // viewBox units are already stretched by width:height; correcting x by
  // height/width makes one unit the same number of pixels on both axes.
  const scale = box.height / box.width;
  group.setAttribute('transform', `translate(33.2 0) scale(${scale.toFixed(4)} 1) translate(-33.2 0)`);
}

/**
 * Counter-stretch the pet.
 *
 * The scene is drawn with preserveAspectRatio="none", so viewBox units are
 * stretched to the lake's shape. #angler-fit corrects that for the angler; the
 * pet cannot live in that group (it would travel with his shoulder) and so had no
 * correction at all -- which is why the seal came out as a wide smear on any lake
 * that is not square. Same maths, anchored on the pet's own centre.
 */
function fitPet() {
  const group = document.getElementById('fa-pet-fit');
  const box = ui.lake.getBoundingClientRect();
  if (!group || !box.width || !box.height) return;
  const scale = box.height / box.width;
  // PET_Y lifts the seal onto the pier deck: its belly is drawn at y=49.6 and
  // the deck's top edge is at y=58, so without this it floated above the boards.
  // The shift rides here rather than in the drawing so the artwork keeps plain
  // coordinates and stays assertable.
  const PET_Y = 8.2;
  // The seal is longer now, so its centre moved to x=13.
  //
  // FACE_X must be 13 -- the SEAL's own anchor, not the glyph's centre. That is
  // what makes the two corrections cancel exactly: the outer squeeze scales x by
  // s about 13, and this scales it back by 1/s about the same point, so together
  // they are a pure translation and the face never moves relative to the body,
  // whatever shape the lake is.
  //
  // Anchored anywhere else the two do NOT cancel, and the face slides by
  // (1 - s) * (13 - FACE_X) -- about 2 units on a wide desktop, and changing as
  // the window changes shape. It was 20.4 for several passes, which is the
  // UPRIGHT glyph's centre rather than even the turned one: a 1.45-unit error
  // before any window was considered, and the reason a face that fitted the
  // markup hung off the animal's shoulder.
  const FACE_X = 13;
  group.setAttribute('transform',
    `translate(13 0) scale(${scale.toFixed(4)} 1) translate(-13 0) translate(0 ${PET_Y})`);

  // The face gets the INVERSE correction.
  //
  // The outer scale above exists to stop the seal being stretched by
  // preserveAspectRatio="none", and at a typical lake aspect it is around 0.5 --
  // which halves the eyes and thins a 0.8 mouth stroke to 0.4. On a seal about
  // 60px wide on screen that is a sub-pixel hairline, so the :3 was correct in the
  // markup and invisible in the game. That is what "the :3 face isnt there" meant.
  //
  // Correcting x here cancels the outer squeeze exactly: the face lands at the
  // size it is drawn while the body stays round. FACE_X is the face's own centre,
  // so it does not slide sideways as the lake changes shape.
  const face = document.getElementById('pet-face');
  if (face) {
    const inv = 1 / scale;
    face.setAttribute('transform',
      `translate(${FACE_X} 0) scale(${inv.toFixed(4)} 1) translate(${-FACE_X} 0)`);
  }
}
/** Move the bobber, its splash and the fishing line together. */
function placeBobber(left, top) {
  ui.bobber.style.left = `${left}%`;
  ui.bobber.style.top = `${top}%`;
  ui.splash.style.left = `${left}%`;
  ui.splash.style.top = `${top}%`;
  // The line runs from the measured rod tip to the bobber. Both ends are
  // percentages of the lake, which is exactly what the scene's 0..100 viewBox
  // maps to, so the bobber end is simply (left, top) — it must NOT be
  // interpolated, which put the line's end short of the bobber.
  const tip = rodTip();
  const x = left;
  const y = top;
  ui.line?.setAttribute('d',
    `M${tip.x.toFixed(2)} ${tip.y.toFixed(2)} `
    + `Q${((tip.x + x) / 2).toFixed(2)} ${((tip.y + y) / 2 + 6).toFixed(2)} `
    + `${x.toFixed(2)} ${y.toFixed(2)}`);
}

/* -------------------------------------------------------------------- cast */

/**
 * Can we fish where we are standing?
 *
 * A lake gated on a rod trait is not fishable without that trait, so the cast is
 * refused here rather than after the bobber has already flown. Moving to such a
 * lake is still allowed — it is how you see what you are missing — but you cannot
 * fish it until the rod is right.
 */
function canCastHere() {
  const check = rodCheckIn(state.rodId, state.areaId);
  if (!check.ok) say(check.reason);
  return check.ok;
}

function beginCast() {
  // Refuse before the bobber flies, so a gated lake is never fished by accident.
  if (!canCastHere()) return;
  state.meter = 0;
  state.holding = true;
  say('');
  setPhase('casting');
}

function releaseCast() {
  const quality = castQuality(state.meter);
  const reach = castDistance(quality);
  ui.lake.style.setProperty('--cast-ms', `${Math.round(320 + reach * 420)}ms`);
  // A longer cast lands further right, in open water rather than on the pier.
  placeBobber(46 + reach * 42, 70 + reach * 16);
  ui.splash.classList.add('is-on');

  state.biteAt = performance.now() + biteDelayFor(rod());
  setPhase('waiting');
  state.shakeTimer = setInterval(throwShake, SHAKE_INTERVAL_MS);
}

/**
 * Put the hooked fish's silhouette into the reel track.
 *
 * Shape only -- no name, no rarity, no colour. The player should learn what is on
 * the line by fighting it, and the reel track is where that fight is read.
 */
function paintFishSilhouette(fish) {
  if (!ui.reelFish || !fish) return;
  ui.reelFish.innerHTML = fishSilhouette(fish);
}

/**
 * Something took the bait. Wait for the player to click SET HOOK before the reel
 * minigame starts — the fight used to begin on its own, with the player already
 * holding, which meant the hook was never really theirs to set.
 */
function hookSet(fish) {
  clearShake();
  state.bitten = fish;
  state.hookAt = performance.now() + HOOK_WINDOW_MS;
  setPhase('bite');
  say('Click SET HOOK');
  if (ui.bite) ui.bite.hidden = false;
}

function hook(fish) {
  clearShake();
  if (ui.bite) ui.bite.hidden = true;
  state.bitten = null;
  state.hooked = fish;
  // The fish gets a say the moment the hook goes in, so the fight starts with a
  // sense of what you have on the line rather than a bare bar.
  ui.reelLine.textContent = hookLineFor(fish);

  // And now you can SEE what you hooked. This was a 4px yellow bar, so every fish
  // in the game looked the same and the player had nothing to read. Drawn once
  // here rather than in stepReel(): the shape does not change during the fight,
  // and rebuilding 642 bytes of SVG every frame would be absurd.
  paintFishSilhouette(fish);
  const cfg = reelConfig({
    fight: fish.fight,
    control: rod().control,
    resilience: rod().resilience,
  });
  // dir is the fish's heading: +/-1. It must persist across frames or the
  // fish would re-roll its direction every time and never travel anywhere.
  state.reel = { cfg, fishX: 0.5, playerX: 0.5, progress: 0.34, dir: Math.random() < 0.5 ? -1 : 1 };
  setPhase('reeling');
  say('');
}

/* ------------------------------------------------------------------- reel */

function stepReel() {
  const r = state.reel;
  const next = advance(r.cfg, {
    fishX: r.fishX,
    playerX: r.playerX,
    progress: r.progress,
    holding: state.holding,
    dir: r.dir,
  }, REEL_DT);

  r.fishX = next.fishX;
  r.playerX = next.playerX;
  r.progress = next.progress;
  r.dir = next.dir;      // carry the heading forward

  ui.reelPlayer.style.width = `${r.cfg.playerWidth * 100}%`;
  ui.reelPlayer.style.left = `${r.playerX * 100 - (r.cfg.playerWidth / 2) * 100}%`;
  ui.reelFish.style.left = `${r.fishX * 100}%`;
  ui.reelFill.style.width = `${r.progress * 100}%`;

  const outcome = reelOutcomeFor(r.progress);
  if (outcome === isCaught) landFish();
  else if (outcome === lineSnapped) loseFish(`${state.hooked.name} got away.`);
}

/** Rarity as a row of blocks: one per tier, filled up to this fish's. */
function paintRarity(rarity) {
  if (!ui.rarity) return;
  const level = RARITY_ORDER.indexOf(rarity) + 1;
  ui.rarity.textContent = '';
  for (let i = 0; i < RARITY_ORDER.length; i += 1) {
    const pip = document.createElement('span');
    pip.className = i < level ? 'catch__pip is-on' : 'catch__pip';
    ui.rarity.appendChild(pip);
  }
  ui.rarity.setAttribute('aria-label', `Rarity ${level} of ${RARITY_ORDER.length}: ${rarity}`);
}

function showResult(name, meta, value, rarity, art = null, stats = null, mutation = null) {
  ui.catchName.textContent = name;
  // Colour carries the rarity at a glance; the pips below give the exact tier.
  ui.catchName.style.color = rarity ? RARITY_COLOURS[rarity] : '#e07b2a';
  paintRarity(rarity);
  ui.catchMeta.textContent = meta;
  ui.catchValue.textContent = `¤ ${value}`;

  // The drawing and the two headline numbers, shown only when there is a fish.
  // A snapped line has no fish, so the art is cleared rather than left stale.
  if (ui.catchArt) ui.catchArt.innerHTML = art ?? '';
  if (ui.catchWeight) ui.catchWeight.textContent = stats?.weight ?? '—';
  if (ui.catchWorth) ui.catchWorth.textContent = art ? `¤ ${value}` : '—';

  // The mutation is the headline when there is one. A Crowned fish is 5x value and
  // used to show only as the word "Crowned" buried in the meta line, which reads
  // like part of the fish's name.
  if (ui.catchMutation) {
    if (mutation && mutation.id !== 'none' && mutation.name) {
      ui.catchMutation.textContent = `${mutation.name} \u00d7${mutation.multiplier}`;
      ui.catchMutation.style.setProperty('--mutation-tint', mutation.colour ?? 'rgba(255,255,255,.85)');
      ui.catchMutation.removeAttribute('hidden');
    } else {
      // A plain catch shows nothing at all. An always-present badge teaches nothing.
      ui.catchMutation.setAttribute('hidden', '');
      ui.catchMutation.textContent = '';
      ui.catchMutation.style.removeProperty('--mutation-tint');
    }
  }

  setPhase('result');
  ui.catchAgain.focus();
}

function landFish() {
  const fish = state.hooked;
  const kg = fishWeight(fish);
  const current = rod();

  // The weight ceiling is the rod's real limit: land nothing heavier, or it snaps.
  if (!canCatch(fish, kg, current)) {
    return loseFish(
      `${fish.name} weighed ${kg} kg — over this rod's ${current.maxKg} kg limit.`
    );
  }

  const mutation = rollMutation();
  const value = catchValue(fish, kg, mutation.multiplier);
  const wasBest = state.bestiary[fish.id] ?? 0;
  // Into the bag, NOT the wallet. `state.coins += value` here meant every fish
  // was sold the instant it came over the side, so there was no choice to make:
  // a catch could be worth coins or worth bond, and it was always coins.
  //
  // Bestiary and rank still happen on landing -- the fish was caught either way.
  state.bag = addToBag(state.bag, fishEntrySpec(fish, kg, mutation));
  state.bestiary = recordCatch(state.bestiary, fish, kg);

  const meta = [
    fish.rarity,
    `${kg} kg`,
    mutation.name ? `${mutation.name} ×${mutation.multiplier}` : null,
    kg > wasBest ? 'new personal best!' : null,
  ].filter(Boolean).join(' · ');

  showResult(
    mutation.name ? `${mutation.name} ${fish.name}` : fish.name,
    meta, value, fish.rarity,
    fishSvg(fish), { weight: `${kg} kg` }, mutation,
  );

  // Rank, then junk, then the seal. Order matters only for the message: the seal
  // speaks last, because its line is the one worth remembering.
  state.xp += xpForCatch(fish, kg);

  // Junk comes up with the catch, and the rarer the fish the luckier the haul.
  const tier = Math.max(0, RARITY_ORDER.indexOf(fish.rarity));
  const found = rollLostItem(Math.random(), {
    rarityScale: 1 + tier * 0.22,
    lakeId: state.areaId,
  });
  if (found) {
    // It goes in the bag, not in your wallet. Selling is a deliberate act in the
    // seal shop, and it pays Seal coins -- junk used to be worth rod money the
    // instant it came up, which made the two economies impossible to tell apart.
    state.lost = [...state.lost, found.id];
    // A notice, not say(): the seal speaks on the same catch and would replace
    // this line before it could be read. This is also the only place the player is
    // told the item is Seal coins rather than rod coins.
    notify(`${found.name} \u2014 worth ${found.value} seal coins. Sell it in the shop.`, 'find');
  }

  // A duplicate is a second copy at the same hook, not a second entry in the
  // index — the index is what gates the next lake, and that must stay honest.
  const seal = SEALS.find((item) => item.id === state.equippedSeal) ?? null;

  // A duplicate is worth its own notice: it is the most surprising thing that
  // happens on a cast, and it used to share a line with everything else.
  const duplicated = sealDuplicates(seal, Math.random());
  if (duplicated) {
    // A second FISH, not a number. It used to increment a counter and post a
    // notice saying "two Glidefin, one hook" while the bag held exactly one --
    // the perk the seal was bought for did not exist.
    state.bag = addToBag(state.bag, fishEntrySpec(fish, kg, mutation));
    notify(`${seal.name} duplicates it \u2014 two ${fish.name}, one hook.`);
    state.duplicates = (state.duplicates ?? 0) + 1;
  }

  // The seal speaks into its own bubble, so a notice cannot overwrite its opinion.
  // It gets told what actually happened: junk came up with the catch, or this beat
  // the player's personal best. Both used to fall through to the generic line.
  sealSays(sealComment(seal, fish, {
    bestiary: state.bestiary,
    personalBest: kg > wasBest,
    junk: Boolean(found),
  }));

  save();
  paintChrome();
  paintBagBadge(Array.isArray(state.bag) ? state.bag.length : 0);
  // The bag may be open behind the catch card, and its grouped rows carry counts --
  // so it must be repainted, not merely badged.
  if (ui.bagPanel && !ui.bagPanel.hidden) paintBag();
  // And the Bond panel, if it is open: its head states the count, which
  // is exactly what a duplicate or a feed just changed.
  if (ui.bondPanel && !ui.bondPanel.hidden) paintBond();

}

function loseFish(reason) {
  showResult('Line snapped', reason, 0, null);
}

/* -------------------------------------------------------------------- shop */

/**
 * One row per rod, used by both panels. In the shop it can also buy; in the
 * inventory it only equips, because you already own it.
 */
function makeRodRow(id, { owned, onDone }) {
  const spec = RODS[id];
  const equipped = id === state.rodId;
  const art = rodArt(id);
  const affordable = state.coins >= spec.price;

  // Ask the rules what the gate is BEFORE the click. It used to be asked on click
  // with no area and no rank, so every gate was invisible: the row looked buyable
  // and only said "needs rank 12" after you pressed it. Owned rods are exempt --
  // the gate is on buying, and a gift rod has to stay usable.
  const rank = levelFrom({ xp: state.xp }).level;
  const gate = owned ? { ok: true } : buyRod(state, id, { areaId: state.areaId, level: rank });
  const locked = !gate.ok;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `rod${equipped ? ' rod--equipped' : ''}${locked ? ' rod--locked' : ''}`;
  button.dataset.rod = id;
  button.dataset.locked = String(locked);
  button.dataset.state = equipped ? 'equipped' : owned ? 'owned' : 'unowned';
  button.disabled = equipped || (!owned && (!affordable || locked));

  const tag = equipped ? 'equipped'
    : owned ? 'equip'
    : locked ? gate.reason
    : affordable ? 'buy' : 'not enough coins';
  button.innerHTML =
    `<span class="rod__row"><span>${spec.name}</span>`
    + `<span>${owned ? '<i class="rod__swatch" style="background:' + art.colour + '"></i>' : '¤' + spec.price}</span></span>`
    + `<span class="rod__stats">control ${spec.control.toFixed(2)} · resilience ${spec.resilience.toFixed(2)} · `
    + `luck ${spec.luck.toFixed(1)} · max ${spec.maxKg} kg</span>`
    + (spec.traits.length
        ? `<span class="rod__traits">${spec.traits.map((t) =>
            `<i class="rod__trait">${t}</i>`).join('')}</span>`
        : '')
    + `<span class="rod__blurb">${spec.blurb}</span>`
    + (spec.traits.length
        ? `<span class="rod__opens">opens ${AREAS.filter((a) => a.trait && spec.traits.includes(a.trait))
            .map((a) => a.name).join(', ')}</span>`
        : '')
    + `<span class="rod__state">${tag}</span>`;

  button.addEventListener('click', () => {
    if (owned) {
      const result = equipRod(state.owned, id);
      if (!result.ok) return;
      state.rodId = result.rodId;
    } else {
      const result = buyRod(state, id, { areaId: state.areaId, level: rank });
      if (!result.ok) {
        button.querySelector('.rod__state').textContent = result.reason;
        return;
      }
      state.coins = result.coins;
      state.owned = addRodToInventory(state.owned, id);
      state.rodId = id;
    }
    save();
    paintChrome();
    onDone();
  });

  return button;
}

/** A heading above a group of rows. */
function makeHeading(text) {
  const h = document.createElement('h3');
  h.className = 'shop__section';
  h.textContent = text;
  return h;
}

/**
 * The inventory: the rods you own (re-equip free) and every species, showing the
 * heaviest landed. Caught and uncaught fish are both listed so the bestiary reads
 * as a collection to work towards.
 */
function renderInventory() {
  ui.inventoryRods.textContent = '';
  for (const id of RODS_BY_PRICE) {
    if (ownsRod(state.owned, id)) {
      ui.inventoryRods.appendChild(makeRodRow(id, { owned: true, onDone: renderInventory }));
    }
  }

  ui.inventoryFish.textContent = '';
  let landed = 0;
  for (const fish of FISH) {
    const best = state.bestiary[fish.id];
    const got = typeof best === 'number' && best > 0;
    if (got) landed += 1;

    const row = document.createElement('div');
    row.className = 'species';
    row.dataset.caught = String(got);
    row.dataset.fish = fish.id;

    const name = document.createElement('span');
    name.className = 'species__name';
    name.textContent = fish.name;
    name.style.color = RARITY_COLOURS[fish.rarity] ?? '';

    const weight = document.createElement('span');
    if (got) {
      weight.className = 'species__weight';
      weight.textContent = `best ${best} kg`;
    } else {
      weight.className = 'species__none';
      weight.textContent = 'not caught';
    }

    row.append(name, weight);
    ui.inventoryFish.appendChild(row);
  }

  if (ui.inventoryEmpty) ui.inventoryEmpty.hidden = landed > 0;
}

/** The shop is for buying; what you own lives in the inventory. */
/* ------------------------------------------------------------------ lakes */

/**
 * Paint the scene with the lake's own light.
 *
 * The gradients are written as custom properties on the lake element so the CSS
 * picks them up, rather than restating every gradient in JS. The SVG stops inside
 * the scene still use their own defs, so the water ramp is retinted here too.
 */
/** Wash the scene with the hour and the weather. Called on every visit. */
function paintSky(sky) {
  if (!ui.lake || !sky) return;
  const { time, weather } = sky;
  // Kept, so the boost panel and the fish roll read the same weather
  // rather than each rolling their own.
  state.sky = { time, weather };
  ui.lake.style.setProperty('--sky-wash', time.tint);
  ui.lake.style.setProperty('--sky-depth', String(time.depth));
  ui.lake.style.setProperty('--veil', weather.tint);
  ui.lake.style.setProperty('--veil-alpha', String(weather.veil));
  ui.lake.dataset.sky = time.id;
  ui.lake.dataset.weather = weather.id;
  if (ui.skyName) ui.skyName.textContent = sky.label;
}

function paintArea(area) {
  const { skyTop, skyMid, skyFloor, water, accent, haze, sun } = area.palette;
  ui.lake.style.setProperty('--sky-top', skyTop);
  ui.lake.style.setProperty('--sky-mid', skyMid);
  ui.lake.style.setProperty('--sky-floor', skyFloor);
  ui.lake.style.setProperty('--water', water);
  ui.lake.style.setProperty('--accent', accent);
  ui.lake.style.setProperty('--haze-tint', haze);
  ui.lake.style.setProperty('--sun', sun);

  // The scene's own defs: the deep water gradient and the far shore.
  const stop = (id, colour, offset) => {
    const node = document.querySelector(`#${id} stop[offset="${offset}"]`);
    if (node) node.setAttribute('stop-color', colour);
  };
  stop('fa-water', water, '0');
  stop('fa-water', water, '0.35');
  stop('fa-water', water, '1');
  stop('fa-shore', skyMid, '0');
  stop('fa-shore', skyMid, '0.5');
  stop('fa-shore', water, '1');

  ui.lake.dataset.area = area.id;
  if (ui.lakeName) ui.lakeName.textContent = area.name;
  say(area.blurb);
}

/** The lake picker: every water, open or not, with a reason when it is shut. */
function renderLakes() {
  ui.lakeList.textContent = '';

  for (const area of AREAS) {
    const open = areaUnlocked(area, state);
    const here = area.id === state.areaId;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'lake-row';
    row.setAttribute('aria-disabled', open ? 'false' : 'true');
    if (here) row.setAttribute('aria-current', 'true');
    row.dataset.area = area.id;

    // A swatch of the lake itself, so the picker reads at a glance.
    const swatch = document.createElement('span');
    swatch.className = 'lake-row__swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background =
      `linear-gradient(180deg, ${area.palette.skyTop}, ${area.palette.skyMid} 46%, ${area.palette.water})`;

    const label = document.createElement('span');
    label.className = 'lake-row__label';
    const name = document.createElement('span');
    name.className = 'lake-row__name';
    name.textContent = area.name;
    const theme = document.createElement('span');
    theme.className = 'lake-row__theme';
    theme.textContent = area.theme;
    const blurb = document.createElement('span');
    blurb.className = 'lake-row__blurb';
    blurb.textContent = area.blurb;
    label.append(name, theme, blurb);

    const state_ = document.createElement('span');
    state_.className = 'lake-row__state';
    if (here) {
      state_.textContent = 'You are here';
    } else if (open) {
      state_.textContent = `${area.fish.length} species`;
    } else {
      // Say what is missing rather than just "locked": the fish, the rods, and
      // the trait, because the trait is the one you cannot buy your way past here.
      const p = areaProgress(area, state);
      const bits = [`${p.landed}/${p.total} fished`, `${p.rods}/${p.rodTotal} rods`];
      if (area.trait && !RODS[state.rodId].traits.includes(area.trait)) bits.push(`needs ${area.trait}`);
      state_.textContent = bits.join(' · ');
    }

    // A lake you have not the rod for is still travelable: arriving hands you that
    // lake's rod. Marking it disabled said you could not go there, which was true
    // before the arrival gift and is not any more. What it CANNOT do is let you
    // cast there with the rod in your hand, so that is what the row says now.
    const usable = rodWorksIn(state.rodId, area.id);
    if (!usable && open) row.dataset.needsRod = area.trait ?? 'a different rod';

    row.append(swatch, label, state_);
    if (area.trait) {
      const tag = document.createElement('span');
      tag.className = 'lake-row__trait';
      tag.textContent = usable ? area.trait : `${area.trait} — locked`;
      label.appendChild(tag);
    }
    if (open && !here) {
      // Travelling is allowed even without the right rod -- that is the point of
      // the arrival gift. Only casting is refused, and that is checked at the water.
      row.addEventListener('click', () => {
        // Going through visitArea() means a lake you cannot fish yet hands you
        // its own rod, once, already equipped -- so arriving somewhere locked to
        // your gear is never a dead end.
        const moved = visitArea(state, area.id);
        state.areaId = moved.areaId;
        state.owned = moved.owned;
        state.giftedRods = moved.giftedRods;
        state.rodId = moved.rodId;
        paintArea(area);
        paintSky(skyFor(area.id));
        paintChrome();
        save();
        renderLakes();
        closeLakes();
        if (moved.gifted) {
          say(`${RODS[moved.gifted].name} was lying by the water. It is yours now.`);
        } else {
          say(area.blurb);
        }
      });
    }
    ui.lakeList.appendChild(row);
  }
}

function openLakes() {
  renderLakes();
  ui.lakePanel.hidden = false;
  ui.lakePicker.setAttribute('aria-expanded', 'true');
}

function closeLakes() {
  ui.lakePanel.hidden = true;
  ui.lakePicker.setAttribute('aria-expanded', 'false');
}

/* ------------------------------------------------------------- fish index */

/** Every weight in the table, so per-fish odds can be a share of all casts. */
const TOTAL_WEIGHT = FISH.reduce((sum, f) => sum + f.weight, 0);

/**
 * The fish index: every species grouped by rarity, with the odds for each.
 *
 * Built from fishIndex() so the percentages are derived from the same weights
 * rollFish() uses, and cannot drift out of step with the real odds. Species the
 * player has not landed are dimmed, so the index doubles as a list of targets.
 */
/**
 * The seal shop. Prices are in the junk economy, so this deliberately shows a
 * different wallet figure from the rod shop next to it.
 */
function renderSealShop() {
  if (!ui.sealList) return;
  const rank = levelFrom({ xp: state.xp });
  // The seal shop shows SEAL coins, not rod coins. They are different currencies
  // and showing one number here made it look like the seal price was a rod price.
  ui.sealShopCoins.textContent = state.sealCoins;

  // Seal coins have exactly one source: selling finds. With no seal and nothing
  // on the dock, the shop is the only place that can say so -- otherwise five
  // priced seals and an empty dock just read as a bug.
  if (ui.sealHint) {
    if (state.ownedSeals.length === 0) {
      ui.sealHint.textContent =
        'No seal yet. Fish until something turns up in your finds bag, sell it, '
        + 'and the seal coins will pay for your first seal.';
      ui.sealHint.removeAttribute('hidden');
    } else {
      ui.sealHint.setAttribute('hidden', '');
      ui.sealHint.textContent = '';
    }
  }

  ui.sealList.textContent = '';
  paintFinds();

  // The progress the lake gate is judged against: every fish landed, every rod owned.
  const progress = { bestiary: state.bestiary, owned: state.owned };

  for (const seal of SEALS) {
    const owned = state.ownedSeals.includes(seal.id);
    const active = state.equippedSeal === seal.id;
    const home = AREAS.find((a) => a.id === seal.home);

    // Ask the real rules whether this can be bought, rather than re-deciding here.
    // buySeal() knows the rank cap, the lake gate and the price; asking it is the
    // only way the row cannot promise a sale the click would then refuse.
    const quote = owned
      ? { ok: true }
      : buySeal({ coins: state.sealCoins }, seal.id, rank.level, progress);
    const locked = !owned && !quote.ok;

    const row = document.createElement('div');
    row.className = 'seal'
      + (active ? ' seal--active' : '')
      + (owned ? '' : locked ? ' seal--locked' : ' seal--for-sale');
    row.innerHTML = `
      <div class="seal__head">
        <span class="seal__portrait" style="--seal-hue:${seal.hue}" aria-hidden="true"></span>
        <span class="seal__titles">
          <b class="seal__name">${seal.name}</b>
          <span class="seal__home">${home?.name ?? ''}</span>
        </span>
        ${locked ? `<span class="seal__lock">${quote.reason}</span>` : ''}
      </div>
      <p class="seal__line">${seal.line}</p>
      <p class="seal__perks">
        <span class="seal__perk">luck +${seal.luck.toFixed(1)}</span>
        <span class="seal__perk">duplicate ${(seal.dupeChance * 100).toFixed(0)}%</span>
      </p>`;

    const foot = document.createElement('div');
    foot.className = 'seal__foot';

    const button = document.createElement('button');
    button.className = 'btn btn--small seal__equip';
    if (owned) {
      button.textContent = active ? 'Equipped' : 'Equip';
      button.classList.toggle('is-active', active);
      button.addEventListener('click', () => {
        const result = equipSeal(state.ownedSeals, seal.id);
        if (!result.ok) return say(result.reason);
        state.equippedSeal = result.sealId;
        save(); renderSealShop(); paintChrome();
        sealChatter();   // the seal introduces itself, on the dock, unprompted
        say(`${seal.name} settles onto the dock beside you.`);
      });
    } else {
      button.textContent = locked ? 'Locked' : 'Buy';
      if (locked) {
        button.disabled = true;
        button.title = quote.reason;
      }
      button.addEventListener('click', () => {
        const result = buySeal({ coins: state.sealCoins }, seal.id, rank.level, progress);
        if (!result.ok) return say(result.reason);
        state.sealCoins = result.coins;
        state.ownedSeals = [...state.ownedSeals, seal.id];
        state.equippedSeal = seal.id;
        save(); renderSealShop(); paintChrome();
        sealChatter();
        say(`${seal.name} comes home with you.`);
      });
    }
    foot.appendChild(button);

    // The price is its own chip rather than the whole button label -- five figures
    // in body text shouted over the row, and the button said what the chip now says.
    if (!owned) {
      const price = document.createElement('span');
      price.className = 'seal__price';
      price.textContent = `${seal.price.toLocaleString('en-US')} seal coins`;
      foot.appendChild(price);
    }
    row.appendChild(foot);
    ui.sealList.appendChild(row);
  }
}

function openSealShop() {
  if (!ui.sealPanel) return;
  renderSealShop();
  ui.sealPanel.hidden = false;
}

function closeSealShop() {
  if (ui.sealPanel) ui.sealPanel.hidden = true;
}

function renderIndex() {
  ui.indexList.textContent = '';

  for (const group of fishIndex()) {
    const tier = document.createElement('div');
    tier.className = 'index__tier';

    const head = document.createElement('div');
    head.className = 'index__head';

    const swatch = document.createElement('span');
    swatch.className = 'index__swatch';
    swatch.style.background = group.colour;

    const name = document.createElement('span');
    name.className = 'index__name';
    name.textContent = group.rarity;

    const chance = document.createElement('span');
    chance.className = 'index__chance';
    chance.textContent = `${formatChance(group.chance)} of casts`;

    head.append(swatch, name, chance);
    tier.appendChild(head);

    for (const raw of group.fish) {
      const fish = fishEntry(raw);
      const row = document.createElement('div');
      row.className = 'index__fish';
      if (!state.bestiary[fish.id]) row.classList.add('index__fish--new');

      // The fish itself, drawn by hue and body shape, same as the catch card.
      const art = document.createElement('div');
      art.className = 'index__art';
      art.setAttribute('aria-hidden', 'true');
      art.innerHTML = fishSvg(fish);

      const label = document.createElement('div');
      label.className = 'index__label';
      const fishName = document.createElement('span');
      fishName.className = 'index__fishName';
      fishName.textContent = fish.name;
      const detail = document.createElement('span');
      detail.className = 'index__detail';
      detail.textContent = `${fish.minKg}–${fish.maxKg} kg · ¤${fish.pricePerKg}/kg`;
      label.append(fishName, detail);

      // A share of every cast, not of the tier, so a one-fish tier does not read
      // as 100%.
      const odds = document.createElement('span');
      odds.className = 'index__odds';
      odds.textContent = formatChance((fish.weight / TOTAL_WEIGHT) * 100);

      row.append(art, label, odds);
      tier.appendChild(row);
    }

    ui.indexList.appendChild(tier);
  }
}

/** Odds read better rounded: "1 in 90" beats "1.1%". */
function formatChance(percent) {
  if (percent >= 10) return `${Math.round(percent)}%`;
  const oneIn = Math.round(1 / (percent / 100));
  if (oneIn >= 100) return `1 in ${oneIn}`;
  return `${percent.toFixed(1)}%`;
}

function openIndex() {
  renderIndex();
  ui.indexPanel.hidden = false;
}

function closeIndex() {
  ui.indexPanel.hidden = true;
}

function renderShop() {
  ui.shopCoins.textContent = state.coins;
  ui.shopList.textContent = '';

  const forSale = RODS_BY_PRICE.filter((id) => !ownsRod(state.owned, id));
  ui.shopList.appendChild(makeHeading(`For sale (${forSale.length})`));

  if (forSale.length === 0) {
    const done = document.createElement('p');
    done.className = 'shop__owned-all';
    done.textContent = 'You own every rod. Open your inventory to pick one.';
    ui.shopList.appendChild(done);
    return;
  }

  for (const id of forSale) {
    ui.shopList.appendChild(makeRodRow(id, { owned: false, onDone: renderShop }));
  }
}

/** One overlay at a time: opening either panel closes the other. */
function openShop() {
  ui.inventory.hidden = true;
  renderShop();
  ui.shopPanel.hidden = false;
  ui.shopClose.focus();
}

function closeShop() {
  ui.shopPanel.hidden = true;
  ui.shopOpen.focus();
}

/**
 * The bag count in the HUD. Split from paintBag() because the badge is
 * permanent and the rows are not: a catch lands in the bag without the panel
 * ever being opened, and a fish nobody can see in the HUD is a fish that looks
 * like it vanished.
 */
/**
 * The Bond tab: where this seal is, and what feeding more would buy.
 *
 * Feeding was a real decision -- a catch is worth rod coins OR luck, never both --
 * with nothing on screen to say where the luck was going. The bag listed a bare
 * count. This is the shape of the thing: a line with a milestone on it, filled as
 * the seal is fed, so each fish is visibly a step somewhere.
 *
 * Everything is read from bondProgress(), which reads bondLuck(). The tab must not
 * do its own arithmetic: a timeline claiming a luck the rules do not pay would be
 * worse than no timeline at all.
 */
function paintBond() {
  if (!ui.bondTimeline) return;
  const seal = SEALS.find((s) => s.id === state.equippedSeal) ?? null;

  ui.bondTimeline.textContent = '';

  if (!seal) {
    // No seal, no ladder. An empty timeline would imply progress that is not there.
    if (ui.bondHead) {
      ui.bondHead.textContent =
        'No seal on the dock. Buy one and feed it a fish to start a bond.';
    }
    if (ui.bondFill) ui.bondFill.style.width = '0%';
    return;
  }

  const p = bondProgress(bondCount(state.bond, seal.id));

  if (ui.bondHead) {
    ui.bondHead.textContent = p.complete
      ? `${seal.name}: ${p.fed} fish fed. Bond is at its best \u2014 luck +${p.luck.toFixed(2)},`
        + ' and there is nothing left on the ladder.'
      : `${seal.name}: ${p.fed} fish fed. Luck +${p.luck.toFixed(2)}.`
        + ` ${p.next.at - p.fed} more for ${p.next.title} (luck +${p.next.luck.toFixed(2)}).`;
  }
  if (ui.bondFill) ui.bondFill.style.width = `${(p.progress * 100).toFixed(1)}%`;

  for (const step of p.steps) {
    const on = p.reached.includes(step);
    const next = p.next === step;
    const row = document.createElement('li');
    row.className = 'bond__step'
      + (on ? ' is-on' : '')
      + (next ? ' is-next' : '');
    row.dataset.at = String(step.at);

    const at = document.createElement('span');
    at.className = 'bond__at';
    at.textContent = on ? `${step.at} fed` : `${step.at} fish`;

    const name = document.createElement('b');
    name.className = 'bond__name';
    name.textContent = step.title;

    const reward = document.createElement('span');
    reward.className = 'bond__reward';
    reward.textContent = step.reward;

    const note = document.createElement('span');
    note.className = 'bond__note';
    note.textContent = step.note;

    row.append(at, name, reward, note);
    ui.bondTimeline.appendChild(row);
  }
}

/**
 * Every bar button is a toggle: the one that opened a panel closes it again.
 *
 * Each opener only ever OPENED before, so the only ways out were the Close button
 * inside the panel or Escape -- and clicking the thing you had just clicked did
 * nothing at all, which reads as a broken button rather than as a one-way dialog.
 *
 * Closing runs the panel's own close handler rather than just hiding it, so focus
 * returns to the button the way it does when Close is pressed. Hiding the panel
 * alone would strand focus on a control behind the scrim.
 */
function togglePanel(panel, open, close) {
  if (!panel) return;
  if (panel.hidden) open();
  else close();
}

/** Open the bond timeline. Its own panel, so the bag stays exactly as it was. */
function openBond() {
  if (!ui.bondPanel) return;
  paintBond();
  ui.bondPanel.hidden = false;
  ui.bondClose?.focus();
}

function closeBond() {
  ui.bondPanel.hidden = true;
  ui.bondOpen?.focus();
}

function paintBagBadge(count) {
  if (!ui.bagCount) return;
  ui.bagCount.textContent = count ? `(${count})` : '';
}

/**
 * The bag: every landed fish, with both choices on each row.
 *
 * A catch is worth nothing until you do something with it. Sell pays rod coins;
 * feed raises that seal's bond, which adds luck. The two compete for the same
 * fish, which is the only reason the bag is a decision rather than a queue.
 */
/**
 * One row per species in the bag.
 *
 * The bag listed one row per FISH, so twelve identical Glidefins were twelve
 * identical rows with twelve identical buttons -- and only one of them is a real
 * decision, because they are all the same decision. Each row now stands for the
 * whole group: it shows the heaviest fish of that species, how many there are, and
 * what the lot is worth, with Sell one and Feed one acting on the group.
 */
function paintBagRow(group, seal) {
  const fish = fishById(group.fishId);
  if (!fish) return null;

  const row = document.createElement('div');
  row.className = 'bag__row';
  row.dataset.fish = group.fishId;

  const what = document.createElement('div');
  what.className = 'bag__what';

  const portrait = document.createElement('span');
  portrait.className = 'bag__portrait';
  portrait.style.setProperty('--fish-hue', String(fish.hue));

  const titles = document.createElement('span');
  titles.className = 'bag__titles';

  const name = document.createElement('b');
  name.className = 'bag__name';
  name.textContent = (group.entry.mutation ? `${group.entry.mutation} ` : '') + fish.name;
  titles.appendChild(name);

  // How many, and what the lot is worth. Both are stated, because the button sells
  // ONE of them and the player has to know that before clicking.
  const meta = document.createElement('span');
  meta.className = 'bag__meta';
  meta.textContent = group.count > 1
    ? `${fish.rarity} \u00b7 ${group.count} held \u00b7 best ${group.entry.weight} kg \u00b7 `
      + `${group.total.toLocaleString('en-US')} coins for the lot`
    : `${fish.rarity} \u00b7 ${group.entry.weight} kg`;
  titles.appendChild(meta);

  what.append(portrait, titles);

  const actions = document.createElement('div');
  actions.className = 'bag__actions';

  // The index of the fish this row SHOWS, not merely the first of the species.
  // The row advertises the heaviest of the group, so Sell one has to take that
  // one: selling the smallest of three would pay far less than the row implied,
  // and the player would have no way to tell.
  const at = state.bag.indexOf(group.entry);
  // Defensive: a stale row whose fish has gone must not act on its neighbour.
  const here = at >= 0 && state.bag[at]?.fishId === group.fishId;

  const sell = document.createElement('button');
  sell.className = 'btn btn--small bag__sell';
  sell.textContent = group.count > 1 ? `Sell one (${group.count})` : 'Sell one';
  sell.addEventListener('click', () => (here ? sellOneFish(at, fish) : null));

  const feed = document.createElement('button');
  feed.className = 'btn btn--small bag__feed';
  if (!seal) {
    feed.textContent = 'Feed one';
    feed.disabled = true;
    feed.title = 'Equip a seal first, then you can feed it.';
  } else {
    feed.textContent = group.count > 1 ? `Feed one (${group.count})` : 'Feed one';
    feed.addEventListener('click', () => (here ? feedOneFish(at, fish, seal) : null));
  }

  actions.append(sell, feed);
  row.append(what, actions);
  return row;
}

/** Sell one fish out of the bag, leaving the rest. */
function sellOneFish(at, fish) {
  if (at < 0) return;
  const result = sellFromBag(state.bag, at);
  if (!result.ok) return say(result.reason);
  state.coins += result.coins;
  state.bag = result.bag;
  save(); paintChrome(); paintBag();
  // The Bond panel states the count the feed just changed. Leaving it open
  // while it reads 11 because you fed the twelfth is worse than no panel:
  // it would be showing a fact that is no longer true.
  paintBagBadge(state.bag.length);
  if (ui.bondPanel && !ui.bondPanel.hidden) paintBond();
  say(`${fish.name} sold for ${result.coins.toLocaleString('en-US')} coins.`);
}

/** Feed one fish to the equipped seal, leaving the rest. */
function feedOneFish(at, fish, seal) {
  if (at < 0) return;
  const result = feedToBond(state.bag, at, state.bond, seal.id);
  if (!result.ok) return say(result.reason);
  state.bag = result.bag;
  state.bond = result.bond;
  save(); paintChrome(); paintBag();
  // The Bond panel states the count the feed just changed. Leaving it open
  // while it reads 11 because you fed the twelfth is worse than no panel:
  // it would be showing a fact that is no longer true.
  paintBagBadge(state.bag.length);
  if (ui.bondPanel && !ui.bondPanel.hidden) paintBond();
  // The seal reacts to THIS fish, by how rare it was. It used to call
  // sealChatter(), which picks an idle line -- so the one decision the bag exists
  // for was answered with the same words as every other moment.
  sealSays(sealFedLine(seal, fish), seal);
  say(`${fish.name} fed to ${seal.name}. Bond ${bondCount(state.bond, seal.id)}.`);
}

function paintBag() {
  if (!ui.bagList) return;
  const bag = Array.isArray(state.bag) ? state.bag : [];
  const seal = SEALS.find((s) => s.id === state.equippedSeal) ?? null;

  paintBagBadge(bag.length);

  if (ui.bagSummary) {
    ui.bagSummary.textContent = bag.length
      ? `${bag.length} fish in the bag, worth ${bagWorth(bag).toLocaleString('en-US')} rod coins.`
      : 'Nothing in the bag. Fish something and it waits here.';
  }

  ui.bagList.textContent = '';
  if (bag.length === 0) return;

  // One row per SPECIES, not per fish. Twelve identical Glidefins are twelve
  // identical decisions, so they share a row.
  for (const group of groupBag(bag)) {
    const row = paintBagRow(group, seal);
    if (row) ui.bagList.appendChild(row);
  }
}

function openBagPanel() {
  if (!ui.bagPanel) return;
  paintBag();
  ui.bagPanel.removeAttribute('hidden');
}

function closeBagPanel() {
  ui.bagPanel?.setAttribute('hidden', '');
}

function openBag() {
  ui.shopPanel.hidden = true;
  renderInventory();
  ui.inventory.hidden = false;
  ui.inventoryClose.focus();
}

function closeBag() {
  ui.inventory.hidden = true;
  ui.inventoryOpen.focus();
}

/* ------------------------------------------------------------------- input */

/**
 * Is this element part of the interface rather than the open water?
 *
 * The first attempt asked "is it a button, a panel or the HUD?" -- an allowlist --
 * and it was wrong the way allowlists always are: it missed the boost stack,
 * which lives inside the lake as `lake__boosts` and is none of those three.
 * Clicking your own luck readout cast the rod.
 *
 * So the question is inverted: a press casts only when it reaches the water.
 * `#lake` is the water, and every panel and overlay is a descendant of it, so
 * walking up from the pressed element answers the question by itself. Anything
 * that is not a descendant of the lake -- the HUD, the wallets -- is interface too,
 * so the walk ends there as well.
 *
 * Two things deliberately do NOT need a rule, having measured it: `scene` and
 * `BUTTON`. The scene is `inset: 0`, so it covers the lake entirely and every
 * click on it already arrives via the lake; and a button is always inside a panel
 * or the HUD, both of which are excluded on their own account. Listing them looked
 * more careful and was untested decoration -- deleting either changed nothing.
 */
function isInterface(node) {
  for (let el = node; el && el !== document.body; el = el.parentElement) {
    if (el.id === 'lake') return false;      // reached the water: this is a cast
    if (el.classList?.contains('shop')) return true;   // every panel, and its scrim
    if (el.classList?.contains('hud')) return true;
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT'
      || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'LABEL') {
      return true;
    }
  }
  return true;   // never reached the water, so not a cast
}


function press(event) {
  if (event.type === 'mousedown' || event.type === 'touchstart') event.preventDefault();
  // Pressing while idle is what starts a cast. 'result' is deliberately ignored:
  // a snapped line has to be dismissed with the button, not by flailing at the lake.
  if (state.phase === 'idle') {
    beginCast();
    return;
  }
  if (state.phase === 'casting' || state.phase === 'reeling') state.holding = true;
}

function release() {
  const wasCasting = state.phase === 'casting';
  state.holding = false;
  if (wasCasting) releaseCast();
}

addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return;
  if (!ui.shopPanel.hidden) return;   // Space must not fight the shop's buttons
  event.preventDefault();
  press(event);
});
addEventListener('keyup', (event) => {
  if (event.code === 'Space') release();
});
// Casting is a press on the open water. Every panel -- the rod shop, the seals,
// the bag, the index, the lakes -- is a CHILD of #lake, so binding press()
// straight to the lake meant clicking a button in the shop cast the rod. The
// shake prompts are the only things inside the lake that used to stop
// propagation, which is exactly why this went unnoticed: nothing else was tested.
//
// A press that lands on a control, a panel, or a piece of text is not a cast.
// Scoped by what was hit rather than by what was clicked, so it also covers the
// panels' own padding and headings.
ui.lake.addEventListener('mousedown', (event) => {
  if (isInterface(event.target)) return;
  press(event);
});
addEventListener('mouseup', release);
// Touch had the same bug as the mouse: press() was bound straight to the lake, so
// tapping a shop button on a phone cast the rod. Same guard, same reason.
ui.lake.addEventListener('touchstart', (event) => {
  if (isInterface(event.target)) return;
  press(event);
}, { passive: false });
addEventListener('touchend', release);
addEventListener('touchcancel', release);
// Losing focus mid-hold would otherwise strand the player mid-reel.
addEventListener('blur', release);

ui.hookSet?.addEventListener('click', () => {
  if (state.phase !== 'bite' || !state.bitten) return;
  hook(state.bitten);
});
ui.catchAgain.addEventListener('click', () => {
  setPhase('idle');
  say(IDLE_HINT);
  sealChatter();   // back to idle, so it has an opinion again
});
ui.shopOpen.addEventListener('click', () => togglePanel(ui.shopPanel, openShop, closeShop));
ui.sealOpen?.addEventListener('click',
  () => togglePanel(ui.sealPanel, openSealShop, closeSealShop));
ui.sellFinds?.addEventListener('click', sellFinds);
ui.sealClose?.addEventListener('click', closeSealShop);
ui.shopClose.addEventListener('click', closeShop);
ui.inventoryOpen?.addEventListener('click', () => togglePanel(ui.inventory, openBag, closeBag));
ui.bagOpenBtn?.addEventListener('click',
  () => togglePanel(ui.bagPanel, openBagPanel, closeBagPanel));
ui.bondOpen?.addEventListener('click', () => togglePanel(ui.bondPanel, openBond, closeBond));
ui.bondClose?.addEventListener('click', closeBond);
ui.indexOpen?.addEventListener('click', () => togglePanel(ui.indexPanel, openIndex, closeIndex));
ui.lakePicker?.addEventListener('click', () => togglePanel(ui.lakePanel, openLakes, closeLakes));
ui.lakeClose?.addEventListener('click', closeLakes);
ui.lakePanel?.addEventListener('click', (event) => {
  if (event.target === ui.lakePanel) closeLakes();
});
ui.indexClose?.addEventListener('click', closeIndex);
// Clicking the scrim outside the panel closes it, same as the others.
ui.indexPanel?.addEventListener('click', (event) => {
  if (event.target === ui.indexPanel) closeIndex();
});
ui.inventoryClose?.addEventListener('click', closeBag);
ui.bagCloseBtn?.addEventListener('click', closeBagPanel);
// Clicking the scrim outside the panel closes it, same as the shop.
ui.inventory?.addEventListener('click', (event) => {
ui.bagPanel?.addEventListener('click', (event) => {
  if (event.target === ui.bagPanel) closeBagPanel();
});
  if (event.target === ui.inventory) closeBag();
});
ui.shopPanel.addEventListener('click', (event) => {
  if (event.target === ui.shopPanel) closeShop();
});

/* -------------------------------------------------------------------- loop */

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state.phase === 'casting' && state.holding) {
    // The meter sweeps up then back down; releasing is the whole skill.
    state.meter += CAST_SPEED * dt;
    if (state.meter > 1) state.meter = 2 - state.meter;
    ui.castFill.style.width = `${state.meter * 100}%`;
  }

  if (state.phase === 'waiting' && now >= state.biteAt) {
    // Luck is rod + rank + equipped seal, so all three have a visible pull.
  const sealNow = SEALS.find((item) => item.id === state.equippedSeal) ?? null;
  // Weather counts toward luck. luckFromSky() was computed and then never
  // used, so every sky looked different and fished identically.
  const skyNow = state.sky ?? skyFor(state.areaId);
  const luck = luckFor({
    rod: rod(),
    level: levelFrom({ xp: state.xp }).level,
    seal: sealNow,
    // Fed fish, so feeding shows up in the roll rather than only on a panel.
    bond: sealNow ? bondCount(state.bond, sealNow.id) : 0,
  }) + (luckFromSky(skyNow.time, skyNow.weather) - 1);
  hookSet(rollFish(Math.random(), rod(), state.areaId, luck));
  }

  // Miss the window and the fish is gone. Otherwise "click to hook" is optional.
  if (state.phase === 'bite' && now >= state.hookAt) {
    if (ui.bite) ui.bite.hidden = true;
    state.bitten = null;
    loseFish('Too slow — the fish threw the hook.');
  }

  if (state.phase === 'reeling') stepReel();

  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------------- boot */

load();
paintChrome();
fitFigure();
fitPet();
// The lake changes shape with the window, so the counter-scale must follow --
// for the angler AND for the pet, which needs its own correction.
const refit = () => { fitFigure(); fitPet(); };
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(refit).observe(ui.lake);
} else {
  addEventListener('resize', refit);
}
setPhase('idle');
// Paint the starting lake before the first frame, so the scene is never
// showing the default palette for a frame.
paintArea(AREAS.find((a) => a.id === state.areaId) ?? AREAS[0]);
// Every visit gets its own sky, so one lake is a different place each time.
paintSky(skyFor(state.areaId));
// Paint the HUD too. Without this the rank, the rod name and the wallet sat on
// their markup defaults until the first catch, so a returning player's rank and
// rod were simply wrong on the screen they opened the game to.
paintChrome();
// Fill the picker now as well as on open, so its rows exist and their locked
// state is readable without having to open it.
renderLakes();
// The bag count is a HUD badge, so it has to be right on load -- a returning
// player should see how many fish are waiting without opening the panel.
paintBag();
// A seal already on the dock at boot has already met you, so it says hello. No
// seal means no chatter, so a fresh save is still quiet.
sealChatter();
requestAnimationFrame(frame);
