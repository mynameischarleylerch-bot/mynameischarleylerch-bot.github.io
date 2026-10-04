/**
 * Fishing simulation for Frutiger Angler: rods, cast quality, bite timing, the
 * fish table and the economy.
 *
 * Pure functions, no DOM and no canvas — angler.js turns whatever these return
 * into pixels. Randomness is always an injected `roll`/`seed` so tests stay
 * deterministic.
 */

/* ------------------------------------------------------------------ tuning */

const PERFECT_BAND = { from: 0.45, to: 0.55 };  // the green zone on the cast meter
const GOOD_BAND = 0.2;                           // above this is "good", below is "poor"
const CAST_REACH = { perfect: 1, good: 0.65, poor: 0.3 };
const BITE_BASE_MS = 2600;
const BITE_JITTER_MS = 1800;
const BITE_MIN_MS = 350;
const LUCK_BITE_SHORTENING = 0.05;   // per point of luck, capped at 20%
const LUCK_BITE_CAP = 0.2;

/* -------------------------------------------------------------- mutations */

export const MUTATIONS = [
  { id: 'none', name: '', multiplier: 1, weight: 74, colour: null },
  { id: 'shiny', name: 'Shiny', multiplier: 1.5, weight: 18, colour: '#e0f7fa' },
  { id: 'glowy', name: 'Glowy', multiplier: 2, weight: 7, colour: '#76ff03' },
  { id: 'crowned', name: 'Crowned', multiplier: 5, weight: 1, colour: '#ffd54f' },
];

/**
 * The multiplier for a mutation id, so a catch can be shown again later without
 * storing the whole object. Anything unrecognised reads as plain rather than
 * throwing -- a save from before mutations existed has no id at all.
 */
export function mutationMultiplierFor(id) {
  return MUTATIONS.find((m) => m.id === id)?.multiplier ?? 1;
}

/** Look a mutation up by id for display. Null for plain or unknown. */
export function mutationById(id) {
  if (!id) return null;
  return MUTATIONS.find((m) => m.id === id && m.id !== 'none') ?? null;
}

/* ------------------------------------------------------------------- rods */

/**
 * control: width of the player's bar in the reeling minigame.
 * resilience: how much the fish's movement is damped.
 * luck: shifts the weight table toward rarer fish, and shortens the bite.
 * lureSpeed: how fast the wait before a bite passes.
 * maxKg: the weight ceiling — land nothing heavier, or the line snaps.
 */
export const RODS = {/* ---- three more ordinary rods -----------------------------------
   * The gate out of Aero Lake is eight no-trait rods, so there now are eight.
   * They sit above Titan and below the specialists, each one a modest step up
   * in luck, speed and weight rather than a leap.
   */
  /* ---- trait upgrades -------------------------------------------------
   * Each trait lake's FIRST rod is handed over free on arrival. This second one
   * is the rod you actually have to go and buy, which is what makes
   * "own every rod with this lake's trait" mean anything beyond the gift.
   */
  /* ---- specialist rods ---------------------------------------------
   * Each exists to open one gated lake, so each carries that lake's trait.
   * Channel is the cheapest of the four, because it is also the rod you are
   * handed free when you first arrive in DORFic Delta. It still carries a real
   * premium over the dearest ordinary rod, so the gate still means something.
   *
   * Every specialist costs a real premium over the plain top rod: the gate has to
   * be an economy decision, not a formality. Stats are otherwise comparable, so
   * the player is paying for access rather than for power.
   */

  bamboo: { level: 1,
    id: 'bamboo', name: 'Splinter', price: 40,
    control: 0.20, resilience: 0.30, luck: 0, lureSpeed: 1, maxKg: 3,
    traits: [],
    blurb: 'Splinters. Still better than nothing.',
  },
  willow: { level: 1,
    id: 'willow', name: 'Greenstalk', price: 120,
    control: 0.28, resilience: 0.42, luck: 0.4, lureSpeed: 1.6, maxKg: 8,
    traits: [],
    blurb: 'Bends without complaining.',
  },
  carbon: { level: 2,
    id: 'carbon', name: 'Graphite Whisper', price: 450,
    control: 0.34, resilience: 0.55, luck: 0.8, lureSpeed: 2.4, maxKg: 20,
    traits: [],
    blurb: 'Light, springy, slightly smug.',
  },
  oak: { level: 3,
    id: 'oak', name: 'Deeproot', price: 2400,
    control: 0.40, resilience: 0.70, luck: 1.2, lureSpeed: 3.2, maxKg: 45,
    traits: [],
    blurb: 'Heavy enough to feel the water.',
  },
  titan: { level: 4,
    id: 'titan', name: 'Cloudlance', price: 9500,
    control: 0.46, resilience: 0.85, luck: 1.8, lureSpeed: 4.2, maxKg: 120,
    traits: [],
    blurb: 'Absorbs thrashing like a rumour.',
  },
  zephyr: { level: 5,
    id: 'zephyr', name: 'Zephyr Spindle', price: 14500,
    control: 0.47, resilience: 0.80, luck: 1.9, lureSpeed: 4.4, maxKg: 150,
    traits: [],
    blurb: 'Weighs nothing. Catches nothing. Catches plenty, actually.',
  },
  quicksilver: { level: 6,
    id: 'quicksilver', name: 'Quicksilver Ribbon', price: 20000,
    control: 0.48, resilience: 0.82, luck: 2.0, lureSpeed: 4.6, maxKg: 185,
    traits: [],
    blurb: 'Bends like it is apologising. Returns like it is not.',
  },
  horizon: { level: 7,
    id: 'horizon', name: 'Horizon Curve', price: 26500,
    control: 0.49, resilience: 0.84, luck: 2.1, lureSpeed: 4.8, maxKg: 220,
    traits: [],
    blurb: 'Long enough that you forget you are holding it.',
  },
  canopy: { level: 8,
    id: 'canopy', name: 'Fernwhisper', price: 34000,
    control: 0.50, resilience: 0.86, luck: 2.2, lureSpeed: 5.1, maxKg: 240,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Reaches over the reeds without touching them.',
  },
  channel: { level: 9,
    id: 'channel', name: 'Straightwater', price: 39000,
    control: 0.52, resilience: 0.88, luck: 2.3, lureSpeed: 5.3, maxKg: 265,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Finds the one straight line through a maze of channels.',
  },
  understory: { level: 10,
    id: 'understory', name: 'Understory', price: 42000,
    control: 0.55, resilience: 0.90, luck: 2.4, lureSpeed: 5.5, maxKg: 285,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Goes under the canopy rather than over it, which the reeds prefer.',
  },
  spillway: { level: 11,
    id: 'spillway', name: 'Spillway', price: 49000,
    control: 0.56, resilience: 0.91, luck: 2.5, lureSpeed: 5.7, maxKg: 300,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Reads the whole channel system at once and drops into the right one.',
  },
  glacier: { level: 12,
    id: 'glacier', name: 'Glacier Lance', price: 58000,
    control: 0.57, resilience: 0.93, luck: 2.6, lureSpeed: 5.9, maxKg: 330,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Bored through the ice. Useless anywhere warm.',
  },
  glacierwall: { level: 14,
    id: 'glacierwall', name: 'Glacierwall', price: 69000,
    control: 0.58, resilience: 0.93, luck: 2.7, lureSpeed: 6.1, maxKg: 330,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Bored a shaft straight down through two hundred metres of shelf.',
  },
  abyss: { level: 17,
    id: 'abyss', name: 'Abyssal Rig', price: 108000,
    control: 0.60, resilience: 0.97, luck: 3.0, lureSpeed: 6.4, maxKg: 440,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'Built for pressure. Heavy enough to be a nuisance on the bank.',
  },
  trenchline: { level: 19,
    id: 'trenchline', name: 'Trenchline', price: 132000,
    control: 0.62, resilience: 0.98, luck: 3.2, lureSpeed: 6.6, maxKg: 460,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'Rated to the pressure at the bottom. The bottom knows it.',
  },


  /* ---- eight rods per trait lake, 32 in all --------------------------
   * Each trait lake now carries ten rods you can own for it: the two
   * specialists that gate it, plus eight more climbing to the top of the
   * ladder. Aero Lake is untouched at eight, as asked.
   *
   * INTERLEAVED by price across the four lakes, so the shop still reads as one
   * ladder rather than four blocks. Every value here is a pure function of the
   * rod's slot in that price order, which is what keeps the existing ladder
   * rules true at all 48 steps: price strictly up, and level, luck, control,
   * lureSpeed, width and sheen never down, sheen never above 1. Generated
   * rather than hand-typed for that reason -- a hand-typed pass broke five.
   *
   * `lake` is new. Nothing required it before -- the water a rod belonged to
   * was implicit in its trait -- so nothing reads it yet. It is data.
   */
  'delta-1': { level: 20,
    id: 'delta-1', name: 'Siltwader', price: 140000,
    control: 0.625, resilience: 0.985, luck: 3.22,
    lureSpeed: 6.62, maxKg: 475,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Wades the silt without noticing it.',
  },

  'marsh-1': { level: 20,
    id: 'marsh-1', name: 'Peatcutter', price: 153500,
    control: 0.63, resilience: 0.99, luck: 3.25,
    lureSpeed: 6.7, maxKg: 495,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Cuts through peat and reed.',
  },

  'fjord-1': { level: 21,
    id: 'fjord-1', name: 'Rimepick', price: 167000,
    control: 0.634, resilience: 0.995, luck: 3.29,
    lureSpeed: 6.79, maxKg: 515,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Picks a path through rime.',
  },

  'deep-1': { level: 22,
    id: 'deep-1', name: 'Pressure Rod', price: 180500,
    control: 0.639, resilience: 1.0, luck: 3.32,
    lureSpeed: 6.87, maxKg: 535,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'Rated past its stated limit.',
  },

  'delta-2': { level: 23,
    id: 'delta-2', name: 'Mudlark', price: 194000,
    control: 0.643, resilience: 1.004, luck: 3.36,
    lureSpeed: 6.96, maxKg: 555,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Lifts a fish out of the mud, and looks surprised.',
  },

  'marsh-2': { level: 24,
    id: 'marsh-2', name: 'Bogwood', price: 207500,
    control: 0.648, resilience: 1.009, luck: 3.39,
    lureSpeed: 7.04, maxKg: 575,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Bogwood, and the patience to use it.',
  },

  'fjord-2': { level: 25,
    id: 'fjord-2', name: 'Frostwhip', price: 221500,
    control: 0.652, resilience: 1.014, luck: 3.42,
    lureSpeed: 7.12, maxKg: 595,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Cold hands, colder water.',
  },

  'deep-2': { level: 25,
    id: 'deep-2', name: 'Lanternpole', price: 235000,
    control: 0.657, resilience: 1.019, luck: 3.46,
    lureSpeed: 7.21, maxKg: 615,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'A light in a place with no light.',
  },

  'delta-3': { level: 26,
    id: 'delta-3', name: 'Reedline', price: 248500,
    control: 0.661, resilience: 1.024, luck: 3.49,
    lureSpeed: 7.29, maxKg: 635,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Follows the waterline exactly.',
  },

  'marsh-3': { level: 27,
    id: 'marsh-3', name: 'Sedge', price: 262000,
    control: 0.666, resilience: 1.029, luck: 3.52,
    lureSpeed: 7.37, maxKg: 655,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Finds fish where the light does not reach.',
  },

  'fjord-3': { level: 28,
    id: 'fjord-3', name: 'Snowlance', price: 275500,
    control: 0.67, resilience: 1.033, luck: 3.56,
    lureSpeed: 7.46, maxKg: 675,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'A lance of blue-white carbon.',
  },

  'deep-3': { level: 29,
    id: 'deep-3', name: 'Glowtaper', price: 289000,
    control: 0.675, resilience: 1.038, luck: 3.59,
    lureSpeed: 7.54, maxKg: 695,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'Glows faintly. Fishes deeper.',
  },

  'delta-4': { level: 30,
    id: 'delta-4', name: 'Sunfisher', price: 302500,
    control: 0.679, resilience: 1.043, luck: 3.63,
    lureSpeed: 7.63, maxKg: 715,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Fishes the warm shallows at noon.',
  },

  'marsh-4': { level: 30,
    id: 'marsh-4', name: 'Fenrunner', price: 316000,
    control: 0.684, resilience: 1.048, luck: 3.66,
    lureSpeed: 7.71, maxKg: 735,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Runs the fen without sinking.',
  },

  'fjord-4': { level: 31,
    id: 'fjord-4', name: 'Bluewhistle', price: 329500,
    control: 0.688, resilience: 1.053, luck: 3.69,
    lureSpeed: 7.79, maxKg: 755,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Whistles in the wind, lands in the ice.',
  },

  'deep-4': { level: 32,
    id: 'deep-4', name: 'Blackglass', price: 343000,
    control: 0.693, resilience: 1.058, luck: 3.73,
    lureSpeed: 7.88, maxKg: 775,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'Black glass, black water.',
  },

  'delta-5': { level: 33,
    id: 'delta-5', name: 'Estuary', price: 357000,
    control: 0.697, resilience: 1.062, luck: 3.76,
    lureSpeed: 7.96, maxKg: 795,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Sits in the brackish and waits.',
  },

  'marsh-5': { level: 34,
    id: 'marsh-5', name: 'Marshlight', price: 370500,
    control: 0.702, resilience: 1.067, luck: 3.8,
    lureSpeed: 8.05, maxKg: 815,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Marsh light, on a stick.',
  },

  'fjord-5': { level: 35,
    id: 'fjord-5', name: 'Calvary', price: 384000,
    control: 0.706, resilience: 1.072, luck: 3.83,
    lureSpeed: 8.13, maxKg: 835,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Calvary: heavy, patient, absolute.',
  },

  'deep-5': { level: 35,
    id: 'deep-5', name: 'Deep Rig', price: 397500,
    control: 0.711, resilience: 1.077, luck: 3.86,
    lureSpeed: 8.21, maxKg: 855,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'For the pressure, not the pleasure.',
  },

  'delta-6': { level: 36,
    id: 'delta-6', name: 'Brackish', price: 411000,
    control: 0.715, resilience: 1.082, luck: 3.9,
    lureSpeed: 8.3, maxKg: 875,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Built for water that changes its mind.',
  },

  'marsh-6': { level: 37,
    id: 'marsh-6', name: 'Willowfen', price: 424500,
    control: 0.72, resilience: 1.087, luck: 3.93,
    lureSpeed: 8.38, maxKg: 895,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Willow bends. So does the fish.',
  },

  'fjord-6': { level: 38,
    id: 'fjord-6', name: 'Whiteout', price: 438000,
    control: 0.724, resilience: 1.091, luck: 3.97,
    lureSpeed: 8.47, maxKg: 915,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Whiteout. You will not see it coming.',
  },

  'deep-6': { level: 39,
    id: 'deep-6', name: 'Trenchlight', price: 451500,
    control: 0.729, resilience: 1.096, luck: 4.0,
    lureSpeed: 8.55, maxKg: 935,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'Trenchlight: you see it before it sees you.',
  },

  'delta-7': { level: 40,
    id: 'delta-7', name: 'Tidewright', price: 465000,
    control: 0.733, resilience: 1.101, luck: 4.03,
    lureSpeed: 8.63, maxKg: 955,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'Handles whatever the delta throws.',
  },

  'marsh-7': { level: 40,
    id: 'marsh-7', name: 'Reedmantle', price: 478500,
    control: 0.738, resilience: 1.106, luck: 4.07,
    lureSpeed: 8.72, maxKg: 975,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'Reed and resin, layered and set.',
  },

  'fjord-7': { level: 41,
    id: 'fjord-7', name: 'Serac', price: 492500,
    control: 0.742, resilience: 1.111, luck: 4.1,
    lureSpeed: 8.8, maxKg: 995,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'Serac: a wall of a rod, built like one.',
  },

  'deep-7': { level: 42,
    id: 'deep-7', name: 'Abyss Crown', price: 506000,
    control: 0.747, resilience: 1.116, luck: 4.13,
    lureSpeed: 8.88, maxKg: 1015,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'The rod the deep respects.',
  },

  'delta-8': { level: 43,
    id: 'delta-8', name: 'Delta Crown', price: 519500,
    control: 0.751, resilience: 1.12, luck: 4.17,
    lureSpeed: 8.97, maxKg: 1035,
    traits: ['channel'],
    lake: 'doric-delta',
    blurb: 'The best thing you can own for the Delta.',
  },

  'marsh-8': { level: 44,
    id: 'marsh-8', name: 'Green Sovereign', price: 533000,
    control: 0.756, resilience: 1.125, luck: 4.2,
    lureSpeed: 9.05, maxKg: 1055,
    traits: ['flex'],
    lake: 'eco-marsh',
    blurb: 'The finest rod ever made for green water.',
  },

  'fjord-8': { level: 45,
    id: 'fjord-8', name: 'Glacier Sovereign', price: 546500,
    control: 0.76, resilience: 1.13, luck: 4.24,
    lureSpeed: 9.14, maxKg: 1075,
    traits: ['ice'],
    lake: 'glacier-fjord',
    blurb: 'The summit of cold-water tackle.',
  },

  'deep-8': { level: 46,
    id: 'deep-8', name: 'Pressure Sovereign', price: 560000,
    control: 0.765, resilience: 1.135, luck: 4.27,
    lureSpeed: 9.22, maxKg: 1095,
    traits: ['reinforced'],
    lake: 'dark-aero-deep',
    blurb: 'The deepest thing in the tackle shop.',
  },
};

