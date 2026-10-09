/** Builds HTML strings from registry data. No DOM access — the browser gets a string. */

import { versioned } from './build.js?v=2026-10-06-N';



const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };



export function escapeHtml(value) {

  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

}



export function renderCard(game) {

  const playHref = versioned(`./play.html?game=${encodeURIComponent(game.slug)}`);

  const tags = (game.tags ?? [])

    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)

    .join('');

  return `

    <article class="card" data-featured="${game.featured === true}" data-slug="${escapeHtml(game.slug)}">

      <a class="card__cover" href="${escapeHtml(playHref)}" tabindex="-1" aria-hidden="true">

        <img src="${escapeHtml(versioned(game.cover))}" alt="" loading="lazy" width="320" height="180">

      </a>

      <div class="card__body">

        <h3 class="card__title">${escapeHtml(game.title)}</h3>

        <p class="card__summary">${escapeHtml(game.summary)}</p>

        <div class="card__tags">${tags}</div>

        <p class="card__controls">Controls: <kbd>${escapeHtml(game.controls)}</kbd></p>

        <div class="card__links">

          <a class="btn btn--play" href="${escapeHtml(playHref)}">Play</a>

          <a class="btn btn--repo" href="${escapeHtml(game.repoUrl)}" rel="noopener noreferrer">Source (${escapeHtml(game.year)})</a>

        </div>

      </div>

    </article>`;

}



export function renderGrid(games) {

  if (!Array.isArray(games) || games.length === 0) {

    return '<p class="empty">No games yet. Add one to <code>games.config.json</code>.</p>';

  }

  return `<div class="grid">${games.map(renderCard).join('')}</div>`;

}



export function renderTagFilters(tags, activeTag) {

  const buttons = (tags ?? [])

    .map(

      (tag) =>

        `<button class="chip" type="button" data-tag="${escapeHtml(tag)}" data-active="${tag === activeTag}">${escapeHtml(tag)}</button>`,

    )

    .join('');

  return `<div class="chips">

    <button class="chip" type="button" data-tag="" data-active="${!activeTag}">all</button>

    ${buttons}

  </div>`;

}