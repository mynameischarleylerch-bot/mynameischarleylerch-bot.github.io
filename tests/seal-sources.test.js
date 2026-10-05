import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';

const BASE = new URL('../vendor/seal-scroller/', import.meta.url);
const read = (name) => readFileSync(new URL(name, BASE), 'utf8');

/** Boot the real page + real modules in jsdom, with fetch served from disk. */
async function boot() {
  const html = read('index.html').replace('<script type="module" src="./sealfeed.js"></script>', '');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/vendor/seal-scroller/index.html',
    runScripts: 'outside-only',
    // The scroll handler is requestAnimationFrame-throttled; without this jsdom
    // has no rAF and every scroll would silently do nothing.
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse(read(String(url).replace('./', ''))),
  });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return 800; },
  });

  /*
   * jsdom has no media stack: HTMLMediaElement.play() logs "not implemented"
   * and returns undefined. Stub both, recording the calls, so the playback
   * logic can be asserted rather than merely survived.
   */
  const calls = [];
  // data-index lives on the <section>, not on the <video> inside it.
  const slideIndexOf = (node) => node.closest('.slide')?.dataset.index;
  Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get() { return this.dataset.pausedByUser === 'true'; },
  });
  window.HTMLMediaElement.prototype.play = function play() {
    calls.push(['play', slideIndexOf(this)]);
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function pause() {
    calls.push(['pause', slideIndexOf(this)]);
  };

  window.eval(read('scroll.js').replace(/export /g, ''));
  window.eval(read('likes.js').replace(/export /g, ''));
  window.eval(read('sealfeed.js').replace(/^import .*$/gm, '').replace(/export /g, ''));
  await new Promise((resolve) => setTimeout(resolve, 300));
  dom.mediaCalls = calls;
  return dom;
}

/** Scroll the feed to a slide and let the rAF-throttled scroll handler run. */
async function scrollTo(window, index) {
  const feed = window.document.getElementById('feed');
  feed.scrollTop = index * feed.clientHeight;
  feed.dispatchEvent(new window.Event('scroll'));
  // The handler defers setActive to the next animation frame.
  await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 40)));
}

test('the sources panel starts collapsed behind the Info button', async () => {
  const { window } = await boot();
  const d = window.document;
  assert.equal(d.getElementById('sources').classList.contains('is-open'), false);
  assert.equal(d.getElementById('sources-toggle').getAttribute('aria-expanded'), 'false');
  assert.match(d.getElementById('sources-toggle').textContent, /Info/);
});

