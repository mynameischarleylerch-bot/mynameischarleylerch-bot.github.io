# Arcade

A tiny site that lists the games I build and plays them right in the page.
No framework, no build step, no runtime dependencies — `jsdom` is dev-only.

## Run it locally

    npm install
    npm run serve        # http://localhost:8080
    npm test

Open http://localhost:8080/index.html. Do not open `index.html` from the file
system: `fetch()` of `games.config.json` is blocked on `file://`.

## Layout

    games.config.json      registry: one object per game
    src/config.js          validation + queries (pure)
    src/render.js          card/grid HTML strings (pure)
    src/router.js          ?game=slug resolution (pure)
    src/play.js            the only DOM module; window/document are parameters
    vendor/<slug>/         built game files, committed, same-origin iframe
    scripts/vendor.mjs     copy a game's build into vendor/<slug>/
    scripts/validate-config.mjs
    tests/                 node:test + jsdom

## Add a game

1. Build your game to a folder containing `index.html` (static files, no
   bundler needed — relative paths only, since it is served from a subpath).
2. Add an entry to `games.config.json`:

       { "slug": "my-game", "title": "My Game", "summary": "One line.",
         "repoUrl": "https://github.com/mynameischarleylerch-bot/my-game",
         "playUrl": "./vendor/my-game/index.html",
         "cover": "./assets/covers/my-game.svg",
         "tags": ["arcade"], "controls": "Arrow keys", "year": 2026,
         "featured": false }

   `slug` must be lowercase kebab-case and unique. `playUrl` and `cover` must
   start with `./` or `https://` — the validator rejects anything else, which is
   what stops a `javascript:` URL from ever reaching an `href`.
3. Import the build:

       node scripts/vendor.mjs my-game /path/to/build

4. Add a cover image at `assets/covers/my-game.svg`.
5. `npm test` then open the game and play it for 20 seconds.

## Deploy

Push to GitHub, then **Settings → Pages → Source: GitHub Actions**. The included
workflow publishes the repo root to `https://mynameischarleylerch-bot.github.io/`.

The repository is named after the account, which is what makes it a GitHub *user
site*: GitHub serves a repo called `<account>.github.io` from the bare host, with no
path. Every asset path here is `./`-relative, so the site works at any path — which
is why moving it was a repository rename and nothing else.

## Rules that keep this working

- Every asset path is `./`-relative, never `/`-rooted. A leading `/` works when you
  open the file locally and 404s in production, and it would break the site the
  moment it moved to a different path. `tests/cache-stamps.test.js` enforces this.
- Games live in `vendor/<slug>/` and are same-origin, so the player iframe has no
  cross-origin restrictions and input works.
- The player shell handles only `Esc`, in both the page and the game iframe —
  while a game has focus, keystrokes never reach the shell. Every other key
  belongs to the game.

## Seal Scroller

A vertical, snap-scrolling feed in the same Aero glass as the rest of the site. Arrow keys,
page keys, mouse wheel and touch all work; the last seal wraps to the top. Each photo gets a
slow CSS pan/zoom so it reads as a moving clip.

The feed holds **two kinds of slide**. A photograph is an `<img>` and gets the Ken Burns pan.
A clip is a `<video>` in `media/clips/`, plays muted and looping, and does **not** get the pan —
scaling a moving picture reads as a wobble, not as cinema. `gifs.json` has no `type` field: a
slide is a clip purely because its `file` ends in `.mp4`/`.webm`/`.mov`, and it names a `poster`
still of frame one so something shows before the video arrives.

**Only the visible clip plays.** `setActive()` pauses every other clip on each scroll, so the
feed costs one video decoder instead of five. Tapping a clip pauses it, and a later scroll will
not override that choice — the visitor's decision outranks the autoplay rule. The like button
calls `stopPropagation()`, so liking a slide can never pause its clip. Under
`prefers-reduced-motion: reduce` nothing autoplays at all and the poster stays up.

**Every clip is H.264/AAC in yuv420p with `+faststart`.** This is not incidental: four of the
five supplied `.mp4` files were VP9-in-an-MP4-container, which Chrome plays and **Safari on
iPhone does not**, so those seals would have been black rectangles for most visitors. They were
re-encoded rather than copied. The same pass capped the long edge at 960×1200 and the bitrate
per second of runtime, taking 13.2 MB of originals down to 7.4 MB in the repository.

