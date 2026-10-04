/**
 * Binds the theme toggle button. No persistence by design: a fresh load always
 * starts on the default theme, so there is no flash of a previously chosen theme.
 */
import { DEFAULT_THEME, isKnownTheme, nextTheme, themeLabel } from './themes.js?v=2026-10-04-K';

const BUTTON_ID = 'theme-toggle';

/** Set the root data-theme, rejecting unknown ids so a typo cannot blank the page. */
export function applyTheme(window, id) {
  const theme = isKnownTheme(id) ? id : DEFAULT_THEME;
  window.document.documentElement.dataset.theme = theme;
  return theme;
}

export function initThemeButton(window) {
  const button = window.document.getElementById(BUTTON_ID);
  if (!button) return null;

  // Start from whatever is already on the root so the label matches the page.
  const current = window.document.documentElement.dataset.theme || DEFAULT_THEME;
  button.textContent = `Theme: ${themeLabel(current)}`;

  button.addEventListener('click', () => {
    const from = window.document.documentElement.dataset.theme || DEFAULT_THEME;
    const next = nextTheme(from);
    applyTheme(window, next);
    button.textContent = `Theme: ${themeLabel(next)}`;
    // Announce for screen readers; a purely visual control is otherwise silent.
    button.setAttribute('aria-label', `Switch theme. Current: ${themeLabel(next)}`);
  });

  return button;
}