test('the Info button opens and closes the panel', async () => {
  const { window } = await boot();
  const d = window.document;
  const toggle = d.getElementById('sources-toggle');
  const panel = d.getElementById('sources');

  toggle.dispatchEvent(new window.Event('click'));
  assert.equal(panel.classList.contains('is-open'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  toggle.dispatchEvent(new window.Event('click'));
  assert.equal(panel.classList.contains('is-open'), false);
});

test('the close button closes the panel and survives rendering', async () => {
  const { window } = await boot();
  const d = window.document;
  const toggle = d.getElementById('sources-toggle');

  toggle.dispatchEvent(new window.Event('click'));
  // The close button lives outside the rendered body, so it must still exist.
  const close = d.getElementById('sources-close');
  assert.ok(close, 'close button must not be destroyed by rendering sources');
  close.dispatchEvent(new window.Event('click'));
  assert.equal(d.getElementById('sources').classList.contains('is-open'), false);
});

test('Escape closes the panel', async () => {
  const { window } = await boot();
  const d = window.document;
  d.getElementById('sources-toggle').dispatchEvent(new window.Event('click'));
  d.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.getElementById('sources').classList.contains('is-open'), false);
});

test('the three named animals render with working links', async () => {
  const { window } = await boot();
  const links = [...window.document.querySelectorAll('.sources__name')];
  assert.equal(links.length, 3);
  assert.deepEqual(links.map((l) => l.textContent.trim()), ['Niko', 'Yuki', 'Yo-chan']);
  for (const link of links) {
    assert.match(link.getAttribute('href'), /^https:\/\//);
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(link.getAttribute('target'), '_blank');
  }
});

test('the feed renders every slide with a credit and a like button', async () => {
  const { window } = await boot();
  const d = window.document;
  const slides = [...d.querySelectorAll('.slide')];
  assert.equal(slides.length, 27);
  assert.ok(slides.every((s) => !!s.querySelector('.slide__credit')));
  // Every slide carries media, but not all of it is a photograph.
  assert.ok(slides.every((s) => !!s.querySelector('img.slide__img, video.slide__video')));
  assert.equal(d.querySelectorAll('.like').length, 27);
});

test('the manifest splits into stills and clips, and every file exists', async () => {
  const { window } = await boot();
  const d = window.document;
  assert.equal(d.querySelectorAll('img.slide__img').length, 22);
  assert.equal(d.querySelectorAll('video.slide__video').length, 5);

  const manifest = JSON.parse(read('gifs.json'));
  const media = new URL('./media/', BASE);
  for (const item of manifest.items) {
    assert.ok(existsSync(new URL(item.file, media)), `${item.file} is missing from media/`);
    if (item.poster) {
      assert.ok(existsSync(new URL(item.poster, media)), `${item.poster} is missing from media/`);
    }
  }
});

test('a clip is muted, looping and inline so autoplay is allowed on iOS', async () => {
  const { window } = await boot();
  for (const video of window.document.querySelectorAll('video.slide__video')) {
    assert.equal(video.hasAttribute('muted'), true, 'a clip with sound cannot autoplay');
    assert.equal(video.hasAttribute('loop'), true);
    assert.equal(video.hasAttribute('playsinline'), true);
    // A poster is what the visitor sees before the first byte of video lands,
    // and the only thing they see under prefers-reduced-motion.
    assert.match(video.getAttribute('poster') ?? '', /^\.\/media\/.+\.webp$/);
    assert.match(video.getAttribute('src') ?? '', /^\.\/media\/.+\.mp4$/);
  }
});

test('only the visible clip plays, and the rest are paused', async () => {
  const { window, mediaCalls } = await boot();
  mediaCalls.length = 0;

  // The opening slide is a photograph, so no clip is in play on load.
  assert.equal(window.document.querySelector('.slide[data-index="0"] video'), null);
  assert.deepEqual(mediaCalls.filter(([a]) => a === 'play'), [], 'nothing autoplays off-screen');

  // Move to the first clip (index 22) and confirm it plays and nothing else does.
  mediaCalls.length = 0;
  await scrollTo(window, 22);
  const plays = mediaCalls.filter(([action]) => action === 'play').map(([, i]) => Number(i));
  assert.ok(plays.includes(22), 'the clip you scrolled to must start');
  assert.deepEqual(plays, [...new Set(plays)], 'the same clip is not started twice per scroll');

  // Every other clip must have been told to stop.
  const paused = new Set(mediaCalls.filter(([a]) => a === 'pause').map(([, i]) => Number(i)));
  for (const video of window.document.querySelectorAll('video.slide__video')) {
    const index = Number(video.closest('.slide').dataset.index);
    if (index !== 22) {
      assert.ok(paused.has(index), `clip ${index} should have been paused`);
    }
  }
});

test('tapping a clip pauses it, and a scroll does not restart it', async () => {
  const { window, mediaCalls } = await boot();
  const video = window.document.querySelector('video.slide__video');
  const index = Number(video.closest('.slide').dataset.index);

  mediaCalls.length = 0;
  video.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.deepEqual(mediaCalls, [['pause', String(index)]]);
  assert.equal(video.dataset.pausedByUser, 'true');

  // Scrolling away and back must not override the visitor's choice.
  mediaCalls.length = 0;
  await scrollTo(window, index);
  assert.deepEqual(mediaCalls.filter(([a]) => a === 'play'), [], 'a paused clip stays paused');

  // A tap starts it again.
  mediaCalls.length = 0;
  video.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.deepEqual(mediaCalls, [['play', String(index)]]);
  assert.equal(video.dataset.pausedByUser, undefined);
});

test('liking a clip never pauses it', async () => {
  const { window, mediaCalls } = await boot();
  const video = window.document.querySelector('video.slide__video');
  const button = video.closest('.slide').querySelector('.like');

  mediaCalls.length = 0;
  button.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.deepEqual(mediaCalls, [], 'the like button stops propagation');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
});

test('the feed never reveals how many seals there are', async () => {
  const { window } = await boot();
  const d = window.document;
  const html = d.getElementById('feed').innerHTML;
  // No "1 / 20"-style counter, no one-dot-per-seal, and no total in the HUD.
  assert.ok(!/\d+\s*\/\s*\d+/.test(html), 'no n/total counter in the markup');
  assert.equal(d.querySelectorAll('.slide__badge').length, 0);
  assert.equal(d.querySelectorAll('.dot').length, 1, 'a single progress dot, not one per seal');
  assert.doesNotMatch(d.getElementById('hud').textContent, /\d/);
});

test('the like button toggles and records the state', async () => {
  const { window } = await boot();
  const d = window.document;
  const button = d.querySelector('.like[data-like="0"]');

  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.querySelector('.like__count').textContent, '0');

  button.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.ok(button.classList.contains('is-liked'));
  assert.equal(button.querySelector('.like__count').textContent, '1');

  button.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.querySelector('.like__count').textContent, '0');
});