/**
 * How each rod is drawn in the scene: length, thickness and colour, plus the parts
 * that make it read as TACKLE rather than a stick.
 *
 * A rod is not a line. It is a tapered blank with a wrapped grip, a seat, a reel
 * and a row of line guides running up to the tip. Getting those right is what makes
 * a 20,000-rod look like a different object from the free bamboo stick -- width and
 * colour alone did not, they only made the same silhouette fatter.
 *
 * `t` is a fraction along the rod, 0 at the butt and 1 at the tip, so the guides and
 * the grip stay on the shaft no matter how a rod's path is drawn.
 *
 * Blank styles:
 *   taper  - the blank thickens toward the butt, drawn as a filled wedge
 *   split  - a second, lighter stripe up the blank (carbon fibre weave)
 *   wrap   - cork or EVA grip bands with visible binding
 *   gloss  - a specular highlight band along the top of the blank
 *
 * Reels: 0 none, 1 small, 2 medium, 3 large.
 * Upgrades stay strictly longer and thicker, so the ladder reads at a glance.
 */
const ROD_LOOKS = {
  // ---- eight ordinary rods, no trait. These are the gate out of Aero Lake. ----
  bamboo: {
    path: 'M40.7 52 L52 40', width: 1.1, colour: '#c8a06a',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 0,
    guides: [0.42, 0.66, 0.88],
  },
  willow: {
    path: 'M40.7 52 L55 35', width: 1.5, colour: '#a9714a',
    blank: ['taper'], grip: 'wrap', gripColour: '#d9b483', reel: 1,
    guides: [0.4, 0.62, 0.82, 0.96],
  },
  carbon: {
    path: 'M40.7 52 L58 31', width: 1.9, colour: '#4a6b7c',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 1,
    guides: [0.38, 0.6, 0.8, 0.95],
  },
  oak: {
    path: 'M40.7 52 L61 27', width: 2.4, colour: '#7d4f2e',
    blank: ['taper'], grip: 'wrap', gripColour: '#c99a5e', reel: 2,
    guides: [0.36, 0.58, 0.78, 0.94],
  },
  titan: {
    path: 'M40.7 52 L64 23', width: 3.0, colour: '#8c9aa8',
    blank: ['taper', 'gloss'], grip: 'foam', gripColour: '#4c5865', reel: 2,
    guides: [0.34, 0.56, 0.76, 0.93],
  },
  zephyr: {
    path: 'M40.7 52 L66 22', width: 3.2, colour: '#7fb8d8',
    blank: ['taper', 'gloss'], grip: 'foam', gripColour: '#3f6b86', reel: 2,
    guides: [0.32, 0.54, 0.75, 0.92],
  },
  quicksilver: {
    path: 'M40.7 52 L67 21', width: 3.5, colour: '#c3d4e0',
    blank: ['taper', 'gloss', 'split'], grip: 'foam', gripColour: '#6d8494', reel: 3,
    guides: [0.3, 0.52, 0.74, 0.91],
  },
  horizon: {
    path: 'M40.7 52 L68 20', width: 3.8, colour: '#4c6b80',
    blank: ['taper', 'gloss', 'split'], grip: 'foam', gripColour: '#263b49', reel: 3,
    guides: [0.28, 0.5, 0.73, 0.9],
  },

  // ---- trait rods, tinted with the lake they open -------------------------
  canopy: {
    path: 'M40.7 52 L69 19', width: 3.9, colour: '#5f8f3f',
    blank: ['taper', 'gloss'], grip: 'wrap', gripColour: '#4a6b30', reel: 3,
    guides: [0.3, 0.52, 0.74, 0.91],
  },
  channel: {
    path: 'M40.7 52 L70 19', width: 4.0, colour: '#e07b2a',
    blank: ['taper', 'gloss', 'stripe'], grip: 'foam', gripColour: '#8f4310', reel: 3,
    guides: [0.29, 0.51, 0.73, 0.9],
  },
  understory: {
    path: 'M40.7 52 L71 18', width: 4.1, colour: '#7cb342',
    blank: ['taper', 'gloss'], grip: 'wrap', gripColour: '#3f5c26', reel: 3,
    guides: [0.28, 0.5, 0.72, 0.9],
  },
  spillway: {
    path: 'M40.7 52 L72 18', width: 4.2, colour: '#f0a35a',
    blank: ['taper', 'gloss', 'stripe'], grip: 'foam', gripColour: '#8a5320', reel: 3,
    guides: [0.27, 0.49, 0.71, 0.89],
  },
  glacier: {
    path: 'M40.7 52 L73 17', width: 4.3, colour: '#bfe4f5',
    blank: ['taper', 'gloss', 'split'], grip: 'foam', gripColour: '#5d8fa8', reel: 3,
    guides: [0.26, 0.48, 0.7, 0.88],
  },
  glacierwall: {
    path: 'M40.7 52 L74 17', width: 4.4, colour: '#d8f0fb',
    blank: ['taper', 'gloss', 'split'], grip: 'crystal', gripColour: '#7fb8d4', reel: 3,
    guides: [0.25, 0.47, 0.69, 0.88],
  },
  abyss: {
    path: 'M40.7 52 L75 16', width: 4.5, colour: '#1d4a63',
    blank: ['taper', 'gloss', 'split'], grip: 'wrap', gripColour: '#0f2c3d', reel: 3,
    guides: [0.24, 0.46, 0.68, 0.87],
  },
  trenchline: {
    path: 'M40.7 52 L76 16', width: 4.6, colour: '#2b5f80',
    blank: ['taper', 'gloss', 'stripe', 'split'], grip: 'crystal', gripColour: '#17455f', reel: 3,
    guides: [0.23, 0.45, 0.67, 0.86],
  },


  'delta-1': {
    path: 'M40.7 52 L65.5 20.91', width: 4.61, colour: '#634e36',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 1,
    guides: [0.5, 0.68, 0.83, 0.94],
  },

  'marsh-1': {
    path: 'M40.7 52 L65.61 19.75', width: 4.66, colour: '#4e7437',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 2,
    guides: [0.497, 0.678, 0.829, 0.939],
  },

  'fjord-1': {
    path: 'M40.7 52 L65.87 18.68', width: 4.71, colour: '#376a86',
    blank: ['taper', 'notch'], grip: 'cork', gripColour: '#c9a37a', reel: 1,
    guides: [0.494, 0.676, 0.827, 0.938],
  },

  'deep-1': {
    path: 'M40.7 52 L66.08 19.05', width: 4.76, colour: '#36997d',
    blank: ['taper', 'wrap'], grip: 'wrap', gripColour: '#d9b483', reel: 2,
    guides: [0.491, 0.674, 0.826, 0.937],
  },

  'delta-2': {
    path: 'M40.7 52 L66.64 17.62', width: 4.8, colour: '#ad8234',
    blank: ['taper', 'split', 'wrap'], grip: 'foam', gripColour: '#3f5a6e', reel: 1,
    guides: [0.488, 0.672, 0.824, 0.936],
  },

  'marsh-2': {
    path: 'M40.7 52 L66.75 17.63', width: 4.85, colour: '#689d55',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 2,
    guides: [0.485, 0.67, 0.823, 0.935],
  },

  'fjord-2': {
    path: 'M40.7 52 L67.01 16.56', width: 4.9, colour: '#5585af',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 1,
    guides: [0.482, 0.668, 0.821, 0.934],
  },

  'deep-2': {
    path: 'M40.7 52 L67.17 15.85', width: 4.95, colour: '#5abcab',
    blank: ['taper', 'notch'], grip: 'cork', gripColour: '#c9a37a', reel: 2,
    guides: [0.479, 0.666, 0.82, 0.933],
  },

  'delta-3': {
    path: 'M40.7 52 L67.78 15.5', width: 5.0, colour: '#716028',
    blank: ['taper', 'wrap'], grip: 'wrap', gripColour: '#d9b483', reel: 1,
    guides: [0.476, 0.664, 0.818, 0.932],
  },

  'marsh-3': {
    path: 'M40.7 52 L67.89 14.34', width: 5.05, colour: '#358427',
    blank: ['taper', 'split', 'wrap'], grip: 'foam', gripColour: '#3f5a6e', reel: 2,
    guides: [0.473, 0.662, 0.817, 0.931],
  },

  'fjord-3': {
    path: 'M40.7 52 L68.15 14.44', width: 5.09, colour: '#425a7b',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 1,
    guides: [0.47, 0.66, 0.815, 0.93],
  },

  'deep-3': {
    path: 'M40.7 52 L68.81 13.82', width: 5.14, colour: '#428c88',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 2,
    guides: [0.467, 0.658, 0.814, 0.929],
  },

  'delta-4': {
    path: 'M40.7 52 L68.92 13.38', width: 5.19, colour: '#9f9341',
    blank: ['taper', 'notch'], grip: 'cork', gripColour: '#c9a37a', reel: 1,
    guides: [0.464, 0.656, 0.812, 0.928],
  },

  'marsh-4': {
    path: 'M40.7 52 L69.03 12.22', width: 5.24, colour: '#43b33f',
    blank: ['taper', 'wrap'], grip: 'wrap', gripColour: '#d9b483', reel: 2,
    guides: [0.461, 0.654, 0.81, 0.927],
  },

  'fjord-4': {
    path: 'M40.7 52 L69.84 12.32', width: 5.29, colour: '#3f68c6',
    blank: ['taper', 'split', 'wrap'], grip: 'foam', gripColour: '#3f5a6e', reel: 1,
    guides: [0.458, 0.652, 0.809, 0.926],
  },

  'deep-4': {
    path: 'M40.7 52 L69.9 10.62', width: 5.34, colour: '#68aaae',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 2,
    guides: [0.455, 0.65, 0.807, 0.925],
  },

  'delta-5': {
    path: 'M40.7 52 L70.06 10.09', width: 5.38, colour: '#686731',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 1,
    guides: [0.452, 0.648, 0.806, 0.924],
  },

  'marsh-5': {
    path: 'M40.7 52 L70.72 10.1', width: 5.43, colour: '#327937',
    blank: ['taper', 'notch'], grip: 'cork', gripColour: '#c9a37a', reel: 2,
    guides: [0.449, 0.646, 0.804, 0.923],
  },

  'fjord-5': {
    path: 'M40.7 52 L70.98 9.03', width: 5.48, colour: '#31428c',
    blank: ['taper', 'wrap'], grip: 'wrap', gripColour: '#d9b483', reel: 1,
    guides: [0.446, 0.644, 0.803, 0.922],
  },

  'deep-5': {
    path: 'M40.7 52 L70.99 8.59', width: 5.53, colour: '#308c9f',
    blank: ['taper', 'split', 'wrap'], grip: 'foam', gripColour: '#3f5a6e', reel: 2,
    guides: [0.443, 0.642, 0.801, 0.921],
  },

  'delta-6': {
    path: 'M40.7 52 L71.2 7.97', width: 5.58, colour: '#8b924f',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 1,
    guides: [0.44, 0.64, 0.8, 0.92],
  },

  'marsh-6': {
    path: 'M40.7 52 L71.86 7.98', width: 5.63, colour: '#4ea55f',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 2,
    guides: [0.437, 0.638, 0.798, 0.919],
  },

  'fjord-6': {
    path: 'M40.7 52 L72.12 6.91', width: 5.67, colour: '#4e56b7',
    blank: ['taper', 'notch'], grip: 'cork', gripColour: '#c9a37a', reel: 1,
    guides: [0.434, 0.636, 0.797, 0.918],
  },

  'deep-6': {
    path: 'M40.7 52 L72.63 6.56', width: 5.72, colour: '#53a3c3',
    blank: ['taper', 'wrap'], grip: 'wrap', gripColour: '#d9b483', reel: 2,
    guides: [0.431, 0.634, 0.795, 0.917],
  },

  'delta-7': {
    path: 'M40.7 52 L72.89 5.85', width: 5.77, colour: '#647623',
    blank: ['taper', 'split', 'wrap'], grip: 'foam', gripColour: '#3f5a6e', reel: 1,
    guides: [0.428, 0.632, 0.794, 0.916],
  },

  'marsh-7': {
    path: 'M40.7 52 L73.0 4.69', width: 5.82, colour: '#3c6f4c',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 2,
    guides: [0.425, 0.63, 0.792, 0.915],
  },

  'fjord-7': {
    path: 'M40.7 52 L73.26 4.79', width: 5.87, colour: '#3f3c80',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 1,
    guides: [0.422, 0.628, 0.791, 0.914],
  },

  'deep-7': {
    path: 'M40.7 52 L73.72 3.36', width: 5.92, colour: '#3c7093',
    blank: ['taper', 'notch'], grip: 'cork', gripColour: '#c9a37a', reel: 2,
    guides: [0.419, 0.626, 0.789, 0.913],
  },

  'delta-8': {
    path: 'M40.7 52 L74.03 2.56', width: 5.96, colour: '#83a63a',
    blank: ['taper', 'wrap'], grip: 'wrap', gripColour: '#d9b483', reel: 1,
    guides: [0.416, 0.624, 0.788, 0.912],
  },

  'marsh-8': {
    path: 'M40.7 52 L74.14 2.57', width: 6.01, colour: '#38bb6f',
    blank: ['taper', 'split', 'wrap'], grip: 'foam', gripColour: '#3f5a6e', reel: 2,
    guides: [0.413, 0.622, 0.786, 0.911],
  },

  'fjord-8': {
    path: 'M40.7 52 L74.4 1.5', width: 6.06, colour: '#685da8',
    blank: ['taper'], grip: 'wrap', gripColour: '#e8d3a8', reel: 1,
    guides: [0.41, 0.62, 0.785, 0.91],
  },

  'deep-8': {
    path: 'M40.7 52 L74.81 1.33', width: 6.11, colour: '#618ab5',
    blank: ['taper', 'split'], grip: 'foam', gripColour: '#2f4552', reel: 2,
    guides: [0.407, 0.618, 0.783, 0.909],
  },
};

/**
 * How far along the rod the grip runs, as fractions of the whole blank. Shared so a
 * rod is never drawn with a grip hanging off the end of its own shaft.
 */
/**
 * The Frutiger Aero finish for each rod.
 *
 * A colour swap is not a design, so every rod declares its own finish and no two
 * may share one. What makes a rod read as Frutiger rather than as fishing
 * equipment at this size is the wet gloss down the blank, the beads caught along
 * it, and chrome -- so those are data, not decoration baked into the drawing.
 *
 *   material  one of a fixed vocabulary, so finishes cannot drift into "wood-ish"
 *   accent    the rod's own second colour: bindings, bead, reel hub
 *   sheen     how wet the blank looks, 0 matte to 1 mirror. Deepens with price.
 *   beads     fractions along the blank where an Aero bubble sits, 0.4-1
 *   chrome    whether the blank picks up a chrome highlight. The Frutiger tell.
 *
 * Sheen and bead count both climb with price, so the ladder is legible as
 * progress: the rod you can afford looks less finished than the one you cannot.
 */
