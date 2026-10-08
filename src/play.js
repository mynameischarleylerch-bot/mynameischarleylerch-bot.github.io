/**

 * The player shell. The ONLY module that touches the DOM.

 * document and window arrive as parameters so jsdom can drive it in tests.

 *

 * Keyboard policy: this shell handles Escape and nothing else. Every other key

 * belongs to the game running inside the iframe. Swallowing them here would

 * break input for every game at once.

 */

import { versioned } from './build.js?v=2026-10-06-B';
import { findBySlug } from './config.js?v=2026-10-06-B';
import { backUrl } from './router.js?v=2026-10-06-B';


const ESCAPE_KEY = 'Escape';



export function initPlayer({ window, config, slug, onExit = null }) {

  const { document } = window;

  const titleEl = document.getElementById('title');

  const metaEl = document.getElementById('meta');

  const stageEl = document.getElementById('stage');

  const frameEl = document.getElementById('frame');

  const fullscreenEl = document.getElementById('fullscreen');

  const backEl = document.getElementById('back');



  if (backEl) backEl.setAttribute('href', backUrl());



  const game = findBySlug(config, slug);

  if (!game) {

    titleEl.textContent = 'Game not found';

    metaEl.textContent = `"${slug ?? ''}" is not in games.config.json. Add it, or go back to the arcade.`;

    stageEl.setAttribute('hidden', '');

    fullscreenEl?.setAttribute('hidden', '');

    return;

  }



  titleEl.textContent = game.title;

  metaEl.textContent = `${game.controls} · ${game.year}`;

  document.title = `${game.title} — Aero Arcade`;

  frameEl.setAttribute('src', versioned(game.playUrl));

  frameEl.setAttribute('title', game.title);



  fullscreenEl?.addEventListener('click', () => {

    const target = stageEl.requestFullscreen ? stageEl : document.documentElement;

    target.requestFullscreen?.().catch(() => {

      // Fullscreen can be denied (permissions, iframe embedding). The game still works.

    });

  });



  // Navigating is the default; onExit exists so a test can observe the intent

  // without depending on jsdom, which does not implement real page navigation.

  const exit = onExit ?? (() => window.location.assign(backUrl()));



  const onKeydown = (event) => {

    if (event.key !== ESCAPE_KEY) return; // every other key belongs to the game

    exit(backUrl());

  };

  document.addEventListener('keydown', onKeydown);



  // While the game has focus, keystrokes land in the iframe and never bubble to

  // the shell — so Esc has to be handled there too. Games are same-origin under

  // vendor/, which is what makes this reachable; a cross-origin game would just

  // not get an Esc handler and the Back button covers it.

  frameEl.addEventListener('load', () => {

    try {

      frameEl.contentDocument?.addEventListener('keydown', onKeydown);

    } catch {

      // Cross-origin frame: unreachable by design, not an error worth surfacing.

    }

  });

}