test('each slide can be liked independently', async () => {
  const { window } = await boot();
  const d = window.document;
  const first = d.querySelector('.like[data-like="0"]');
  const third = d.querySelector('.like[data-like="2"]');
  first.dispatchEvent(new window.Event('click', { bubbles: true }));
  third.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(first.getAttribute('aria-pressed'), 'true');
  assert.equal(third.getAttribute('aria-pressed'), 'true');
  assert.equal(d.querySelector('.like[data-like="1"]').getAttribute('aria-pressed'), 'false');
});

test('every slide credits "The creator" and never names a person', async () => {
  const { window } = await boot();
  const d = window.document;
  const credits = [...d.querySelectorAll('.slide__credit')];
  assert.ok(credits.length > 0);
  for (const credit of credits) {
    const text = credit.textContent;
    assert.match(text, /The creator/);
    assert.doesNotMatch(text, /karin/i);
  }
});

test('no slide title or credit reveals the total number of seals', async () => {
  const { window } = await boot();
  const d = window.document;
  const text = d.getElementById('feed').textContent;
  // "Seal 11 of 20" used to sit in every credit and gave the whole game away.
  assert.doesNotMatch(text, /\bof\s+\d+\b/i);
  assert.doesNotMatch(text, /\b\d+\s*\/\s*\d+\b/);
});

test('a photo with no source renders plain text, not a dangling link', async () => {
  const { window } = await boot();
  const d = window.document;
  const credit = d.querySelector('.slide__credit');
  // The supplied photos have no source URL, so there must be no empty <a>.
  assert.equal(credit.querySelectorAll('a').length, 0);
  assert.ok(credit.querySelector('.slide__by'));
  assert.match(credit.textContent, /The creator/);
});

test('the feed fetches its JSON with a cache-busting query', async () => {
  // Pages serves with `Cache-Control: max-age=600`; a plain './gifs.json' can come
  // back stale for ten minutes.
  const source = read('sealfeed.js');
  assert.match(source, /const BUILD_ID = ['"][^'"]+['"]/);
  assert.match(source, /MANIFEST_URL = `\.\/gifs\.json\?v=\$\{BUILD_ID\}`/);
  assert.match(source, /SOURCES_URL = `\.\/sources\.json\?v=\$\{BUILD_ID\}`/);
});

test('the page loads sealfeed.js with a cache-busting query', async () => {
  // The real cause of a stale credit line: the script tag itself was unversioned,
  // so visitors ran old JS even after the JSON had been fixed.
  assert.match(read('index.html'), /src="\.\/sealfeed\.js\?v=[^"]+"/);
});

test('sealfeed.js imports its dependencies with cache-busting queries', () => {
  const source = read('sealfeed.js');
  for (const dep of ['scroll.js', 'likes.js']) {
    assert.match(source, new RegExp(`from '\./${dep.replace('.', '\\.')}\\?v=`));
  }
});

test('the site shell loads its entry points with cache-busting queries', () => {
  const root = new URL('..', import.meta.url);
  const indexHtml = readFileSync(new URL('index.html', root), 'utf8');
  const playHtml = readFileSync(new URL('play.html', root), 'utf8');
  assert.match(indexHtml, /src="\.\/src\/app\.js\?v=[^"]+"/);
  assert.match(indexHtml, /href="\.\/styles\.css\?v=[^"]+"/, 'the stylesheet must be versioned');
  assert.match(playHtml, /href="\.\/styles\.css\?v=[^"]+"/, 'the stylesheet must be versioned');
  assert.match(indexHtml, /from '\.\/src\/theme-ui\.js\?v=[^"]+'/);
  assert.match(playHtml, /from '\.\/src\/play\.js\?v=[^"]+'/);
  assert.match(playHtml, /from '\.\/src\/router\.js\?v=[^"]+'/);
  assert.match(playHtml, /from '\.\/src\/theme-ui\.js\?v=[^"]+'/);
});

test('app.js fetches games.config.json with a cache-busting query', () => {
  // The version must also apply to the DATA fetch, not just the script tag. Without
  // it a renamed game kept showing the old title for ten minutes.
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /const CONFIG_URL = '\.\/games\.config\.json\?v=[^"']+'/);
});

test('the photo sits in a smaller frame rather than filling the slide', async () => {
  const { window } = await boot();
  const d = window.document;
  const frame = d.querySelector('.slide__frame');
  assert.ok(frame, 'slide__frame wrapper exists');
  // The media is a child of the frame, so the frame can constrain its size.
  assert.ok(frame.querySelector('img.slide__img, video.slide__video'));
});