const ROD_FINISHES = {
  // ---- eight ordinary rods ------------------------------------------------
  bamboo: {
    material: 'bamboo', accent: '#7fc4a4', sheen: 0.08, beads: [0.55], chrome: false,
  },
  willow: {
    material: 'wood', accent: '#c9e58a', sheen: 0.16, beads: [0.52, 0.74], chrome: false,
  },
  carbon: {
    material: 'carbon', accent: '#8fd8ff', sheen: 0.26, beads: [0.5, 0.7, 0.86], chrome: false,
  },
  oak: {
    material: 'wood', accent: '#ffd07a', sheen: 0.34, beads: [0.48, 0.66, 0.82], chrome: false,
  },
  titan: {
    material: 'alloy', accent: '#dfeef8', sheen: 0.46, beads: [0.46, 0.64, 0.8, 0.92], chrome: true,
  },
  zephyr: {
    material: 'alloy', accent: '#a8f0ff', sheen: 0.55, beads: [0.45, 0.62, 0.78, 0.91], chrome: true,
  },
  quicksilver: {
    material: 'alloy', accent: '#eaf6ff', sheen: 0.66, beads: [0.44, 0.6, 0.76, 0.9], chrome: true,
  },
  horizon: {
    material: 'carbon', accent: '#9adcff', sheen: 0.74, beads: [0.43, 0.59, 0.75, 0.89], chrome: true,
  },

  // ---- trait rods ---------------------------------------------------------
  canopy: {
    material: 'composite', accent: '#b6f06a', sheen: 0.78, beads: [0.44, 0.6, 0.76, 0.9], chrome: true,
  },
  channel: {
    material: 'alloy', accent: '#ffb457', sheen: 0.8, beads: [0.43, 0.59, 0.75, 0.89], chrome: true,
  },
  understory: {
    material: 'composite', accent: '#d4ff7a', sheen: 0.82, beads: [0.43, 0.59, 0.75, 0.89], chrome: true,
  },
  spillway: {
    material: 'glass', accent: '#ffd9a0', sheen: 0.85, beads: [0.42, 0.58, 0.74, 0.88], chrome: true,
  },
  glacier: {
    material: 'glass', accent: '#c8f2ff', sheen: 0.88, beads: [0.42, 0.58, 0.74, 0.88], chrome: true,
  },
  glacierwall: {
    material: 'crystal', accent: '#eafaff', sheen: 0.91, beads: [0.41, 0.57, 0.73, 0.88], chrome: true,
  },
  abyss: {
    material: 'composite', accent: '#6f8cff', sheen: 0.94, beads: [0.41, 0.57, 0.73, 0.88], chrome: true,
  },
  trenchline: {
    material: 'crystal', accent: '#9fb6ff', sheen: 0.97, beads: [0.4, 0.56, 0.72, 0.87], chrome: true,
  },


  'delta-1': {
    material: 'alloy', accent: '#e7d26a', sheen: 0.97,
    beads: [0.46, 0.64, 0.81, 0.93], chrome: true,
  },

  'marsh-1': {
    material: 'carbon', accent: '#73e76a', sheen: 0.971,
    beads: [0.458, 0.639, 0.809, 0.929], chrome: false,
  },

  'fjord-1': {
    material: 'composite', accent: '#6a95e7', sheen: 0.972,
    beads: [0.456, 0.637, 0.808, 0.928], chrome: true,
  },

  'deep-1': {
    material: 'wood', accent: '#6ae5e7', sheen: 0.973,
    beads: [0.454, 0.636, 0.807, 0.928], chrome: false,
  },

  'delta-2': {
    material: 'bamboo', accent: '#e7e06a', sheen: 0.974,
    beads: [0.452, 0.634, 0.806, 0.927], chrome: true,
  },

  'marsh-2': {
    material: 'alloy', accent: '#6ae76e', sheen: 0.975,
    beads: [0.45, 0.633, 0.805, 0.926], chrome: false,
  },

  'fjord-2': {
    material: 'carbon', accent: '#6a87e7', sheen: 0.976,
    beads: [0.448, 0.631, 0.804, 0.925], chrome: true,
  },

  'deep-2': {
    material: 'composite', accent: '#6ad7e7', sheen: 0.977,
    beads: [0.446, 0.63, 0.803, 0.924], chrome: false,
  },

  'delta-3': {
    material: 'wood', accent: '#dee76a', sheen: 0.978,
    beads: [0.444, 0.628, 0.802, 0.924], chrome: true,
  },

  'marsh-3': {
    material: 'bamboo', accent: '#6ae77d', sheen: 0.979,
    beads: [0.442, 0.627, 0.801, 0.923], chrome: false,
  },

  'fjord-3': {
    material: 'alloy', accent: '#6a79e7', sheen: 0.98,
    beads: [0.44, 0.625, 0.8, 0.922], chrome: true,
  },

  'deep-3': {
    material: 'carbon', accent: '#6ac8e7', sheen: 0.981,
    beads: [0.438, 0.624, 0.799, 0.921], chrome: false,
  },

  'delta-4': {
    material: 'composite', accent: '#d1e76a', sheen: 0.982,
    beads: [0.436, 0.622, 0.798, 0.92], chrome: true,
  },

  'marsh-4': {
    material: 'wood', accent: '#6ae78b', sheen: 0.983,
    beads: [0.434, 0.621, 0.797, 0.92], chrome: false,
  },

  'fjord-4': {
    material: 'bamboo', accent: '#6a6ae7', sheen: 0.984,
    beads: [0.432, 0.619, 0.796, 0.919], chrome: true,
  },

  'deep-4': {
    material: 'alloy', accent: '#6abae7', sheen: 0.985,
    beads: [0.43, 0.618, 0.795, 0.918], chrome: false,
  },

  'delta-5': {
    material: 'carbon', accent: '#c4e76a', sheen: 0.985,
    beads: [0.428, 0.616, 0.794, 0.917], chrome: true,
  },

  'marsh-5': {
    material: 'composite', accent: '#6ae798', sheen: 0.986,
    beads: [0.426, 0.615, 0.793, 0.916], chrome: false,
  },

  'fjord-5': {
    material: 'wood', accent: '#786ae7', sheen: 0.987,
    beads: [0.424, 0.613, 0.792, 0.916], chrome: true,
  },

  'deep-5': {
    material: 'bamboo', accent: '#6aace7', sheen: 0.988,
    beads: [0.422, 0.612, 0.791, 0.915], chrome: false,
  },

  'delta-6': {
    material: 'alloy', accent: '#b4e76a', sheen: 0.989,
    beads: [0.42, 0.61, 0.79, 0.914], chrome: true,
  },

  'marsh-6': {
    material: 'carbon', accent: '#6ae7a8', sheen: 0.99,
    beads: [0.418, 0.609, 0.789, 0.913], chrome: false,
  },

  'fjord-6': {
    material: 'composite', accent: '#866ae7', sheen: 0.991,
    beads: [0.416, 0.607, 0.788, 0.912], chrome: true,
  },

  'deep-6': {
    material: 'wood', accent: '#6a9ee7', sheen: 0.992,
    beads: [0.414, 0.606, 0.787, 0.912], chrome: false,
  },

  'delta-7': {
    material: 'bamboo', accent: '#a6e76a', sheen: 0.993,
    beads: [0.412, 0.604, 0.786, 0.911], chrome: true,
  },

  'marsh-7': {
    material: 'alloy', accent: '#6ae7b6', sheen: 0.994,
    beads: [0.41, 0.603, 0.785, 0.91], chrome: false,
  },

  'fjord-7': {
    material: 'carbon', accent: '#956ae7', sheen: 0.995,
    beads: [0.408, 0.601, 0.784, 0.909], chrome: true,
  },

  'deep-7': {
    material: 'composite', accent: '#6a8fe7', sheen: 0.996,
    beads: [0.406, 0.6, 0.783, 0.908], chrome: false,
  },

  'delta-8': {
    material: 'wood', accent: '#99e76a', sheen: 0.997,
    beads: [0.404, 0.598, 0.782, 0.908], chrome: true,
  },

  'marsh-8': {
    material: 'bamboo', accent: '#6ae7c4', sheen: 0.998,
    beads: [0.402, 0.597, 0.781, 0.907], chrome: false,
  },

  'fjord-8': {
    material: 'alloy', accent: '#a26ae7', sheen: 0.999,
    beads: [0.4, 0.595, 0.78, 0.906], chrome: true,
  },

  'deep-8': {
    material: 'carbon', accent: '#6a81e7', sheen: 1.0,
    beads: [0.398, 0.594, 0.779, 0.905], chrome: false,
  },
};
const GRIP_FROM = 0.1;
const GRIP_TO = 0.36;


const LURE_OFFSET = 0.6;   // nudge the lure just past the tip so it sits on the end

/** Tip coordinates are derived from the path, never typed twice. */
/**
 * Space the guides up the blank, clear of the grip and short of the tip. Derived
 * rather than hand-typed: oak's first guide was hand-written at exactly 0.36, the
 * grip's own end, so it sat on the cork instead of up the shaft.
 */
function guidePositions(look) {
  const first = GRIP_TO + 0.06;
  const last = 0.9;
  const n = Math.max(2, (look.guides ?? []).length);
  const out = [];
  for (let k = 0; k < n; k += 1) {
    // Guides bunch toward the tip, which is how a real blank is fitted.
    const t = k / (n - 1);
    out.push(Number((first + (last - first) * (t ** 0.72)).toFixed(3)));
  }
  return out;
}

function withTip(look) {
  const end = look.path.split('L')[1].trim().split(/\s+/).map(Number);
  const start = look.path.split('M')[1].split('L')[0].trim().split(/\s+/).map(Number);
  // A point t of the way along the blank, so the grip and the guides sit ON the
  // shaft instead of being hand-placed coordinates that drift the moment a rod's
  // path changes.
  const at = (t) => ({
    x: start[0] + (end[0] - start[0]) * t,
    y: start[1] + (end[1] - start[1]) * t,
  });
  return {
    ...look,
    buttX: start[0],
    buttY: start[1],
    tipX: end[0] + LURE_OFFSET,
    tipY: end[1] - LURE_OFFSET,
    gripFrom: GRIP_FROM,
    gripTo: GRIP_TO,
    // The widest part of the blank, at the butt, for the taper wedge.
    heelWidth: look.width * 2.1,
    reelR: [0, 1.1, 1.5, 1.9][look.reel] ?? 0,
    guides: guidePositions(look),
    guidePoints: guidePositions(look).map((t) => ({ t, ...at(t), r: 0.5 + look.width * 0.12 })),
    gripPoints: { from: at(GRIP_FROM), to: at(GRIP_TO) },
    reelAt: at(GRIP_TO + 0.05),
    endX: end[0],
    endY: end[1],
    pointAt: at,
  };
}

export const ROD_ART = Object.fromEntries(
  Object.entries(ROD_LOOKS).map(([id, look]) => [
    id,
    withTip({ ...look, finish: ROD_FINISHES[id] ?? ROD_FINISHES.bamboo }),
  ]),
);

/**
 * The hooked fish, as a silhouette.
 *
 * During the reel the fish was a 4px yellow bar: every fish in the game looked
 * identical, so the player had no idea what they were fighting. A silhouette is
 * the fix -- you can see it is long and sinuous and know to be careful.
 *
 * Deliberately NOT fishSvg(). Two reasons. It redraws every frame of the reel,
 * and the full version carries five gradients, a filter and up to ten sparkles.
 * And the silhouette is meant to show SHAPE ONLY: no name, no rarity, no hue of
 * the real fish. You should learn what you hooked by fighting it.
 */
export function fishSilhouette(fish) {
  const spec = FISH.find((f) => f && f.id === (fish && fish.id)) ?? FISH[0];
  // An unknown `draw` falls back rather than throwing: a new fish with a typo in
  // its shape should still be visible on the reel, not an empty box.
  const shape = FISH_SHAPES[spec.draw] ?? FISH_SHAPES[FISH[0].draw];

  // Namespaced per fish for the same reason fishSvg's are: bare ids duplicated in
  // the document made url(#...) resolve to whichever came first.
  const id = `fa-sil-${spec.id}`;

  // One dark fill for the whole shape, lighter at the top. Flat, and dark against
  // the bright reel track -- a silhouette has to read as a solid object.
  return `<svg class="reel__silhouette" viewBox="0 0 104 80" `
    + `role="img" aria-label="The shape of the fish on your line" `
    + `preserveAspectRatio="xMidYMid meet">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="#123a52" stop-opacity=".95"/>`
    + `<stop offset="1" stop-color="#061a29" stop-opacity=".98"/>`
    + `</linearGradient></defs>`
    + `<g fill="url(#${id})">`
    // Tail behind the body, or the join shows.
    + `<path d="${shape.tail}"/>`
    + `<path d="${shape.body}"/>`
    + `<path d="${shape.fin}"/>`
    + `</g>`
    // The eye: a pale hole, so the fish is facing you and not a blob.
    + `<circle cx="${shape.eye.cx}" cy="${shape.eye.cy}" r="${shape.eye.r}" `
    + `fill="#cfeaf6" fill-opacity=".85"/>`
    + `</svg>`;
}

/** The scene art for a rod, falling back to the starting rod for anything unknown. */
export function rodArt(rodId) {
  return ROD_ART[rodId] ?? ROD_ART.bamboo;
}

/** Every rod id, cheapest first. The shop and the inventory both list them in order. */
export const RODS_BY_PRICE = Object.keys(RODS)
  .sort((a, b) => RODS[a].price - RODS[b].price);

/* ------------------------------------------------------------------- fish */

/**
 * fight: how violently the fish moves the reeling line, 0 (docile) to 1 (Mythical).
 * draw/hue: how angler.js paints it, so this file needs no canvas.
 *
 * Names are original and Frutiger-themed on purpose — not real species, and not
 * Fisch's. Rarity order matches Fisch's so the difficulty curve reads the same.
 */
export const FISH = [
/* ---- the Epic tier, and the high tiers every lake was missing ------- *
   * Until now each lake held a band of tiers and the rarer fish only turned up
   * in the deepest water. Every lake now carries Rare, Epic, Legendary and
   * Mythical, so a beginner can meet something genuinely rare on lake one and
   * still have a Mythical to chase at the bottom.
   *
   * Epic weights are chosen together, not per fish: the index shows the real
   * odds per tier, and those must stay strictly monotonic. Epic as a whole has
   * to weigh more than Legendary (24) and less than Rare (48).
   */

  { id: 'glidefin', name: 'Glidefin', rarity: 'Common', pricePerKg: 4, minKg: 0.4, maxKg: 2, fight: 0.35, hue: 195, draw: 'slim', weight: 30,
    hook: 'The wind picks up. You feel something small skimming across the top.' },
  { id: 'sunscale', name: 'Sunscale', rarity: 'Common', pricePerKg: 7, minKg: 0.5, maxKg: 2.4, fight: 0.4, hue: 48, draw: 'slim', weight: 22,
    hook: 'Warm as a windowsill. You feel it turn towards the light.' },
  { id: 'bubbleperch', name: 'Bubble Perch', rarity: 'Common', pricePerKg: 8, minKg: 0.4, maxKg: 1.8, fight: 0.42, hue: 160, draw: 'deep', weight: 16,
    hook: 'It blows a small burst of bubbles. You feel the line twitch and think it is a fish.' },
  { id: 'aero-minnow', name: 'Aero Minnow', rarity: 'Common', pricePerKg: 6, minKg: 0.3, maxKg: 1.2, fight: 0.45, hue: 210, draw: 'slim', weight: 26,
    hook: 'A flicker of silver. You feel the line go slack, then taut again.' },
  { id: 'ripplefin', name: 'Ripplefin', rarity: 'Common', pricePerKg: 9, minKg: 0.6, maxKg: 2.8, fight: 0.5, hue: 178, draw: 'flat', weight: 18,
    hook: 'The surface dimples where it goes. You feel the ring travel up the line.' },
  { id: 'glossdace', name: 'Gloss Dace', rarity: 'Common', pricePerKg: 10, minKg: 0.7, maxKg: 3.1, fight: 0.55, hue: 200, draw: 'slim', weight: 14,
    hook: 'Silver under the light, gone again. You feel it hesitate before it commits.' },
  { id: 'metro-trout', name: 'Metro Trout', rarity: 'Uncommon', pricePerKg: 18, minKg: 1.5, maxKg: 5.5, fight: 0.6, hue: 150, draw: 'deep', weight: 20,
    hook: 'You feel it darting under the surface, quick and stubborn.' },
  { id: 'coralpike', name: 'Coral Pike', rarity: 'Uncommon', pricePerKg: 24, minKg: 2, maxKg: 7, fight: 0.65, hue: 20, draw: 'deep', weight: 14,
    hook: 'You feel it hold station in the warm shallows, refusing to move.' },
  { id: 'reedcarp', name: 'Reed Carp', rarity: 'Uncommon', pricePerKg: 26, minKg: 2.4, maxKg: 8.5, fight: 0.68, hue: 95, draw: 'deep', weight: 11,
    hook: 'Something grinds through the reeds. You feel the line judder as it passes.' },
  { id: 'duskdarter', name: 'Dusk Darter', rarity: 'Uncommon', pricePerKg: 22, minKg: 1.2, maxKg: 4.6, fight: 0.7, hue: 330, draw: 'slim', weight: 12,
    hook: 'A shadow crosses the line. You feel it gone before you see it.' },
  { id: 'lanternjack', name: 'Lantern Jack', rarity: 'Uncommon', pricePerKg: 28, minKg: 1.8, maxKg: 6.4, fight: 0.72, hue: 55, draw: 'flat', weight: 10,
    hook: 'A pale light moves under the surface. You feel it drift, unhurried.' },
  { id: 'snowsmelt', name: 'Snowsmelt', rarity: 'Uncommon', pricePerKg: 30, minKg: 2.6, maxKg: 9, fight: 0.73, hue: 190, draw: 'slim', weight: 9,
    hook: 'Meltwater runs down the line. You feel the cold coming from upstream.' },
  { id: 'mudsole', name: 'Mud Sole', rarity: 'Rare', pricePerKg: 58, minKg: 3.5, maxKg: 12, fight: 0.74, hue: 88, draw: 'flat', weight: 8,
    hook: 'The line goes slack and stays slack. You feel it working something over.' },
  { id: 'doric-dab', name: 'DORFic Dab', rarity: 'Rare', pricePerKg: 55, minKg: 0.8, maxKg: 3.4, fight: 0.75, hue: 45, draw: 'flat', weight: 12,
    hook: 'The line drags low. You feel whatever this is hugging the bottom.' },
  { id: 'glowmote', name: 'Glowmote', rarity: 'Rare', pricePerKg: 88, minKg: 24, maxKg: 70, fight: 0.75, hue: 200, draw: 'slim', weight: 7,
    hook: 'A small cold light on your line, dragging its own glow behind it.' },
  { id: 'prismminnow', name: 'Prism Minnow', rarity: 'Rare', pricePerKg: 15, minKg: 1.2, maxKg: 3.6, fight: 0.76, hue: 250, draw: 'slim', weight: 3,
    hook: 'The water breaks into colours, and you spot something small and bright inside it.' },
  { id: 'orangebarbel', name: 'Orange Barbel', rarity: 'Rare', pricePerKg: 62, minKg: 4, maxKg: 14, fight: 0.78, hue: 32, draw: 'deep', weight: 8,
    hook: 'You feel it dive for the warm bottom and hold there, heavy and sure.' },
  { id: 'emberfin', name: 'Emberfin', rarity: 'Rare', pricePerKg: 76, minKg: 4.5, maxKg: 16, fight: 0.8, hue: 12, draw: 'long', weight: 7,
    hook: 'The line comes back warm. You feel the heat before the weight.' },
  { id: 'mirrorpike', name: 'Mirror Pike', rarity: 'Rare', pricePerKg: 70, minKg: 5, maxKg: 18, fight: 0.82, hue: 168, draw: 'long', weight: 7,
    hook: 'You feel something long decide to move, and then it simply does.' },
  { id: 'frostfin', name: 'Frostfin', rarity: 'Rare', pricePerKg: 88, minKg: 6, maxKg: 22, fight: 0.84, hue: 196, draw: 'long', weight: 6,
    hook: 'Ice ticks against the line. You feel it hold perfectly still, waiting.' },
  { id: 'canopycat', name: 'Canopy Catfish', rarity: 'Epic', pricePerKg: 71, minKg: 12, maxKg: 34, fight: 0.85, hue: 145, draw: 'deep', weight: 5,
    hook: 'Something broad moves under the reeds, and not one of them shifts for you.' },
  { id: 'haloherring', name: 'Halo Herring', rarity: 'Epic', pricePerKg: 34, minKg: 3, maxKg: 9, fight: 0.86, hue: 285, draw: 'deep', weight: 12,
    hook: 'A ring of light rides the surface beside it, and you have never seen one down there.' },
  { id: 'aurorachar', name: 'Aurora Char', rarity: 'Epic', pricePerKg: 96, minKg: 20, maxKg: 58, fight: 0.87, hue: 250, draw: 'deep', weight: 4,
    hook: 'It glows green and violet under the ice, and you could swear the ice approves.' },
  { id: 'eventhorizon', name: 'Event Horizon', rarity: 'Epic', pricePerKg: 190, minKg: 38, maxKg: 105, fight: 0.88, hue: 305, draw: 'long', weight: 5,
    hook: 'Your line goes slack, then tightens all at once. Something enormous turns over.' },
  { id: 'rivetray', name: 'Rivet Ray', rarity: 'Epic', pricePerKg: 52, minKg: 5, maxKg: 15, fight: 0.89, hue: 265, draw: 'flat', weight: 5,
    hook: 'It holds one perfectly straight line, and you watch the channel narrow behind it.' },
  { id: 'blueglass', name: 'Blueglass', rarity: 'Legendary', pricePerKg: 168, minKg: 9, maxKg: 34, fight: 0.87, hue: 215, draw: 'deep', weight: 4,
    hook: 'You feel something turn over, slow and heavy, like a pane of glass.' },
  { id: 'daylight', name: 'Daylight Marlin', rarity: 'Legendary', pricePerKg: 96, minKg: 6, maxKg: 22, fight: 0.87, hue: 15, draw: 'long', weight: 3,
    hook: 'It comes up sideways and the whole lake turns over underneath it, for you.' },
  { id: 'eco-gar', name: 'Eco Gar', rarity: 'Legendary', pricePerKg: 140, minKg: 12, maxKg: 40, fight: 0.88, hue: 110, draw: 'long', weight: 8,
    hook: 'You feel the power of the environment surge up the line.' },
  { id: 'signalfin', name: 'Signalfin', rarity: 'Legendary', pricePerKg: 128, minKg: 9, maxKg: 26, fight: 0.88, hue: 5, draw: 'slim', weight: 3,
    hook: 'Three short pulls, then a long one. You read it as a message, not a fight.' },
  { id: 'rimepike', name: 'Rime Pike', rarity: 'Legendary', pricePerKg: 155, minKg: 10, maxKg: 38, fight: 0.9, hue: 205, draw: 'long', weight: 5,
    hook: 'You feel the cold come off the line in waves. It is not struggling. It is waiting.' },
  { id: 'deepglow', name: 'Deepglow', rarity: 'Legendary', pricePerKg: 205, minKg: 16, maxKg: 60, fight: 0.93, hue: 262, draw: 'long', weight: 4,
    hook: 'You feel a light on the other end of the line. It is not your lamp.' },
  { id: 'pressurefin', name: 'Pressurefin', rarity: 'Legendary', pricePerKg: 228, minKg: 20, maxKg: 70, fight: 0.95, hue: 250, draw: 'deep', weight: 3,
    hook: 'The line hums with pressure. You feel the weight of the water itself.' },
  { id: 'blackmirror', name: 'Blackmirror', rarity: 'Mythical', pricePerKg: 390, minKg: 24, maxKg: 88, fight: 0.97, hue: 240, draw: 'deep', weight: 2,
    hook: 'The line goes dead, and then you feel it pull again, from straight down.' },
  { id: 'voidpike', name: 'Voidpike', rarity: 'Mythical', pricePerKg: 355, minKg: 26, maxKg: 96, fight: 0.98, hue: 285, draw: 'long', weight: 2,
    hook: 'You feel it take the line and hold it, out past where light gives up.' },
  { id: 'zenith', name: 'Zenith Koi', rarity: 'Mythical', pricePerKg: 260, minKg: 7, maxKg: 26, fight: 0.98, hue: 300, draw: 'long', weight: 1,
    hook: 'You realise you have been fishing the surface of the sun this entire time.' },
  { id: 'civiceel', name: 'Civic Eel', rarity: 'Mythical', pricePerKg: 340, minKg: 11, maxKg: 30, fight: 0.99, hue: 340, draw: 'long', weight: 1,
    hook: 'The current stops to let it past, and you understand you should wait your turn.' },
  { id: 'verdant', name: 'Verdant Warden', rarity: 'Mythical', pricePerKg: 410, minKg: 16, maxKg: 44, fight: 0.99, hue: 250, draw: 'long', weight: 1,
    hook: 'The marsh lights up from below it. You feel the environment push back.' },
  { id: 'glacier-char', name: 'Glacier Char', rarity: 'Mythical', pricePerKg: 320, minKg: 30, maxKg: 110, fight: 1, hue: 275, draw: 'long', weight: 4,
    hook: 'The cold runs up your arm. This one is older than the ice.' },
  { id: 'lastlantern', name: 'Lastlantern', rarity: 'Mythical', pricePerKg: 420, minKg: 30, maxKg: 120, fight: 1, hue: 190, draw: 'long', weight: 1,
    hook: 'You feel the line go warm for the first time in your life.' },

];;