### Where the photos come from

The photographs in `vendor/seal-scroller/media/stars/` and the video clips in
`vendor/seal-scroller/media/clips/` were **supplied directly by The creator** for this site, and
each slide credits them as "The creator". They are not Creative Commons and are committed for
personal use only — do not redistribute them. `gifs.json` records the credit line and the file
order. Adding a clip is three steps: drop the file in `media/clips/`, export a frame-one still
beside it, and add an item with both paths. `tests/seal-sources.test.js` fails if a manifest
entry points at a file that is not on disk, so a typo cannot ship as a broken slide.

`scripts/fetch-seals.mjs` is **disabled**. It used to pull CC-licensed photos from
[Openverse](https://openverse.org), and it exited non-zero rather than being deleted because
leaving a stale script that writes into `media/` would be a trap. There is no automated
refresh for this feed; to change the photos, replace the files in `media/stars/` and re-order
the `items` array in `gifs.json`.

An earlier version of this feed used those Openverse photos. Two problems with it: the
searches surfaced wax seals, civic crests and museum artefacts alongside animals, and one
photo was verified by eye as a **dead, human-handled seal** (belly-up, abdomen cut open,
exposed tissue). That photo was removed. The lesson is recorded here because it generalises:
obvious-to-the-eye content cannot be detected from a filename, a title or a search rank, and
a filtered fetcher is not a content review.

### Sources panel

Beside the scroller, a glass panel lists the three animals this feed is about, each linking
to the facility that cares for it. The data lives in `vendor/seal-scroller/sources.json`:

| Seal | Species | Facility |
|---|---|---|
| Niko | Baikal seal (*Pusa sibirica*) | [Toba Aquarium](https://www.toba-aquarium.com/), Mie |
| Yuki | Ringed seal (*Pusa hispida*) | [Osaka Aquarium Kaiyukan](https://www.kaiyukan.com/) |
| Yo-chan | Ringed seal (*Pusa hispida*) | [Okhotsk Tokkari Center](https://o-tower.co.jp/tokkaricenter.html), Hokkaido |

The panel loads from `sources.json` independently of the feed and fails soft: if that file is
missing the panel simply stays collapsed and the scroller still works.

**It starts collapsed**, behind a glass **Info** button in the top-right of the feed. Three
ways to close it: the Info button again, the round `×` inside the panel, or `Escape`. When
collapsed it is `visibility: hidden`, not merely transparent, so it cannot swallow a swipe on
the feed underneath — a real bug when the panel was previously `hidden` but still occupying
the layout. Under 760px, where there is no room beside the feed, the panel slides up from the
bottom instead of across.

`tests/seal-sources.test.js` covers the collapsed initial state, all three ways of closing,
`aria-expanded` wiring, the three links, and that the feed still renders. It also covers the
clips: that every manifest entry resolves to a real file, that each clip is muted/looping/
inline with a poster, that only the visible clip plays, and that tapping or liking a clip
behaves. jsdom has no media stack, so the test stubs `play`/`pause` and records the calls, and
boots with `pretendToBeVisual` — the scroll handler is `requestAnimationFrame`-throttled and
without that flag every scroll would silently no-op. The close-button test
exists because rendering the sources used to overwrite the aside's `innerHTML` and silently
delete the `×` button.

**The panel credits the animals; it does not claim the photographs are of them.** The supplied
photos include harbour seals and a harp seal pup as well as the three named animals, and there
is no reliable way to tell which is which from the image alone. Labelling a photo "Yuki"
without certainty would put a false claim about an identifiable animal on the page.

## Licence

**All rights reserved.** The source code in this repository is not open source and is not
covered by an open-source licence. You may read it, but you may not copy, modify,
redistribute, republish, sub-license, sell, or build derivative works from it without
written permission. See [LICENSE](LICENSE).

The photographs in `vendor/seal-scroller/media/stars/` and the clips in
`vendor/seal-scroller/media/clips/` are **not** covered by that notice and are not open either —
they are credited on screen as "The creator" and are for personal, non-commercial display only.

The repository is public because GitHub Pages only serves public repositories on the free
plan. That is a hosting constraint, not an invitation to reuse the code.

## Frutiger Angler

A fishing game built on the same loop as Roblox's Fisch: hold to fill a cast meter and
release in the green band, wait through `SHAKE` prompts to shorten the bite, then keep the
moving fish line inside your bar until the progress bar fills. Empty progress snaps the line.

Selling fish at `base ¤/kg × weight × mutation` funds rods, and rods are the progression:
**Control** widens your bar, **Resilience** damps how hard the fish fights, **Luck** shifts the
weight table toward rarer fish, and each rod has a weight ceiling that can genuinely snap a
line on a heavy catch.

The six fish are original and named for the Frutiger-Family aesthetics — Glidefin, Aero Minnow,
Metro Trout, DORFic Dab, Eco Gar, Glacier Char — deliberately not real species or Fisch names.
Rarity order follows Fisch's (Common → Uncommon → Rare → Legendary → Mythical) so the
difficulty curve reads the same.

All rules are pure functions in `vendor/fru-angler/fishing.js` (rods, casts, fish, economy)
and `vendor/fru-angler/reel.js` (the minigame maths), so both are unit-tested without a
browser. `angler.js` only turns their output into pixels.

## MSN Messenger profile card

The header carries a Messenger-style contact card: your avatar with a status dot, the classic
status list (Online, Busy, Be right back, Away, On the phone, Out to lunch, Appear offline,
Offline) and an editable nickname. Open it and pick any of **sixteen display pictures** from
the 4x4 grid Messenger used.

Each avatar is a glossy Aero orb — a sky gradient in a round clip, with a sun bloom, a specular
highlight and a simple line glyph (bubble, wave, leaf, sun, droplet, star, crystal, fish). The
sixteen differ by hue and by glyph, so the grid reads as a set rather than sixteen identical
tiles. All sixteen are generated by `scripts/gen-avatars.mjs` and committed, so there is still
no build step.

The same Messenger figure — one big round head merged into a body with shoulder lobes, no legs
or arms — is the **angler** in Frutiger Angler, drawn as a flat silhouette standing on the pier
deck with an Aero gloss on the head. It is Aero glass, so it follows whichever theme is active, and
the choice persists in `localStorage`.

Rules live in `src/messenger.js` (statuses, the avatar table, storage repair), rendering in
`src/avatar-ui.js`. The sixteen avatars are generated once by `scripts/gen-avatars.mjs` and
committed, so the site still has no build step — re-run that script to restyle them.

## Themes

The **Theme:** button in the header cycles the page between five Frutiger-Family looks:

| Theme | Character |
|---|---|
| Frutiger Aero | The original: glossy glass, aqua, sky, hills, bubbles |
| Frutiger DORFic | Abstract and near-minimal — flat fields, thin rules, no gloss |
| Frutiger Eco | Organic and matte — green and earth, natural surfaces |
| Frutiger Glacier | Cold and high-key — ice blue, frosted |
| Dark Aero | The same glass and gloss on near-black |

DORFic, Eco and Glacier are established Frutiger-Family aesthetics (siblings to Frutiger
Aero, alongside Metro, Technozen, Aurora and Jolly), each named after an Adrian Frutiger
typeface. The palettes follow that character rather than being arbitrary colour swaps.

Every colour in `styles.css` is a custom property on `:root`. Each theme is a
`[data-theme="name"]` block that redefines **only** those properties; shape, spacing and
motion are shared. Switching sets `data-theme` on `<html>` (`src/theme-ui.js`), so there is
no reload and no re-render.

Two deliberate limits:

- **Games keep their own colours.** The theme applies to site chrome only. Each game is a
  separate document in an `iframe`, so a parent theme cannot leak into it. Theming the
  games would mean editing every vendored file, and they would drift apart over time.
- **The choice is not remembered.** A fresh visit always starts on Frutiger Aero. There is
  no `localStorage`, which also means no flash of a stale theme on load.

### Adding a theme

1. Add an entry to `THEMES` in `src/themes.js` (`id` must be lowercase kebab-case).
2. Add a matching `[data-theme="id"]` block in `styles.css`.
3. Run `npm test`. Two checks guard this:
   - `scripts/check-themes.mjs` fails if the block does not override **every** palette
     token on `:root`, so a partial block is caught immediately rather than shipping one
     element that stays Aero.
   - `scripts/check-contrast.mjs` fails if body text drops below WCAG AA (4.5:1) against the
     background or the card surface.

Both run as part of `npm test`. `color-scheme: dark` in the Dark Aero block is what makes
form controls and scrollbars render dark too.