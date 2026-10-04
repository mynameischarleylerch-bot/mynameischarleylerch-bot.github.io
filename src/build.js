/**
 * One build stamp for every asset the site loads at runtime.
 *
 * GitHub Pages serves everything with `Cache-Control: max-age=600`, so a URL that
 * never changes can come back up to ten minutes stale. That has silently broken
 * this site four separate times: a renamed game, a fixed credit line, a restyled
 * cover and a rewritten avatar all "didn't deploy".
 *
 * The rule: any asset referenced from JavaScript goes through `versioned()`. HTML
 * documents are covered the same way — play.js appends the stamp to the game's
 * iframe URL, which busts the document itself.
 *
 * Bump BUILD whenever you change a file the site loads. It is one string, in one
 * place, on purpose.
 */

export const BUILD = '2026-10-04-M';

/** Append the build stamp to a same-origin asset path, leaving it alone if present. */
export function versioned(url, build = BUILD) {
  if (typeof url !== 'string' || !url) return url;
  // External URLs are not ours to cache-bust, and already-unique URLs are left be.
  if (/^(https?:)?\/\//.test(url) || !url.startsWith('./')) return url;
  if (/(?:\?|&)v=/.test(url)) return url;
  // play.html already carries ?game=..., so the stamp has to join with '&'.
  return `${url}${url.includes('?') ? '&' : '?'}v=${build}`;
}