export const RARITY_COLOURS = {
  Common: '#7ea8bd',
  Uncommon: '#7aa84a',
  Rare: '#e07b2a',
  Epic: '#7b3fe4',        // violet: sits between Rare's orange and Mythical's purple
  Legendary: '#c8a02e',
  Mythical: '#8b5cf6',
};

/* Rare first, so an index or a guide can walk the tiers in order without
   re-declaring them. Exported at the bottom of this file. */
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'];

/* The share of casts each tier accounts for, as a percentage. rollFish() picks a
   fish by weight within the whole table, so these are derived from the weights
   rather than declared separately — see fishIndex(), which computes them. */

/* ------------------------------------------------------------------ casts */

/** 'perfect' | 'good' | 'poor' for a meter position in 0..1. */
export function castQuality(meter) {
  const value = Math.min(Math.max(meter, 0), 1);
  if (value >= PERFECT_BAND.from && value <= PERFECT_BAND.to) return 'perfect';
  return value >= GOOD_BAND ? 'good' : 'poor';
}

/** How far the bobber flies, as a fraction of the maximum range. */
export function castDistance(quality) {
  return CAST_REACH[quality] ?? CAST_REACH.poor;
}

/* ------------------------------------------------------------------- bites */

/**
 * Wait time before the bite, in ms. Lure speed shortens it; luck shortens it
 * slightly. `seed` in 0..1 controls the jitter so the caller owns randomness.
 */
export function biteDelayFor(rod, { baseMs = BITE_BASE_MS, seed = Math.random() } = {}) {
  const speed = Math.max(1, rod?.lureSpeed || 1);
  const luckShortening = Math.min(LUCK_BITE_CAP, (rod?.luck || 0) * LUCK_BITE_SHORTENING);
  const base = (baseMs / speed) * (1 - luckShortening);
  const spread = (BITE_JITTER_MS / speed) * Math.min(Math.max(seed, 0), 1);
  return Math.max(BITE_MIN_MS, Math.round(base + spread));
}

/* --------------------------------------------------------------- the table */

/**
 * Weighted roll over the fish table. `roll` is a uniform 0..1 from the caller.
 * Luck multiplies the weight of everything rarer than Common, scaled by how
 * far down the table a fish sits, so the good stuff drifts up gradually.
 */
export function rollFish(roll, rod, areaId) {
  // Only the fish living in the water you are standing in are on the table. An
  // unknown id falls back to the first lake, which is always open.
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  const pool = area.fish.map((id) => FISH.find((f) => f.id === id)).filter(Boolean);
  const table = pool.length ? pool : FISH;

  const luck = Math.max(0, rod?.luck || 0);
  // Depth comes from the fish's RARITY, not its position in the lake's list.
  //
  // It used to be the pool index over the whole table, which meant a lake's
  // ordering decided what luck did. Dark Aero Deep lists its Mythicals first, so
  // adding a Rare and an Epic after them left the Mythicals at depth ~0 — a
  // luckier rod could not make them any more likely, which is backwards. Now a
  // Mythical is always deeper than a Rare, wherever it sits.
  const top = Math.max(1, RARITY_ORDER.length - 1);
  const weights = table.map((fish) => {
    const base = fish.weight ?? 1;
    const tier = RARITY_ORDER.indexOf(fish.rarity);
    const boost = tier <= 0 ? 1 : 1 + luck * (tier / top) * 2;
    return base * boost;
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (let i = 0; i < table.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return table[i];
  }
  return table[0];
}

/** Roll a mutation. Weights are percentages and must total 100. */
export function rollMutation(roll = Math.random()) {
  const total = MUTATIONS.reduce((sum, m) => sum + m.weight, 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const mutation of MUTATIONS) {
    cursor -= mutation.weight;
    if (cursor <= 0) return mutation;
  }
  return MUTATIONS[0];
}

/* ------------------------------------------------------------------ money */

/** Roll a weight for `fish` inside its own bounds. `roll` in 0..1. */
export function fishWeight(fish, roll = Math.random()) {
  const span = fish.maxKg - fish.minKg;
  const clamped = Math.min(Math.max(roll, 0), 1);
  return Math.round((fish.minKg + span * clamped) * 100) / 100;
}

/** Can this rod land a fish of this weight? Above the ceiling, the line snaps. */
export function canCatch(fish, weight, rod) {
  return weight <= rod.maxKg;
}

export function catchValue(fish, weight, mutationMultiplier = 1) {
  return Math.round(fish.pricePerKg * weight * mutationMultiplier);
}

/**
 * The wallet starts with enough to buy the first upgrade, so the shop is
 * reachable immediately rather than after an hour of grinding the worst rod.
 */
export function startingLoadout() {
  return { rodId: 'bamboo', coins: RODS.willow.price };
}

/* ------------------------------------------------------------------- shop */

/**
 * Attempt a purchase. Never mutates the wallet: on failure the caller gets the
 * same coins and rod back plus a reason.
 */
export function buyRod(wallet, rodId, { areaId = null, level = 1 } = {}) {
  const rod = RODS[rodId];
  if (!rod) return { ...wallet, ok: false, reason: 'Unknown rod.' };

  // A traited rod is only bought where its trait means something. Buying a
  // Glacier Lance from Aero Lake gave you a rod you could not use and a lesson
  // nobody had asked for.
  if (rod.traits.length) {
    const here = AREAS.find((a) => a.id === areaId);
    const wanted = AREAS.filter((a) => a.trait && rod.traits.includes(a.trait));
    const fits = here?.trait && rod.traits.includes(here.trait);
    if (!fits) {
      const names = wanted.map((a) => a.name).join(' or ');
      return {
        ...wallet,
        ok: false,
        reason: here?.trait
          ? `${rod.name} is a ${here.name} rod. Buy it from ${names}.`
          : `${rod.name} can only be bought at ${names}.`,
      };
    }
  }

  // Rank gate. Rods had none, so luck went from the starting pole to the best rod
  // in the game with nothing between but coins -- while seals were gated by rank
  // all along, which is why a lucky rod felt like a lottery.
  const rank = Number.isFinite(level) ? level : 1;
  if (rank < rod.level) {
    return { ...wallet, ok: false, reason: `${rod.name} needs rank ${rod.level}.` };
  }

  if (wallet.coins < rod.price) {
    return { ...wallet, ok: false, reason: 'Not enough coins.' };
  }
  return { ok: true, rodId, coins: wallet.coins - rod.price };
}

/* ------------------------------------------------------------- inventory */

/** The rods you own, cheapest first. Everyone starts with the bamboo pole. */
export function startingInventory() {
  return ['bamboo'];
}

export function ownsRod(inventory, rodId) {
  return Array.isArray(inventory) && inventory.includes(rodId);
}

/**
 * Put a rod in the bag. Never duplicates, always keeps price order so the shop can
 * list owned and unowned rods together without sorting twice.
 */
export function addRodToInventory(inventory, rodId) {
  const owned = Array.isArray(inventory) ? inventory.filter((id) => RODS[id]) : [];
  if (!RODS[rodId] || owned.includes(rodId)) return [...owned];
  return [...owned, rodId].sort((a, b) => RODS[a].price - RODS[b].price);
}

/**
 * Equip an owned rod. This is free and separate from buying, which is the point of
 * an inventory: you can go back to an earlier rod without paying again.
 */
export function equipRod(inventory, rodId) {
  if (!ownsRod(inventory, rodId)) {
    return { rodId: inventory?.[0] ?? 'bamboo', ok: false, reason: 'You do not own that rod.' };
  }
  return { rodId, ok: true };
}

/* ---------------------------------------------------------- fish visuals */

/**
 * Body shapes for the catch card. The `draw` field on every fish picks one, and the
 * `hue` tints it. Coordinates are in a 120x80 box with the fish facing right.
 *
 * Kept here rather than in angler.js so the drawing is testable without a DOM, and
 * so a fish's look lives with its data.
 */
export const FISH_SHAPES = {
  /** Slim and quick: the small, fast fish. */
  slim: {
    body: 'M34 40 C44 26 66 24 80 34 C88 40 88 42 80 48 C66 58 44 56 34 42 Z',
    tail: 'M34 40 L12 24 L18 40 L12 58 Z',
    fin: 'M56 34 C60 26 66 24 70 28 C66 32 62 36 58 42 Z',
    eye: { cx: 72, cy: 38, r: 3.4 },
    stripe: 'M48 33 L52 49 M58 32 L62 50 M68 34 L72 46',
  },
  /** Deep-bodied and broad: the trout-like fish. */
  deep: {
    body: 'M32 40 C42 20 70 18 84 32 C92 40 92 44 84 50 C70 62 42 60 32 40 Z',
    tail: 'M32 40 L8 20 L16 40 L8 62 Z',
    fin: 'M56 26 C62 14 72 12 78 18 C72 22 66 28 60 38 Z',
    eye: { cx: 76, cy: 36, r: 4 },
    stripe: 'M46 28 L50 56 M58 25 L62 59 M70 28 L74 54',
  },
  /** Flat and wide, low in the water: the dab. */
  flat: {
    body: 'M30 42 C40 28 72 26 86 36 C94 42 94 46 86 52 C72 60 40 58 30 42 Z',
    tail: 'M30 42 L8 32 L14 42 L8 54 Z',
    fin: 'M58 32 C64 22 74 20 80 26 C74 30 68 34 62 40 Z',
    eye: { cx: 78, cy: 40, r: 3.6 },
    stripe: 'M44 34 C56 30 70 32 82 38 M44 50 C58 54 72 52 82 46',
  },
  /** Long and sinuous: the big legendary fish. */
  long: {
    body: 'M26 40 C38 22 74 18 90 30 C100 38 100 44 90 50 C74 62 38 58 26 40 Z',
    tail: 'M26 40 L4 18 L13 40 L4 64 Z',
    fin: 'M54 26 C62 12 74 10 82 16 C74 20 66 28 58 38 Z',
    eye: { cx: 82, cy: 36, r: 4.2 },
    stripe: 'M40 28 L44 54 M52 25 L56 57 M64 24 L68 56 M76 26 L80 52',
  },
};

/**
 * Render a fish as a standalone SVG string, tinted by its hue and built from its
 * shape. Rarer fish get a warmer highlight so a Mythical reads as special at a
 * glance, not just by the rarity pips.
 *
 * @param {object} fish  a FISH entry; anything unknown falls back to the first fish
 * @returns {string} an SVG element, ready to drop into innerHTML
 */
export function fishSvg(fish) {
  const spec = FISH.find((f) => f && f.id === (fish && fish.id)) ?? FISH[0];
  const shape = FISH_SHAPES[spec.draw] ?? FISH_SHAPES[FISH[0].draw];
  const h = spec.hue ?? FISH[0].hue;
  const { eye } = shape;

  /* Every id here is namespaced per fish. They used to be a flat id="fb" and
   * id="fs", so six fish in the index produced six copies of each and url(#fb)
   * resolved to whichever gradient came first in the document. */
  const id = `fa-${spec.id}`;
  const body_ = `url(#${id}-body)`;
  const fin_ = `url(#${id}-fin)`;
  const tail_ = `url(#${id}-tail)`;
  const sheen_ = `url(#${id}-sheen)`;
  const bloom_ = `url(#${id}-bloom)`;

  // A deeper, more saturated set than the old pastel trio: maximalist Aero wants
  // a lit top surface falling into a deep, saturated belly.
  const top = `hsl(${h} 92% 78%)`;
  const high = `hsl(${h} 88% 62%)`;
  const mid = `hsl(${h} 78% 46%)`;
  const low = `hsl(${h} 72% 28%)`;
  const deep = `hsl(${h} 68% 17%)`;

  // Rarer fish get more of everything: more sparkle, a brighter bloom, a crown of
  // light. This is the visual half of the rarity curve.
  const tier = RARITY_ORDER.indexOf(spec.rarity);              // 0 Common .. 4 Mythical
  const lavish = tier;                                          // 0 for Common, 4 for Mythical
  const sparkleCount = 2 + tier * 2;                            // 2 for Common, 10 for Mythical
  const glow = 1.4 + tier * 1.1;                                // rarer fish glow harder
  const sparkleR = 4.6 - tier * 0.5;                            // and their glints tighten
  const crown = tier >= 3;                                      // Legendary and up

  // Sparkles sit on a spread-out ring so they read as scattered glints.
  const sparkles = Array.from({ length: sparkleCount }, (_, n) => {
    const angle = (n / sparkleCount) * Math.PI * 2 + 0.4;
    const rx = 46 + ((n * 13) % 9);
    const ry = 30 + ((n * 7) % 7);
    const cx = (60 + Math.cos(angle) * rx * 0.62).toFixed(1);
    const cy = (40 + Math.sin(angle) * ry * 0.5).toFixed(1);
    const r = (sparkleR + ((n * 3) % 2) * 0.7).toFixed(2);
    return `<path class="sparkle" d="M${cx} ${(+cy - +r).toFixed(1)}
      L${(+cx + +r * 0.32).toFixed(1)} ${(+cy - +r * 0.32).toFixed(1)}
      L${cx} ${(+cy + +r).toFixed(1)}
      L${(+cx - +r * 0.32).toFixed(1)} ${(+cy - +r * 0.32).toFixed(1)} Z"
      fill="#ffffff" opacity="${(0.5 + lavish * 0.09).toFixed(2)}"/>`;
  }).join('\n    ');

  const bubbles = Array.from({ length: 4 + lavish }, (_, n) => {
    const cx = 14 + ((n * 23) % 96);
    const cy = 12 + ((n * 31) % 58);
    const r = (1.8 + ((n * 5) % 4) * 0.7).toFixed(1);
    return `<circle class="bubbles" cx="${cx}" cy="${cy}" r="${r}"
      fill="#ffffff" opacity="${(0.34 + ((n % 3) * 0.12)).toFixed(2)}"/>`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"
     role="img" aria-label="A ${spec.name}">
  <defs>
    <!-- the body: a lit dorsal surface falling to a deep belly -->
    <linearGradient id="${id}-body" x1="0.18" y1="0" x2="0.72" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="0.34" stop-color="${high}"/>
      <stop offset="0.62" stop-color="${mid}"/>
      <stop offset="1" stop-color="${deep}"/>
    </linearGradient>
    <linearGradient id="${id}-fin" x1="0.3" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${high}"/>
      <stop offset="1" stop-color="${low}"/>
    </linearGradient>
    <linearGradient id="${id}-tail" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="${low}"/>
      <stop offset="1" stop-color="${deep}"/>
    </linearGradient>
    <!-- the specular sweep across the back -->
    <radialGradient id="${id}-sheen" cx="0.32" cy="0.22" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".85"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity=".18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <!-- light spilling out of the fish; stronger on rare ones -->
    <radialGradient id="${id}-bloom" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="hsl(${h} 100% 82%)" stop-opacity="${(0.3 + lavish * 0.11).toFixed(2)}"/>
      <stop offset="0.6" stop-color="hsl(${h} 100% 78%)" stop-opacity="${(0.12 + lavish * 0.06).toFixed(2)}"/>
      <stop offset="1" stop-color="hsl(${h} 100% 74%)" stop-opacity="0"/>
    </radialGradient>
    <!-- the pond, deep at the bottom and bright at the surface -->
    <linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eaf9ff"/>
      <stop offset="0.42" stop-color="#a9e2fb"/>
      <stop offset="0.78" stop-color="#5cc0ee"/>
      <stop offset="1" stop-color="#2b8fd0"/>
    </linearGradient>
    <!-- a glassy sheet of light lying on the water -->
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity=".55"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${glow.toFixed(1)}" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- the pond, deepest layer -->
  <rect width="120" height="80" rx="14" fill="url(#${id}-water)"/>

  <!-- the sun burning through the surface, behind everything -->
  <circle class="bloom" cx="100" cy="14" r="26" fill="url(#${id}-bloom)"/>
  <circle cx="100" cy="14" r="10" fill="#fffde7" opacity=".85"/>
  <circle cx="100" cy="14" r="6" fill="#ffffff" opacity=".9"/>

  <!-- caustics: the light ripples that say "underwater" -->
  <g class="caustics" fill="none" stroke="#ffffff" stroke-linecap="round">
    <path d="M8 22 C22 15 36 29 50 22 C64 15 78 29 92 22" stroke-width="2" opacity=".5"/>
    <path d="M12 34 C26 27 40 41 54 34 C68 27 82 41 96 34" stroke-width="1.6" opacity=".38"/>
    <path d="M6 46 C20 39 34 53 48 46 C62 39 76 53 90 46" stroke-width="1.4" opacity=".28"/>
  </g>

  <!-- bubbles rising through the water column -->
  <g class="bubbles">
    ${bubbles}
  </g>

  <!-- the fish's own halo, so it sits in the light rather than on top of it -->
  <ellipse class="halo" cx="58" cy="40" rx="44" ry="26" fill="url(#${id}-bloom)"
           opacity="${(0.3 + lavish * 0.12).toFixed(2)}" filter="url(#${id}-glow)"/>

  <!-- tail and fins first, so the body overlaps them -->
  <g filter="url(#${id}-glow)">
    <path class="tail" d="${shape.tail}" fill="${tail_}"/>
    <path class="fin" d="${shape.fin}" fill="${fin_}"/>
    <path class="body" d="${shape.body}" fill="${body_}" stroke="${deep}"
          stroke-width="1.1" stroke-opacity=".35"/>

    <!-- the belly, lit from below by the water -->
    <path class="belly" d="M40 52 C56 60 76 58 88 48 C76 58 56 62 40 54 Z"
          fill="#ffffff" opacity=".34"/>

    <!-- lateral stripes, in the deep tone so they read as depth not decoration -->
    <g class="stripe" stroke="${deep}" stroke-width="1.8" opacity=".42"
       stroke-linecap="round" fill="none">
      <path d="${shape.stripe}"/>
    </g>

    <!-- the scale sheen: three offset arcs of light along the flank -->
    <g class="scales" fill="none" stroke="#ffffff" stroke-linecap="round" opacity=".3">
      <path d="M44 44 C52 40 60 40 68 43" stroke-width="1.2"/>
      <path d="M48 48 C56 45 64 45 72 47" stroke-width="1"/>
      <path d="M52 52 C60 50 68 50 76 51" stroke-width=".8"/>
    </g>
  </g>

  <!-- the specular sweep: the gloss cap that makes it read as glassy -->
  <ellipse class="specular" cx="50" cy="29" rx="19" ry="9" fill="${sheen_}"
           transform="rotate(-16 50 29)"/>

  <!-- the eye, with a highlight so it looks wet -->
  <circle class="eye" cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="#ffffff"/>
  <circle cx="${+eye.cx + 0.8}" cy="${eye.cy}" r="${(eye.r * 0.52).toFixed(2)}" fill="#06334f"/>
  <circle cx="${+eye.cx + eye.r * 0.3}" cy="${+eye.cy - eye.r * 0.4}" r="${(eye.r * 0.2).toFixed(2)}"
          fill="#ffffff"/>

  <!-- sparkles, more the rarer the fish -->
  <g class="sparkles">
    ${sparkles}
  </g>

  <!-- a soft shadow on the water under the fish -->
  <ellipse class="shadow" cx="56" cy="66" rx="34" ry="5"
           fill="#0a4a70" opacity=".18"/>

  <!-- the glassy surface sheet, catching the sun -->
  <rect class="surface" width="120" height="26" fill="url(#${id}-glass)"
        opacity=".38" rx="14"/>

  <!-- a Legendary or Mythical gets a crown of light above it -->
  ${crown ? `<g class="ring">
    <ellipse cx="58" cy="17" rx="26" ry="7" fill="none" stroke="#ffffff"
             stroke-width="1.6" opacity=".5"/>
    <ellipse cx="58" cy="17" rx="17" ry="4.6" fill="none" stroke="#fff9c4"
             stroke-width="1.2" opacity=".65"/>
  </g>` : ''}
</svg>`;
}

/* ------------------------------------------------------------- the wallets */

/**
 * The luck a cast actually rolls with: the rod's own, plus the rank's, plus an
 * equipped seal's, plus whatever that seal has been fed.
 *
 * Every part defaults to zero rather than throwing, because a save written
 * before any of this existed has none of it.
 */
export function luckFor({ rod, level = 1, seal = null, bond = 0, seals = null, upgrades = [] } = {}) {
  const rodLuck = Number.isFinite(rod?.luck) ? rod.luck : 0;

  // `seals` is the party form and `seal` is the original single one, still honoured
  // so every existing caller and test keeps working. Normalise both to a list here
  // rather than branching at each use.
  const party = seals ?? (seal ? [seal] : []);
  const list = Array.isArray(party) ? party : [party];

  // Every seal on the dock counts, and every bond with it. A second seal is a second
  // set of luck -- that is the entire point of buying the dock.
  const sealLuck = list.reduce((sum, s) => sum + (Number.isFinite(s?.luck) ? s.luck : 0), 0);
  const bondTotal = (Array.isArray(bond) ? bond : [bond])
    .reduce((sum, b) => sum + bondLuck(b), 0);

  // Bond is the fed-fish bonus and it stacks: a fed seal is a better seal, not a
  // replacement for one. Feeding has to land HERE or it buys nothing at all.
  return rodLuck
    + luckFromLevel(level)
    + sealLuck
    + bondTotal
    + upgradeLuck(upgrades);
}

/* --------------------------------------------------------- lost Frutiger items */

/**
 * Things people drop in the water and never get back.
 *
 * The second economy. It funds seals without competing with rod prices, so a
 * good cast still feels worth something on a bad day. `water` is the lake id, so
 * each lake turns up its own flavour of lost object, and `chance` is per cast.
 *
 * Deliberately capped below the cheapest rod and below the dearest: junk has to
 * out-earn your first upgrade to matter, but it must never buy a Cloudlance.
 */
export const LOST_ITEMS = [
  { id: 'gumball', name: 'Gumball Globe', water: 'aero-lake', value: 140, chance: 0.16, hue: 350,
    blurb: 'Half the balls are still in it. You are not going to check.' },
  { id: 'sunhat', name: 'Sun Hat, One Size', water: 'aero-lake', value: 180, chance: 0.12, hue: 45,
    blurb: 'Someone wants this back. That is not going to be you.' },
  { id: 'bubblewand', name: 'Bubble Wand', water: 'aero-lake', value: 260, chance: 0.10, hue: 195,
    blurb: 'Still good. Still makes the exact same noise.' },
  { id: 'cassette', name: 'Chrome Cassette', water: 'doric-delta', value: 420, chance: 0.14, hue: 28,
    blurb: 'Side A is scratched. Side B is worse.' },
  { id: 'skatebit', name: 'Roller Skate, Single', water: 'doric-delta', value: 640, chance: 0.10, hue: 18,
    blurb: 'One boot. No idea where the other went.' },
  { id: 'doric', name: 'DORFic Compass', water: 'doric-delta', value: 900, chance: 0.08, hue: 32,
    blurb: 'Points confidently at straight lines. Not at water.' },
  { id: 'seedpod', name: 'Seed Pod', water: 'eco-marsh', value: 340, chance: 0.15, hue: 120,
    blurb: 'It may already be growing. That is the exciting part.' },
  { id: 'frogglass', name: 'Frog-Shaped Glass', water: 'eco-marsh', value: 520, chance: 0.13, hue: 110,
    blurb: 'Green. Slightly warm. Definitely had a frog on it.' },
  { id: 'boot', name: 'Wader Boot', water: 'eco-marsh', value: 780, chance: 0.10, hue: 90,
    blurb: 'Full of very cold very green water.' },
  { id: 'snowlens', name: 'Snow Goggles', water: 'glacier-fjord', value: 880, chance: 0.12, hue: 190,
    blurb: 'For looking at snow. You are looking at water.' },
  { id: 'icekey', name: 'Frost Key', water: 'glacier-fjord', value: 1250, chance: 0.09, hue: 200,
    blurb: 'Too cold to hold. You are holding it.' },
  { id: 'globe', name: 'Glass Globe', water: 'glacier-fjord', value: 1500, chance: 0.09, hue: 205,
    blurb: 'Inside: a small snowstorm. Do not shake.' },
  { id: 'glowlamp', name: 'Deepglow Lamp', water: 'dark-aero-deep', value: 1750, chance: 0.10, hue: 185,
    blurb: 'On its own, in the dark, for a very long time.' },
  { id: 'divewatch', name: 'Pressure Watch', water: 'dark-aero-deep', value: 2100, chance: 0.11, hue: 215,
    blurb: 'Still ticking. Should not be, down here.' },
  { id: 'blackbox', name: 'Black Chrome Box', water: 'dark-aero-deep', value: 2600, chance: 0.08, hue: 230,
    blurb: 'No maker mark. No seams. Very heavy.' },
];

/**
 * What a single cast hauls up, or null.
 *
 * `roll` is 0..1 from the caller — no Math.random in here. `rarityScale` is 1
 * for an ordinary catch and more for a rarer one: a Mythical means you were
 * fishing well, and the junk comes up with it.
 */
export function rollLostItem(roll, { rarityScale = 1, lakeId = null } = {}) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
  const scale = Number.isFinite(rarityScale) ? Math.max(0, rarityScale) : 1;
  if (scale <= 0) return null;

  // An item's `chance` is its SHARE of the lake's junk pool, so the pool total IS
  // the lake's junk rate — a pool of 0.51 means roughly half your casts turn
  // something up. Rates are taken over the whole table when no lake is named, so
  // the function is a pure function of (roll, scale) and callers may pass either.
  const pool = lakeId ? lostItemsFor(lakeId) : LOST_ITEMS;
  if (pool.length === 0) return null;
  const shares = pool.map((item) => item.chance * scale);
  const total = shares.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return null;

  // Capped so a huge rarityScale can never make junk certain; scaling should
  // shift WHICH item comes up far more than WHETHER something does.
  const anyChance = Math.min(0.85, total);
  if (roll >= anyChance) return null;

  let cursor = (roll / anyChance) * total;
  for (let k = 0; k < pool.length; k += 1) {
    cursor -= shares[k];
    if (cursor <= 0) return pool[k];
  }
  return pool[pool.length - 1];
}

/**
 * One lost item by id, or null.
 *
 * An old save can name an item that no longer exists in the table, and that must
 * read as nothing rather than throwing at the shop.
 */
export function lostItemById(id) {
  return LOST_ITEMS.find((item) => item.id === id) ?? null;
}

/**
 * Sell everything in the bag, returning the Seal coins it pays and the emptied
 * bag. Pure: nothing is mutated here.
 *
 * This is the ONLY route from lost items to money. Items used to be converted
 * into rod coins the moment they came up, which made the seal shop's prices mean
 * nothing -- you could not tell which economy a price belonged to. Selling is now
 * a deliberate act, into its own currency.
 *
 * An id that is not in the table pays nothing but is still cleared, so a
 * long-dead save cannot accumulate unpayable junk forever.
 *
 * `count` sells that many and keeps the rest. It sold all-or-nothing, which meant
 * a bag of seven identical finds could not part with one -- you either sold the
 * lot or kept the lot.
 */
export function sellLostItems(held, count = Infinity) {
  if (!Array.isArray(held) || held.length === 0) {
    return { ok: false, reason: 'Nothing to sell.', sealCoins: 0, held: [], sold: 0, count: 0 };
  }

  // How many to sell. Selling the lot is the default; `count` sells that many and
  // leaves the rest, so a bag of seven identical things can part with one.
  const wanted = count === Infinity ? held.length : Math.floor(Number(count));
  if (!Number.isFinite(wanted) || wanted < 1) {
    return { ok: false, reason: 'Nothing to sell.', sealCoins: 0, held: [...held], sold: 0, count: 0 };
  }
  // More than is in the bag is a refusal, never a short sale: quietly selling
  // three when four were asked for would leave the player short without knowing.
  if (wanted > held.length) {
    return { ok: false, reason: 'The bag does not hold that many.', sealCoins: 0, held: [...held], sold: 0, count: 0 };
  }

  let sealCoins = 0;
  for (const id of held.slice(0, wanted)) {
    const item = lostItemById(id);
    if (item) sealCoins += item.value;
  }
  return {
    ok: true,
    sealCoins,
    held: held.slice(wanted),
    sold: wanted,
    count: wanted,
  };
}

/** The junk a given lake can turn up, cheapest first. */
export function lostItemsFor(areaId) {
  return LOST_ITEMS.filter((i) => i.water === areaId).sort((a, b) => a.value - b.value);
}

/* -------------------------------------------------------------- the bag */

/**
 * What a landed fish is, in the bag.
 *
 * A catch used to pay rod coins the instant it came over the side
 * (`state.coins += value`), so the player never chose anything: every fish was
 * sold the moment it existed, and a bag of them would have been a list of things
 * that had already been spent. A catch now sits in the bag until you do one of
 * two things with it -- sell it for rod coins, or feed it to your seal for bond.
 *
 * `mutation` is stored rather than baked into `value`, because the multiplier is
 * how the fish was landed and the bag has to show and sell it as that fish.
 */
export function fishEntrySpec(fish, weight, mutation = null) {
  return {
    fishId: fish.id,
    weight,
    mutation: mutation?.name ?? null,
    multiplier: mutation?.multiplier ?? 1,
  };
}

/** Put a fish in the bag. Never mutates: the save holds one array, not a log. */
/* ------------------------------------------------------------ bag capacity */

/**
 * How many fish the bag holds.
 *
 * Ten with nothing bought. Fish Basket adds ten and Deep Net twenty-five, so the
 * full ladder is forty-five. Read from the UPGRADES table above, which is declared
 * before this point in the file, so a plain reference is safe.
 */
export const BASE_BAG_CAP = 10;

/** The cap for a player holding these upgrades. Never below the base. */
export function bagCap(upgrades = []) {
  const owned = Array.isArray(upgrades) ? upgrades : [];
  const extra = owned.reduce((sum, id) => {
    const up = UPGRADES[id];
    return sum + (up && up.effect === 'bag' ? (Number(up.value) || 0) : 0);
  }, 0);
  return BASE_BAG_CAP + extra;
}

/**
 * Put one fish in the bag.
 *
 * `cap` defaults to Infinity so every existing caller keeps working unchanged.
 * Returns { bag, kept } rather than a bare array, so the caller can tell a fish
 * that was kept from one that silently was not -- which is the whole difference
 * between a capacity the player understands and one that feels like a bug.
 *
 * A full bag does NOT refuse the fish silently and does not destroy anything: the
 * entry is simply not kept, and kept:false tells the caller to say so. The caller
 * decides what the player is told; this rule decides nothing about that.
 */
export function addToBag(bag, entry, cap = Infinity) {
  const owned = Array.isArray(bag) ? bag.filter((e) => e && FISH.some((f) => f.id === e.fishId)) : [];
  if (!entry || !FISH.some((f) => f.id === entry.fishId)) return { bag: [...owned], kept: false };
  const limit = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : Infinity;
  // Strictly at the cap, not past it. An OVER-cap bag -- an old save, or one written
  // before this rule existed -- still accepts a fish, because a player who cannot land
  // anything until they sell has no way out except reloading, and reloading is not a
  // thing the game should ever require of them. The cap governs growth from a legal
  // bag; the only way back under one is to sell.
  if (owned.length === limit) return { bag: [...owned], kept: false };
  return { bag: [...owned, { ...entry }], kept: true };
}

/** What one bag entry is worth in rod coins, mutation included. */
export function bagEntryValue(entry) {
  const fish = FISH.find((f) => f.id === entry?.fishId);
  if (!fish) return 0;
  return catchValue(fish, entry.weight, entry.multiplier ?? 1);
}

/** The whole bag, in rod coins. Shown so selling is never a surprise. */
export function bagWorth(bag) {
  return (Array.isArray(bag) ? bag : []).reduce((sum, e) => sum + bagEntryValue(e), 0);
}

/** Sell one fish. Takes out exactly that one and pays exactly that one. */
export function sellFromBag(bag, index) {
  const owned = Array.isArray(bag) ? bag : [];
  if (!Number.isInteger(index) || index < 0 || index >= owned.length) {
    return { ok: false, reason: 'No such fish in the bag.' };
  }
  return {
    ok: true,
    bag: owned.filter((_, i) => i !== index),
    coins: bagEntryValue(owned[index]),
  };
}

/**
 * Sell every fish in the bag. Pure: nothing is mutated here.
 *
 * The bag had one button per species, so emptying it meant as many clicks as
 * there were rows -- and a bag of twelve different fish was twelve trips through
 * the panel. This is the whole lot in one deliberate act.
 *
 * PAYS THE SUM OF THE INDIVIDUAL SALES, not bagWorth() of a copy: both are the
 * same number today, but the per-fish route is the one sellFromBag uses, so a
 * value that ever differs (a rounding change, a mutation premium) cannot make
 * "sell all" quietly disagree with selling the same fish one at a time.
 *
 * An empty bag is a refusal, never a silent zero: a button that pays nothing and
 * says nothing reads as broken rather than as "you have nothing to sell".
 */
export function sellWholeBag(bag) {
  const owned = Array.isArray(bag) ? bag : [];
  if (owned.length === 0) {
    return { ok: false, reason: 'The bag is empty.', coins: 0, bag: [...owned], sold: 0 };
  }

  let coins = 0;
  // Sold one at a time through the same rule the single-sale button uses, so the
  // two paths cannot drift apart.
  let remaining = owned;
  let sold = 0;
  for (let i = owned.length - 1; i >= 0; i -= 1) {
    const result = sellFromBag(remaining, i);
    if (!result.ok) continue;
    coins += result.coins;
    remaining = result.bag;
    sold += 1;
  }

  return { ok: true, coins, bag: remaining, sold };
}


/* --------------------------------------------------------------- bond ladder */

/**
 * The milestones a seal passes as you feed it, as a timeline.
 *
 * The bag had one job and no shape: feed a fish, the bond goes up by an amount
 * nobody could see, and the panel showed a bare count. Feeding is a real decision
 * -- a fish is worth coins OR luck -- so it needs to show where it is going.
 *
 * The counts are square-rooted deliberately. Bond luck is bondLuck(n) = sqrt(n) * 0.2,
 * so 1 fed is worth .2, 25 is worth 1.0, 100 is worth 2.0. That shape means the
 * first fish is a big step and the later ones are small -- which is exactly why
 * the ladder is worth walking, and why it is finite: past 100 the increments are
 * too small to feel like anything.
 *
 * `luck` is computed from bondLuck rather than written by hand, because a reward
 * that claims a number the rules do not pay is worse than no reward at all.
 */
const BOND_STEPS = [
  {
    at: 1,
    title: 'First taste',
    reward: 'luck +' + bondLuck(1).toFixed(2),
    note: 'Bubbles has decided you are worth talking to.',
  },
  {
    at: 5,
    title: 'Recognised',
    reward: 'luck +' + bondLuck(5).toFixed(2),
    note: 'It knows your hands now. It stops watching the water for you.',
  },
  {
    at: 12,
    title: 'Bonded',
    reward: 'luck +' + bondLuck(12).toFixed(2),
    note: 'You are the reason it is on the dock. The luck follows you both.',
  },
  {
    at: 25,
    title: 'Trusted',
    reward: 'luck +' + bondLuck(25).toFixed(2) + ' · it starts guessing your casts',
    note: 'It would follow you onto a bad lake. It says so. At length.',
  },
  {
    at: 50,
    title: 'Inseparable',
    reward: 'luck +' + bondLuck(50).toFixed(2) + ' · duplicates come more often',
    note: 'One seal, two animals. Neither of you mentions it.',
  },
  {
    at: 100,
    title: 'Part of the tackle',
    reward: 'luck +' + bondLuck(100).toFixed(2) + ' · the seal at its best',
    note: 'You do not own a seal any more. You keep one.',
  },
];

/** The whole timeline, with each step's real luck attached. */
export function bondMilestones() {
  return BOND_STEPS.map((step) => ({
    ...step,
    luck: bondLuck(step.at),
  }));
}

/**
 * How the timeline should read for a seal that has been fed `fed` fish.
 *
 * `next` is the step still ahead, or null at the end -- which the panel has to
 * say plainly, because a ladder that simply stops looks like a bug.
 */
export function bondProgress(fed) {
  const steps = bondMilestones();
  const n = Math.max(0, Math.floor(Number(fed) || 0));
  const reached = steps.filter((s) => n >= s.at);
  const next = steps.find((s) => n < s.at) ?? null;
  const from = reached.length ? reached[reached.length - 1] : null;
  return {
    fed: n,
    luck: bondLuck(n),
    steps,
    reached,
    next,
    // How far through the whole ladder, 0..1, for the track's fill.
    progress: steps.length ? Math.min(1, n / steps[steps.length - 1].at) : 0,
    // How far to the NEXT step specifically, so the bar can show it approaching.
    toNext: next && from
      ? (n - from.at) / (next.at - from.at)
      : (next ? 0 : 1),
    complete: !next,
    last: from,
  };
}

/**
 * How much luck `fed` fish have earned a seal.
 *
 * Bounded on purpose. Luck multiplies the weight of everything rarer than Common,
 * so an unbounded bond would flatten the fish table -- one very well fed seal
 * would erase every tier above Common and Mythical would stop meaning anything.
 * Square-rooted, so the first fish is worth a lot and the fiftieth is worth a little.
 */
/**
 * The bag, collapsed into one row per species.
 *
 * The bag listed one row per FISH, so twelve identical Glidefins meant twelve
 * identical rows with twelve identical buttons -- and only one of them is the
 * decision, because they are all the same decision.
 *
 * `entry` is the fish the row SHOWS: the heaviest, since that is the one worth
 * selling and the one a player would recognise. `total` is what the whole group is
 * worth, which is a different number and worth showing too.
 *
 * Grouped by SPECIES, not by mutation. A triple-striped Glidefin and a plain one
 * are the same creature and the same choice; splitting them would put two rows
 * back where there was one.
 */
export function groupBag(bag) {
  const owned = Array.isArray(bag) ? bag : [];
  const order = [];
  const byId = new Map();

  for (const entry of owned) {
    if (!entry || typeof entry !== 'object') continue;
    const key = entry.fishId;
    if (!byId.has(key)) {
      byId.set(key, []);
      order.push(key);
    }
    byId.get(key).push(entry);
  }

  return order.map((fishId) => {
    const entries = byId.get(fishId);
    // Heaviest wins the display; the earliest breaks a tie, so the row is stable
    // between repaints rather than jumping about.
    let entry = entries[0];
    for (const e of entries) if (Number(e.weight) > Number(entry.weight)) entry = e;
    return {
      fishId,
      entries,
      entry,
      count: entries.length,
      total: entries.reduce((sum, e) => sum + bagEntryValue(e), 0),
    };
  });
}

export function bondLuck(fed) {
  const n = Math.max(0, Number(fed) || 0);
  return Math.round(Math.sqrt(n) * 0.2 * 1000) / 1000;
}

/**
 * Feed one fish to a seal. The fish is spent; the seal's bond rises.
 *
 * Bond is per seal, not global: feeding Tangerine does nothing for Bubbles, so a
 * player with two seals has to pick who they are raising.
 */
export function feedToBond(bag, index, bond = {}, sealId = null) {
  const owned = Array.isArray(bag) ? bag : [];
  if (!Number.isInteger(index) || index < 0 || index >= owned.length) {
    return { ok: false, reason: 'No such fish in the bag.' };
  }
  // Bond is keyed by SEAL, not by fish. The first version keyed it by the fish
  // being fed, so feeding four different Glidefins gave four bonds of one rather
  // than one bond of four -- and `seal` was the running count of the wrong thing.
  if (!sealId || !SEALS.some((s) => s.id === sealId)) {
    return { ok: false, reason: 'Equip a seal before you feed it.' };
  }
  const current = bondCount(bond, sealId);
  return {
    ok: true,
    bag: owned.filter((_, i) => i !== index),
    bond: { ...bond, [sealId]: current + 1 },
    fed: owned[index],
  };
}

/** How many fish a seal has been fed, for a single seal. */
export function bondCount(bond, sealId) {
  return Math.max(0, Number(bond?.[sealId]) || 0);
}

/** Total rod coins in a bag, by seal, so the dock can show what each is worth. */
export function bagWorthByFish(bag) {
  const out = new Map();
  for (const entry of Array.isArray(bag) ? bag : []) {
    out.set(entry.fishId, (out.get(entry.fishId) ?? 0) + bagEntryValue(entry));
  }
  return out;
}

/* ------------------------------------------------------------- dock upgrades */

/**
 * Permanent, one-off purchases bought with rod coins.
 *
 * Priced so the most important cost the most, and gated on rank so the early ones
 * are reachable: xpForLevel() grows as (n-1)^2.1, so a rank gate at any price is
 * really a gate on how long you have played.
 *
 * `effect` is data, not code. Nothing here is a function: the rules that READ these
 * live in sealSlots(), luckFor() and bagCap(), so the table can be asserted without
 * running any of it.
 *
 * A perk that feeds the roll carries a `luck` NUMBER alongside its effect, and
 * luckFor() sums those. `effect: 'slot'` is the special one: its `value` is how many
 * extra seal slots it opens, read by sealSlots(). `effect: 'bag'` is how many more
 * fish the bag holds, read by bagCap().
 */
export const UPGRADES = {
  // --- cheap, early, small ---
  tin_lid: { id: 'tin_lid', name: 'Tin Lid', price: 250, level: 1, effect: 'keep', value: 1,
    blurb: 'A lid for the bucket. Holds one fish you would otherwise have dropped.' },
  waxed_line: { id: 'waxed_line', name: 'Waxed Line', price: 700, level: 1, effect: 'keep', value: 1,
    blurb: 'Waxed, so it frays less. Everything you land counts.' },
  padded_grip: { id: 'padded_grip', name: 'Padded Grip', price: 1_600, level: 2, effect: 'control', value: 0.02,
    blurb: 'Your hands stop slipping when something big takes hold.' },
  spare_hook: { id: 'spare_hook', name: 'Spare Hook', price: 3_200, level: 3, effect: 'keep', value: 1,
    blurb: 'One more hook. One more chance.' },
  bait_tin: { id: 'bait_tin', name: 'Bait Tin', price: 5_500, level: 4, effect: 'bait', value: 0.05,
    blurb: 'Bait that keeps. You cast more often.' },

  // --- the middle: real, felt upgrades ---
  fish_basket: { id: 'fish_basket', name: 'Fish Basket', price: 9_000, level: 5, effect: 'bag', value: 10,
    blurb: 'A proper basket. Ten more fish wait for you instead of going over the side.' },
  second_spot: { id: 'second_spot', name: 'Second Spot', price: 14_000, level: 6, luck: 0.10, effect: 'luck',
    blurb: 'You read the water faster where you stand.' },
  lanterns: { id: 'lanterns', name: 'Pier Lanterns', price: 19_000, level: 7, effect: 'night', value: 1,
    blurb: 'Light on the boards. The dark hours stop costing you.' },
  oar_hooks: { id: 'oar_hooks', name: 'Oar Hooks', price: 21_000, level: 7, effect: 'control', value: 0.03,
    blurb: 'Two hooks by the oar. You are not losing the fish to a lost rod.' },
  sound_box: { id: 'sound_box', name: 'Sound Box', price: 25_000, level: 8, effect: 'bite', value: 0.12,
    blurb: 'A loud bite window. The fish tells you sooner.' },
  reel_bearing: { id: 'reel_bearing', name: 'Reel Bearing', price: 32_000, level: 9, effect: 'reel', value: 0.10,
    blurb: 'Smooth under load. Harder fish give up sooner.' },

  // --- the seals, and the dock that holds them ---
  seal_bond_pin: { id: 'seal_bond_pin', name: 'Bond Pin', price: 42_000, level: 10, effect: 'bond', value: 0.15,
    blurb: 'A fed seal stays fed. Bond counts for more.' },
  tide_calendar: { id: 'tide_calendar', name: 'Tide Calendar', price: 54_000, level: 11, luck: 0.18, effect: 'luck',
    blurb: 'You know what the water is doing before it does it.' },
  // THE headline upgrade. It is expensive because it is the most powerful thing in
  // the game: a second seal is a second set of luck, a second bond ladder, and a
  // second animal on the dock.
  bigger_dock: { id: 'bigger_dock', name: 'Bigger Dock', price: 90_000, level: 14, effect: 'slot', value: 1,
    blurb: 'Room for a second seal. Both sit with you. Both count.' },

  // --- expensive, late, powerful ---
  lamp_oil: { id: 'lamp_oil', name: 'Lamp Oil', price: 98_000, level: 15, luck: 0.22, effect: 'luck',
    blurb: 'The lanterns burn all night. The dark stops being a tax.' },
  deep_net: { id: 'deep_net', name: 'Deep Net', price: 110_000, level: 15, effect: 'bag', value: 25,
    blurb: 'For the ones that live down where the light gives up.' },
  star_chart: { id: 'star_chart', name: 'Star Chart', price: 132_000, level: 16, luck: 0.30, effect: 'luck',
    blurb: 'Weather is no longer weather. It is a forecast you can read.' },
  second_rod_rest: { id: 'second_rod_rest', name: 'Spare Rod Rest', price: 156_000, level: 17, effect: 'keep', value: 2,
    blurb: 'Two rods stood ready. Switching costs you nothing.' },
  seal_call: { id: 'seal_call', name: 'Seal Call', price: 182_000, level: 18, luck: 0.35, effect: 'luck',
    blurb: 'A whistle your seal comes back for.' },
  glass_bottom: { id: 'glass_bottom', name: 'Glass Bottom', price: 210_000, level: 19, luck: 0.40, effect: 'luck',
    blurb: 'You see the shape before it bites.' },
  old_luck: { id: 'old_luck', name: 'Old Luck', price: 228_000, level: 20, luck: 0.45, effect: 'luck',
    blurb: 'You have done this long enough to be good at it.' },
  the_long_line: { id: 'the_long_line', name: 'The Long Line', price: 245_000, level: 20, luck: 0.50, effect: 'luck',
    blurb: 'Cast further than the lake expects. The deep ones come to you.' },
};

/** How many seals fit on the dock. One until Bigger Dock is bought. */
export function sealSlots(owned = []) {
  // De-duplicated: the slot count is a property of WHICH upgrades you have, not how
  // many times the id appears in the save. A hand-edited save listing bigger_dock
  // twice must not buy two docks.
  const unique = [...new Set(Array.isArray(owned) ? owned : [])];
  const extra = unique.filter((id) => UPGRADES[id]?.effect === 'slot')
    .reduce((sum, id) => sum + (UPGRADES[id].value || 0), 0);
  return 1 + extra;
}

/**
 * The seals on the dock, as a clean list.
 *
 * equippedSeal is a LIST now, because Bigger Dock lets a second seal out, but every
 * save written before that holds a single id or null. All three shapes are accepted
 * here rather than at each of the call sites, because the call site that reads
 * state.equippedSeal directly is exactly the bug this exists to prevent.
 *
 * Three filters, all load-bearing:
 *   - a SCALAR or null becomes a one-entry or empty list, so old saves still dock;
 *   - a seal we do not own is dropped, or the HUD shows an animal never caught;
 *   - the list is capped at the slots the dock grants, so a hand-edited save cannot
 *     conjure a third animal on a one-slot dock.
 */
export function sealParty(raw, owned = [], upgrades = []) {
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const have = Array.isArray(owned) ? owned : [];
  const slots = Math.max(1, sealSlots(upgrades));
  return [...new Set(list.filter((id) => have.includes(id)))].slice(0, slots);
}

/** Every upgrade's luck, summed into one number for the roll. */
export function upgradeLuck(owned = []) {
  return (Array.isArray(owned) ? owned : [])
    .reduce((sum, id) => sum + (Number(UPGRADES[id]?.luck) || 0), 0);
}

/**
 * Attempt to buy one upgrade.
 *
 * Mirrors buySeal(): pure, a refusal is always { ok:false, reason }, and the new
 * wallet comes back rather than being mutated. The order of the checks matches the
 * seal rule -- unknown id, then already-owned, then rank, then price -- so a player
 * who is both broke and under-levelled hears about the level, which is the problem
 * they can solve by playing rather than by saving.
 */
export function buyUpgrade(wallet, upgradeId, level = 1, owned = []) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return { ...wallet, ok: false, reason: 'Unknown upgrade.' };

  // Already-owned is a refusal with a reason, not a free re-charge. Each upgrade is
  // a one-off, so buying the same one twice must never be possible.
  if (Array.isArray(owned) && owned.includes(upgradeId)) {
    return { ...wallet, ok: false, reason: `${upgrade.name} is already fitted.` };
  }
  if (upgrade.level > level) {
    return { ...wallet, ok: false, reason: `${upgrade.name} needs rank ${upgrade.level}.` };
  }
  if (!Number.isFinite(wallet?.coins) || wallet.coins < upgrade.price) {
    return { ...wallet, ok: false, reason: `Not enough rod coins for ${upgrade.name}.` };
  }
  return { ok: true, upgradeId, coins: wallet.coins - upgrade.price, owned: [...(owned ?? []), upgradeId] };
}

/* ---------------------------------------------------------------- pet seals */

/**
 * What each seal says when you feed it a fish.
 *
 * Feeding is the newest thing a seal reacts to, and it had no line for it at all:
 * every feed got the generic idle chatter. So the fish you deliberately chose to
 * give up for luck -- the decision the whole bag exists for -- was the one moment
 * the pet said nothing about.
 *
 * Six tiers, because the rarity of what you gave away should read differently.
 * Feeding a Common is a snack; feeding a Mythical is an offering, and the seals
 * know the difference.
 *
 * The voice rules are the seal's own, not generic:
 *   bubbles    lowercase, bursts, questions, exclamation, never waits
 *   tangerine  flat declaratives, devastating, then quiet. No questions.
 *   moss       as few words as possible. dry. no exclamation, ever
 *   frost      imperatives and pressure. shouts
 *   abyss      knows things it should not. trails off, thinks out loud
 *
 * No line here is reused from a catch line: feeding is a different moment, and a
 * seal that said the same thing about both would not be saying anything.
 */
const SEAL_FED = {
  bubbles: {
    // Cheerful and nosy. Short bursts, asks questions, never waits.
    common: "oh! a snack! okay wait --",
    uncommon: "oh that's better. that's a proper snack",
    rare: "WAIT that's a rare one, you're just GIVING it to me??",
    epic: "epic. epic! i'm gonna be so nice to you for like a day",
    legendary: "you fed me a LEGENDARY. i'm not gonna be normal about this",
    mythical: "okay hold on. mythical. MYTHICAL. i'm not okay, are you??",
  },
  tangerine: {
    // The critic. Dry, exact, quietly competitive. Never shouts, always lands it.
    common: "the small one. generous of you, considering",
    uncommon: "acceptable. it had better be",
    rare: "you gave me the rare one instead of selling it. noted. noted differently",
    epic: "an epic, surrendered. you're either generous or not counting. either way",
    legendary: "you handed me a legendary like it was loose change. i'm choosing not to comment",
    mythical: "a mythical. fed. to me. and you didn't even look smug. fine. genuinely fine",
  },
  moss: {
    // The deadpan zen. Says almost nothing, and what's there is very dry.
    common: "small. enough",
    uncommon: "this one has some weight to it",
    rare: "rare. you fed it here. quiet. good",
    epic: "epic. that one belonged in the water. you chose here instead. understood",
    legendary: "legendary. fed. i will hold this carefully and say nothing",
    mythical: "mythical. you could have sold that. you didn't. the water is quiet now",
  },
  frost: {
    // The drill sergeant. Encourages, entirely through pressure.
    common: "fed me a common. that's the STARTING LINE. again!",
    uncommon: "uncommon! acceptable fuel! keep casting!",
    rare: "a rare one, given up for BOND. do you understand what you just did?! good. do it again",
    epic: "EPIC into the seal! that's not a snack, that's a STATEMENT. harder!",
    legendary: "LEGENDARY! sacrificed! to a SEAL! this is how it WORKS! dig in!",
    mythical: "A MYTHICAL. you fed me a mythical and you're still standing there?! OUTSTANDING! NOW DO IT AGAIN!",
  },
  abyss: {
    // The eldritch one. Speaks like it knows things it shouldn't. Beats are mild.
    common: "small. it is enough. it is always enough",
    uncommon: "this one had a longer name than the last. i liked it",
    rare: "rare things come up once. you gave it to me. it will not come back up. that is the trade",
    epic: "an epic, freely given. the dark does not usually get offered anything. it noted it",
    legendary: "legendary. into me. i will hold it the way you hold things you are not going to lose",
    mythical: "mythical. you had that. and now i do. the water remembers who had it. i wonder if it will ask you too",
  },
};
/**
 * The companions. One from each lake: they add luck, they occasionally hand you
 * a second copy of what you just caught, and they have opinions.
 *
 * `level` is the rank you must reach before the shop will sell it, so the seals
 * arrive alongside progress rather than being bought the moment you can afford
 * them. `price` is paid in the junk economy, not rod money.
 */
export const SEALS = [
  {
    id: 'bubbles', name: 'Bubbles', home: 'aero-lake',
    luck: 0.8, dupeChance: 0.06, level: 1, price: 900, hue: 205, light: 62,
    // The new one. Cheerful, nosy, permanently mid-thought. Talks in short bursts
    // and asks questions it does not wait for the answer to.
    voice: 'Cheerful and nosy. Short bursts, asks questions, never waits.',
    idle: [
      "oh hi, it's Bubbles! your bobber's doing that thing again",
      "hey — cast. seriously, cast. i'm bored",
      "no but like, do you ever just sit here? it's nice",
      "watching a line not move is 90% of fishing and i'm so okay with it",
      "you've got the face. you're thinking about lunch. i KNOW that face",
    ],
    line: 'Watches your line like it is a very slow television.',
    catch: {
      favourite: "okay THAT one, i love that one. don't tell the others, obviously",
      beat: "you've already got one of those! get a weirder one, trust me",
      rare: "whoa. okay that's rare. i'm not saying i'm hyped but i kind of am",
      rareRepeat: "okay you ALREADY have one of those?? fine. i'm allowed to be smug",
      junk: "oh nice, junk! that's still seal coins though so, you know, nice",
      personalBest: "that's the biggest one yet?? i'm claiming emotional credit",
    },
  
    fed: SEAL_FED.bubbles,},
  {
    id: 'tangerine', name: 'Tangerine', home: 'doric-delta',
    luck: 1.0, dupeChance: 0.07, level: 4, price: 2600, hue: 26, light: 56,
    // The critic. Dry, exact, quietly competitive. Never shouts, always lands it.
    voice: 'Dry and exact. Devastating in one line, then goes quiet.',
    idle: [
      "left. no, left. okay there. you're welcome",
      "you're holding that rod like it's a shopping bag",
      "better. don't get comfortable. your cast, not mine",
      "miss the next one and i'm gonna be so annoying about YOUR casts",
      "straight lines only. water here doesn't do curves. neither do i",
    ],
    line: 'Lies on the warmest plank and judges your casting.',
    catch: {
      favourite: "the one. called it. literally called it",
      beat: "that's beneath you. genuinely",
      rare: "straight lines and you still pulled that? okay. OKAY.",
      rareRepeat: "again. you had that already. show off",
      junk: "junk. so impressive. genuinely",
      personalBest: "bigger. okay. i'm not impressed, i'm just noting it",
    },
  
    fed: SEAL_FED.tangerine,},
  {
    id: 'moss', name: 'Moss', home: 'eco-marsh',
    luck: 1.1, dupeChance: 0.08, level: 8, price: 5400, hue: 92, light: 50,
    // The deadpan zen. Says almost nothing, and what's there is very dry.
    voice: 'Deadpan zen. Very few words. Extremely dry.',
    idle: [
      "reeds did most of that. you're welcome",
      "quiet now. good. you're doing fine",
      "don't fix anything. marsh is fine. you too",
      "you keep checking. it's fine. i'm literally watching it",
      "one eye's enough. i checked your line. relax",
    ],
    line: 'Mostly water and entirely opinion.',
    catch: {
      favourite: "that one belongs here. it knows that too",
      beat: "reeds had better. go try the reeds",
      rare: "quiet. that's how you know",
      rareRepeat: "quiet. you already had one of those. no matter",
      junk: "something found you. it wasn't looking",
      personalBest: "bigger than last time. i noticed. i don't care though",
    },
  
    fed: SEAL_FED.moss,},
  {
    id: 'frost', name: 'Frost', home: 'glacier-fjord',
    luck: 1.2, dupeChance: 0.09, level: 13, price: 9800, hue: 196, light: 82,
    // The drill sergeant. Encouraging, but entirely through pressure.
    voice: 'Drill sergeant. Encourages by piling on. Way too intense.',
    idle: [
      "bore through it. that's the whole lake and you keep waiting",
      "cold enough to keep your line honest — and you honest, so push",
      "one eye open. other one's for the weather. stop looking at me and cast",
      "again. again. again. that's literally the whole method",
      "you're soft rn. ice doesn't care. push",
    ],
    line: 'Keeps one eye open, which is more than the ice does.',
    catch: {
      favourite: "colder than me. you won't beat that, don't bother",
      beat: "ice had better and you went for THAT? dig. dig!",
      rare: "bored through the ice and found that? that's actual discipline",
      rareRepeat: "you already had that. twice. keep pushing",
      junk: "junk. even your junk pulled up badly. again. harder",
      personalBest: "new record. don't celebrate, cast. next one bigger",
    },
  
    fed: SEAL_FED.frost,},
  {
    id: 'abyss', name: 'Abyss', home: 'dark-aero-deep',
    luck: 1.4, dupeChance: 0.11, level: 19, price: 19000, hue: 158, light: 58,
    // The eldritch one. Speaks like it knows things it shouldn't. Beats are mild.
    voice: 'Knows things it should not. Half the time it is not talking to you.',
    idle: [
      "down here the light gives up first. your line still works though",
      "been down longer than your dock. longer than your dock's whole deal",
      "something moved past your hook. probs me. probs",
      "i counted. you've cast like four hundred times. i counted every one",
      "dark's not empty. your bobber's fine. for now",
    ],
    line: 'Sits where the light gives up and says nothing for a while.',
    catch: {
      favourite: "you pulled that out of the same dark i sleep in. weirdly proud",
      beat: "that was almost nice of you. i clocked it",
      rare: "you should be way more careful. you're not, so. take it",
      rareRepeat: "got another one. the dark remembers the first",
      junk: "something came up. it brought a gift, technically",
      personalBest: "bigger. the water remembers the last one too. it's watching",
    },
  
    fed: SEAL_FED.abyss,},
];

/**
 * What the seal says when nothing is happening.
 *
 * The seal used to speak only when a fish was landed, which meant the dock was
 * silent for the whole cast-and-wait and the one moment it did talk was behind the
 * catch card. These lines give it a voice in between.
 */
export function sealIdleLine(seal, { areaId = null, count = 0 } = {}) {
  if (!seal?.idle?.length) return '';
  const lines = seal.idle;
  // Deterministic: the same state gives the same line, so tests can pin it.
  return lines[Math.abs(Math.floor(count)) % lines.length];
}

/** Every line a seal can say, idle included. Used by the index and the tests. */
export function sealLines(seal) {
  if (!seal) return [];
  return [...(seal.idle ?? []), ...Object.values(seal.catch ?? {})];
}

/**
 * What the seal says about a catch.
 *
 * Always returns a string when there is a seal: a pet that says nothing when you
 * land something good is worse than no pet at all.
 */
export function sealComment(seal, fish, { bestiary = {}, personalBest = false, junk = false } = {}) {
  const lines = seal?.catch;
  if (!lines) return '';
  const tier = Math.max(0, RARITY_ORDER.indexOf(fish?.rarity));
  const alreadyKnown = Number(bestiary?.[fish?.id]) > 0;

  // Junk and a personal best are worth a word of their own: both are moments, and
  // before this every catch got one of three lines regardless.
  if (junk) return lines.junk ?? lines.beat;
  if (personalBest) return lines.personalBest ?? lines.favourite;

  // Rarity first. A Mythical fish reads as a big deal whether or not you have one
  // already -- the old ordering checked "already owned" first, so a repeat of a
  // Mythical got the same line as seeing one for the first time.
  // A Mythical or Legendary you ALREADY hold is its own moment, distinct from
  // seeing one for the first time -- so it gets its own line, not `rare`.
  if (tier >= 4) return alreadyKnown ? (lines.rareRepeat ?? lines.rare) : lines.rare;
  if (tier >= 3) return alreadyKnown ? lines.beat : lines.favourite;

  // Below Epic, a fish you already hold is the "you could do better" beat.
  return alreadyKnown ? lines.beat : lines.favourite;
}
/**
 * What the seal says when you feed it a fish.
 *
 * Feeding is the bag's whole point -- a catch can become luck instead of coins --
 * and the pet had nothing to say about it, so the one decision the bag exists for
 * was the one it passed over in silence.
 *
 * Tiered by the rarity of what was given away, because feeding a Common is a snack
 * and feeding a Mythical is an offering. Always returns a string when there is a
 * seal: a pet that goes quiet on the moment you chose to give something up is
 * worse than no pet at all.
 */
/* Rarity -> feeding line. Six tiers, in RARITY_ORDER, so a Mythical reads
 * differently from a Common and the seal's reaction matches what was given.
 */
const FEED_TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

export function sealFedLine(seal, fish) {
  const lines = seal?.fed;
  if (!lines) return '';
  const key = FEED_TIERS[RARITY_ORDER.indexOf(fish?.rarity)] ?? 'common';
  return lines[key] ?? lines.common ?? '';
}

/**
 * Buy a seal. Never mutates the wallet: on failure the caller gets the same coins
 * back plus a reason a player can read.
 */
export function buySeal(wallet, sealId, level = 1, progress = { bestiary: {}, owned: [] }) {
  const seal = SEALS.find((s) => s.id === sealId);
  if (!seal) return { ...wallet, ok: false, reason: 'Unknown seal.' };
  if (seal.level > level) {
    return { ...wallet, ok: false, reason: `${seal.name} needs rank ${seal.level}.` };
  }

  // The seal belongs to a lake, so you open the lake before you buy its seal.
  // `home` was declared on every seal and read by nothing: Tangerine could be
  // bought on day one from Aero Lake for coins you had never earned there.
  //
  // Checked after rank and before price, because a player who is both broke and
  // standing nowhere near the lake should hear about the lake -- the coins are a
  // problem they cannot have solved yet.
  const home = AREAS.find((a) => a.id === seal.home);
  if (home && !areaUnlocked(home, progress)) {
    return { ...wallet, ok: false, reason: `${seal.name} only appears in ${home.name}. Open it first.` };
  }
  if (!Number.isFinite(wallet?.coins) || wallet.coins < seal.price) {
    return { ...wallet, ok: false, reason: `Not enough seal coins for ${seal.name}.` };
  }
  return { ok: true, sealId, coins: wallet.coins - seal.price };
}

/**
 * Equip one of the seals you own.
 *
 * Only one seal is ever active, and re-equipping an owned seal is free — the
 * same rule rods follow, and for the same reason: buying access, not holding it.
 */
/**
 * Put one seal on the dock.
 *
 * Refuses a seal you do not own, and refuses when the dock is already full -- an
 * explicit "there is no room" rather than silently replacing the animal already
 * sitting there, which is what `state.equippedSeal = [sealId]` did. Upgrading the
 * dock and then finding your seal gone would be the worst possible bug in this file.
 *
 * Idempotent: equipping a seal that is already out succeeds and changes nothing.
 */
export function equipSeal(owned, sealId, upgrades = [], onDock = []) {
  if (!Array.isArray(owned) || !owned.includes(sealId)) {
    return { ok: false, reason: 'You do not own that seal.' };
  }
  const party = sealParty(onDock, owned, upgrades);
  if (party.includes(sealId)) return { ok: true, sealId, paid: 0, party };
  if (party.length >= Math.max(1, sealSlots(upgrades))) {
    return { ok: false, reason: 'There is no room on the dock for another seal.', party };
  }
  return { ok: true, sealId, paid: 0, party: [...party, sealId] };
}

/**
 * Whether this catch hands you a second copy.
 *
 * `roll` is injected, never Math.random. At most one duplicate per catch,
 * whatever the roll: the seal nudges one loose, it does not empty the lake.
 */
export function sealDuplicates(seal, roll) {
  if (!seal || !Number.isFinite(roll)) return false;
  return roll >= 0 && roll < seal.dupeChance;
}

/* ------------------------------------------------------------------ levels */

/**
 * How much rank a catch is worth.
 *
 * Rarer tiers and heavier fish are worth more. `fish` may be missing (an old
 * save naming a species that no longer exists) and that must still pay
 * something, not throw.
 */
export function xpForCatch(fish, kg = 0) {
  const tier = Math.max(0, RARITY_ORDER.indexOf(fish?.rarity));
  const weight = Number.isFinite(kg) ? Math.max(0, kg) : 0;
  return Math.round(14 * (tier + 1) * (1 + weight / 25));
}

/** Total xp needed to have reached `level`. Rises steeply, so early ranks fly by. */
export function xpForLevel(level) {
  const n = Math.max(0, Math.floor(Number(level) || 0) - 1);
  return Math.round(120 * Math.pow(n, 2.1));
}

const RANK_TITLES = [
  'Deckhand', 'Bubblemaster', 'Surface Skimmer', 'Current Rider',
  'Channel Fisher', 'Deep Listener', 'Glasswater Sage', 'Sunscale Warden',
];

/**
 * The angler's rank from total xp.
 *
 * Pure and total: an old save has no xp at all, and that is rank 1 rather than a
 * crash or NaN.
 */
export function levelFrom({ xp = 0 } = {}) {
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  while (level < 99 && total >= xpForLevel(level + 1)) level += 1;
  const title = RANK_TITLES[Math.min(RANK_TITLES.length - 1, Math.floor((level - 1) / 2))];
  return { level, title, xp: total, next: xpForLevel(level + 1) };
}

/**
 * The luck a rank adds, on top of the rod's own.
 *
 * Capped at 2.0 on purpose. Ranks are supposed to take the edge off a bad
 * streak, not become the reason you can land a Mythical — that is still what rod
 * choice and the lake you have opened are for.
 */
export function luckFromLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 1) return 0;
  return Math.min(2.0, Math.round((n - 1) * 0.08 * 100) / 100);
}

/* ------------------------------------------------------------- bestiary */

/** Record a catch if it is heavier than the one already held for that species. */
export function recordCatch(bestiary, fish, weight) {
  const best = bestiary[fish.id] ?? 0;
  return { ...bestiary, [fish.id]: Math.max(best, weight) };
}

export function fishById(id) {
  return FISH.find((f) => f.id === id) ?? null;
}

export { RARITY_ORDER };


/* ------------------------------------------------------------------- weather */

/**
 * Time of day. The tint is the light the whole scene is washed with; `depth` is
 * how far it dims, so night reads as night rather than as grey noon.
 *
 * These are deliberately gentle on luck. Weather is meant to make the same lake
 * feel like somewhere you keep going back to, not to rebalance the odds -- that
 * is what rods, seals and rank are for.
 */
export const TIMES = [
  { id: 'dawn', name: 'Dawn', tint: '#ffd6b0', depth: 0.10, luck: 1.02,
    blurb: 'The mist is still lying on the water.' },
  { id: 'noon', name: 'Midday', tint: '#fff4c2', depth: 0.00, luck: 1.00,
    blurb: 'Flat bright light, and nowhere to hide.' },
  { id: 'dusk', name: 'Dusk', tint: '#ff9a76', depth: 0.18, luck: 1.06,
    blurb: 'The good hour. Fish move at dusk.' },
  { id: 'night', name: 'Night', tint: '#4a5a8c', depth: 0.34, luck: 1.10,
    blurb: 'Deeper and darker, and the big ones come up.' },
];

/** Weather. `tint` is the veil over the water; `grain` adds Aero bubble texture. */
export const WEATHER = [
  { id: 'clear', name: 'Clear', tint: '#ffffff', veil: 0.00, luck: 1.00,
    blurb: 'Not a cloud on it.' },
  { id: 'haze', name: 'Soft Haze', tint: '#e8f4ff', veil: 0.16, luck: 0.98,
    blurb: 'Everything has a glow around it.' },
  { id: 'drizzle', name: 'Drizzle', tint: '#cfe4f5', veil: 0.26, luck: 1.04,
    blurb: 'Small lines, steady bites.' },
  { id: 'downpour', name: 'Downpour', tint: '#9fc4dd', veil: 0.38, luck: 1.12,
    blurb: 'Everything is loud and the water is up.' },
  { id: 'mist', name: 'Mist', tint: '#eef2f6', veil: 0.22, luck: 1.08,
    blurb: 'You can see the rod tip and not much else.' },
];

/**
 * Pick the sky for one visit. Pure: the rng is injected, so a test can pin it and
 * the same inputs always give the same afternoon.
 */
export function skyFor(areaId, rng = Math.random, roll = rng()) {
  const pick = (list, value) => {
    const n = Number.isFinite(value) ? value : 0;
    const i = Math.floor(Math.min(Math.max(n, 0), 0.999999) * list.length);
    return list[i] ?? list[0];
  };
  const time = pick(TIMES, roll);
  const weather = pick(WEATHER, rng());
  return {
    time,
    weather,
    label: `${weather.name}, ${time.name.toLowerCase()}`,
    // The headline for the HUD: what the player should read at a glance.
    blurb: `${time.blurb} ${weather.blurb}`,
  };
}

/**
 * Luck from the sky. Weather and time multiply, but the product is clamped: this
 * feeds the same rarity table everything else does, and it must not be able to
 * bend it.
 */
export function luckFromSky(time, weather) {
  const raw = (time?.luck ?? 1) * (weather?.luck ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(1.2, Math.max(0.85, raw));
}

/* -------------------------------------------------------------- fish index */

/**
 * The in-game fish index: every fish grouped by rarity, with the real odds.
 *
 * The chance per tier is derived from the weights in FISH rather than hardcoded,
 * so it cannot drift out of step with what rollFish() actually does. Each group's
 * chance is the share of the total weight that falls in that rarity.
 */
/**
 * What you feel the moment the hook goes in.
 *
 * One line per species, so a bite has a voice before the reeling starts. Unknown
 * fish fall back to a rarity-flavoured line, so an old save naming a fish that no
 * longer exists still says something rather than showing "undefined".
 */
export function hookLineFor(fish) {
  const spec = FISH.find((f) => f && f.id === (fish && fish.id));
  if (spec && spec.hook) return spec.hook;
  const idx = RARITY_ORDER.indexOf(fish?.rarity);
  const tier = idx >= 0 ? RARITY_ORDER[idx] : 'Common';
  const extra = tier === 'Common' ? '' : `, and ${tier.toLowerCase()}`;
  return `Something takes the bait. You feel it move${extra}.`;
}

/* ------------------------------------------------------------------ areas */

/* ------------------------------------------------------------ arrival gifts */

/**
 * Move to `areaId`, and take whatever that lake owes you.
 *
 * Arriving somewhere you have no rod for is not an experience worth shipping, so
 * a trait lake hands you its own rod — the first one in `requiredRods` — once, in
 * the bag and already equipped. The gift is recorded, so leaving and coming back
 * cannot farm it, and a lake you can already fish never gifts anything.
 *
 * Pure: returns a new object and never touches the one passed in.
 */
export function visitArea(progress, areaId) {
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  const owned = Array.isArray(progress?.owned) ? [...progress.owned] : [];
  const giftedRods = Array.isArray(progress?.giftedRods) ? [...progress.giftedRods] : [];
  const base = { ...progress, owned, giftedRods, areaId: area.id };

  const already = { ...base, rodId: progress?.rodId, gifted: null };

  // Nothing to hand over if the lake has no trait, or you can already fish it.
  if (!area.trait || rodWorksIn(progress?.rodId, area.id)) return already;
  if (owned.some((id) => rodWorksIn(id, area.id))) return already;

  const giftId = area.requiredRods?.[0];
  if (!giftId || !RODS[giftId]) return already;
  // Once only. An old save has no giftedRods at all, which correctly means the
  // player has not been gifted yet.
  if (giftedRods.includes(giftId)) return already;

  return {
    ...base,
    owned: addRodToInventory(owned, giftId),
    // Record the gift. Without this line the once-only check above could never
    // fire and the lake would hand over a free rod every single visit.
    giftedRods: [...giftedRods, giftId],
    rodId: giftId,
    gifted: giftId,
  };
}

/**
 * The lakes, in order. Each is a Frutiger world with its own light, and each is
 * harder than the last — a lake is unlocked by clearing the one before it.
 *
 * The palettes are lifted from the site's own five themes so a lake looks like
 * the shell theme it is named for. `locked` marks whether a lake opens from the
 * start; only the first does.
 */
export const AREAS = [
  {
    id: 'aero-lake',
    name: 'Aero Lake',
    theme: 'Frutiger Aero',
    blurb: 'Still, bright water under a very large sun.',
    locked: false,
    trait: null,
    requiredRods: ['bamboo', 'willow', 'carbon', 'oak', 'titan',
      'zephyr', 'quicksilver', 'horizon'],
    fish: ['glidefin', 'aero-minnow', 'sunscale', 'ripplefin', 'bubbleperch', 'glossdace',
      'prismminnow', 'haloherring', 'daylight', 'zenith'],
    palette: {
      skyTop: '#81d4fa', skyMid: '#b3e5fc', skyFloor: '#f4fbff',
      water: '#2f81c4', accent: '#4fc3f7',
      haze: 'rgba(255, 255, 255, 0.75)', sun: 'rgba(255, 255, 255, 0.95)',
    },
  },
  {
    id: 'doric-delta',
    name: 'DORFic Delta',
    theme: 'DORFic',
    blurb: 'Warm orange shallows cut by straight geometric channels.',
    locked: true,
    trait: 'channel',
    traitNote: 'needs a rod that can hold one straight line through the channels',
    requiredRods: [
'channel',
'spillway',
'delta-1',
'delta-2',
'delta-3',
'delta-4',
'delta-5',
'delta-6',
'delta-7',
'delta-8',],
    fish: ['coralpike', 'duskdarter', 'metro-trout', 'doric-dab', 'orangebarbel', 'emberfin',
      'rivetray', 'signalfin', 'civiceel'],
    palette: {
      skyTop: '#f7c894', skyMid: '#fbe0c4', skyFloor: '#fffaf4',
      water: '#c2701f', accent: '#e07b2a',
      haze: 'rgba(255, 240, 224, 0.5)', sun: 'rgba(255, 214, 170, 0.7)',
    },
  },
  {
    id: 'eco-marsh',
    name: 'Eco Marsh',
    theme: 'Eco',
    blurb: 'Green water, dappled light, and things that hide in it.',
    locked: true,
    trait: 'flex',
    traitNote: 'needs a rod that can reach over the reeds',
    requiredRods: [
'canopy',
'understory',
'marsh-1',
'marsh-2',
'marsh-3',
'marsh-4',
'marsh-5',
'marsh-6',
'marsh-7',
'marsh-8',],
    fish: ['reedcarp', 'lanternjack', 'mudsole', 'mirrorpike', 'eco-gar', 'coralpike',
      'canopycat', 'verdant'],
    palette: {
      skyTop: '#a8cf8f', skyMid: '#c8e0b0', skyFloor: '#f6faf0',
      water: '#4e7a35', accent: '#7aa84a',
      haze: 'rgba(255, 255, 255, 0.45)', sun: 'rgba(255, 255, 245, 0.85)',
    },
  },
  {
    id: 'glacier-fjord',
    name: 'Glacier Fjord',
    theme: 'Glacier',
    blurb: 'Pale blue ice water. Everything here is cold and fast.',
    locked: true,
    trait: 'ice',
    traitNote: 'needs a rod that can bore through the ice',
    requiredRods: [
'glacier',
'glacierwall',
'fjord-1',
'fjord-2',
'fjord-3',
'fjord-4',
'fjord-5',
'fjord-6',
'fjord-7',
'fjord-8',],
    fish: ['snowsmelt', 'frostfin', 'rimepike', 'blueglass', 'glacier-char', 'mirrorpike',
      'aurorachar'],
    palette: {
      skyTop: '#cfe6f5', skyMid: '#e3f1f9', skyFloor: '#fbfdff',
      water: '#3f7fa8', accent: '#7fc4e8',
      haze: 'rgba(255, 255, 255, 0.8)', sun: 'rgba(255, 255, 255, 1)',
    },
  },
  {
    id: 'dark-aero-deep',
    name: 'Dark Aero Deep',
    theme: 'Dark Aero',
    blurb: 'The bottom of the world, where the light barely reaches.',
    locked: true,
    trait: 'reinforced',
    traitNote: 'needs a rod reinforced enough for the pressure',
    requiredRods: [
'abyss',
'trenchline',
'deep-1',
'deep-2',
'deep-3',
'deep-4',
'deep-5',
'deep-6',
'deep-7',
'deep-8',],
    fish: ['deepglow', 'pressurefin', 'voidpike', 'blackmirror', 'lastlantern', 'glacier-char',
      'glowmote', 'eventhorizon'],
    palette: {
      skyTop: '#0f2a26', skyMid: '#123a32', skyFloor: '#0a1c18',
      water: '#06221c', accent: '#2ee6a8',
      haze: 'rgba(150, 200, 240, 0.08)', sun: 'rgba(180, 225, 255, 0.22)',
    },
  },
];

/**
 * Is this lake open yet?
 *
 * A lake opens once every fish that lives in it has been landed and every rod is
 * owned. The first lake is always open, so a fresh or corrupt save can always fish.
 */
/**
 * Can this rod work this lake?
 *
 * A lake that names a trait can only be fished with a rod carrying it. That is the
 * point of the specialist rods: without one, the lake is shut to you however much
 * money you have. Money buys the trait, but nothing else substitutes for it.
 */
export function rodWorksIn(rodId, areaId) {
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  if (!area.trait) return true;
  return (RODS[rodId]?.traits ?? []).includes(area.trait);
}

/** rodWorksIn, with a reason a player can read. */
export function rodCheckIn(rodId, areaId) {
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  if (!area.trait) return { ok: true, reason: '' };
  const rod = RODS[rodId];
  if (!rod) return { ok: false, reason: `Unknown rod: ${rodId}` };
  if (rod.traits.includes(area.trait)) return { ok: true, reason: '' };
  return {
    ok: false,
    reason: `${area.name} needs a rod with the ${area.trait} trait. ${rod.name} has none.`,
  };
}

/** Every lake this rod is allowed in, in order. */
export function areasForRod(rodId) {
  return AREAS.filter((a) => rodWorksIn(rodId, a.id));
}

/**
 * Is `area` open yet?
 *
 * The gate is the lake you are standing in, never the one being opened: every
 * species of that lake must be landed, and every rod built for it must be owned.
 *
 * It used to demand every rod in the game, which made the last lake impossible to
 * reach: Dark Aero Deep could not open until you already owned the Abyssal Rig
 * that Dark Aero Deep hands you. Each lake now declares its own rods in
 * `requiredRods`, so the gate is only ever as wide as the lake you are in.
 */
export function areaUnlocked(area, progress) {
  if (!area || area.locked === false) return true;
  const bestiary = progress?.bestiary ?? {};
  const owned = progress?.owned ?? [];
  const gate = previousAreaOf(area);

  // Every species of the lake you are standing in.
  if (!gate.fish.every((id) => Number(bestiary[id]) > 0)) return false;

  // And every rod built for it. A trait lake gates on its own trait, so the rods
  // you must own are the ones that can actually fish there.
  return gate.requiredRods.every((id) => owned.includes(id));
}

/**
 * The lake whose progress gates `area` — the one before it, or the first lake
 * itself when there is no earlier one. Factored out because areaUnlocked and
 * areaProgress must agree on which lake is being measured.
 */
function previousAreaOf(area) {
  const index = AREAS.indexOf(area);
  return index > 0 ? AREAS[index - 1] : (area ?? AREAS[0]);
}

/** How close a player is to opening the next lake, for the locked badge. */
export function areaProgress(area, progress) {
  const bestiary = progress?.bestiary ?? {};
  const owned = progress?.owned ?? [];
  // Same lake areaUnlocked measures, and the same rods it requires — otherwise
  // the badge and the gate disagree, which is worse than no badge at all.
  const gate = previousAreaOf(area);

  const landed = gate.fish.filter((id) => Number(bestiary[id]) > 0).length;
  const have = gate.requiredRods.filter((id) => owned.includes(id)).length;

  const missingRods = gate.requiredRods.length - have;
  const missingFish = gate.fish.length - landed;
  const reason = !missingRods && !missingFish ? '' : [
    missingRods ? `${missingRods} more rod${missingRods === 1 ? '' : 's'}` : null,
    missingFish ? `${missingFish} more fish` : null,
  ].filter(Boolean).join(', ');

  return { landed, total: gate.fish.length, rods: have, rodTotal: gate.requiredRods.length, reason };
}

export function fishIndex() {
  const total = FISH.reduce((sum, f) => sum + f.weight, 0);
  return RARITY_ORDER.map((rarity) => {
    const fish = FISH.filter((f) => f.rarity === rarity);
    const chance = fish.reduce((sum, f) => sum + f.weight, 0) / total * 100;
    return {
      rarity,
      colour: RARITY_COLOURS[rarity],
      chance,
      fish,
      // A short label for the index row: the cheapest to the heaviest member.
      from: Math.min(...fish.map((f) => f.minKg)),
      to: Math.max(...fish.map((f) => f.maxKg)),
    };
  });
}

/** One fish's row, with everything the index needs to display it. */
export function fishEntry(fish) {
  return {
    ...fish,
    colour: RARITY_COLOURS[fish.rarity],
    valueRange: [Math.round(fish.minKg * fish.pricePerKg), Math.round(fish.maxKg * fish.pricePerKg)],
  };
}
