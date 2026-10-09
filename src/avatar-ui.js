/**
 * The MSN Messenger profile card: a contact-card button in the header that opens
 * a 4x4 display-picture grid, the classic status list and a nickname field.
 *
 * All the rules live in messenger.js. This file renders them and writes back.
 */
import {
  STATUSES, AVATARS, avatarSrc, withAvatar, withStatus, withNick,
  loadProfile, saveProfile, profileSummary, statusById, NICK_MAX,
} from './messenger.js?v=2026-10-06-N';

const el = (id) => document.getElementById(id);

export function initAvatar(root = document) {
  const card = root.querySelector('[data-msn]');
  if (!card) return null;                       // a page without the header

  const face = card.querySelector('[data-msn-face]');
  const dot = card.querySelector('[data-msn-dot]');
  const label = card.querySelector('[data-msn-label]');
  const panel = card.querySelector('[data-msn-panel]');
  const grid = card.querySelector('[data-msn-grid]');
  const statusList = card.querySelector('[data-msn-statuses]');
  const nickInput = card.querySelector('[data-msn-nick]');
  const hint = card.querySelector('[data-msn-hint]');

  let profile = loadProfile(root.defaultView?.localStorage ?? window.localStorage);

  /* ------------------------------------------------------------- render */

  function paint() {
    const status = statusById(profile.statusId);
    face.src = avatarSrc(profile.avatarIndex);
    face.alt = `Your avatar: ${AVATARS[profile.avatarIndex].label}`;
    dot.style.background = status.colour;
    dot.title = status.label;
    label.textContent = profileSummary(profile);
    card.setAttribute('data-status', profile.statusId);
    if (hint) {
      hint.textContent = `${AVATARS[profile.avatarIndex].label} · ${status.label} — ${status.blurb}`;
    }
    for (const button of card.querySelectorAll('[data-msn-grid] button')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.index) === profile.avatarIndex));
    }
    for (const button of card.querySelectorAll('[data-msn-statuses] button')) {
      button.setAttribute('aria-pressed', String(button.dataset.status === profile.statusId));
    }
    if (nickInput && nickInput.value !== profile.nick && document.activeElement !== nickInput) {
      nickInput.value = profile.nick;
    }
  }

  function commit(next) {
    profile = next;
    saveProfile(root.defaultView?.localStorage ?? window.localStorage, profile);
    paint();
  }

  /* -------------------------------------------------------------- build */

  for (const avatar of AVATARS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msn__face-btn';
    button.dataset.index = String(avatar.index);
    button.setAttribute('aria-label', avatar.label);
    button.setAttribute('aria-pressed', 'false');
    const img = document.createElement('img');
    img.src = avatar.src;
    img.alt = '';
    img.width = 32;
    img.height = 32;
    button.appendChild(img);
    button.addEventListener('click', () => commit(withAvatar(profile, avatar.index)));
    grid.appendChild(button);
  }

  for (const status of STATUSES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msn__status-btn';
    button.dataset.status = status.id;
    button.setAttribute('aria-pressed', 'false');
    const pip = document.createElement('span');
    pip.className = 'msn__pip';
    pip.style.background = status.colour;
    const text = document.createElement('span');
    text.textContent = status.label;
    button.append(pip, text);
    button.addEventListener('click', () => commit(withStatus(profile, status.id)));
    statusList.appendChild(button);
  }

  /* -------------------------------------------------------------- wiring */

  function open() {
    panel.hidden = false;
    card.setAttribute('data-open', 'true');
  }
  function close() {
    panel.hidden = true;
    card.setAttribute('data-open', 'false');
    card.querySelector('[data-msn-toggle]')?.focus();
  }
  function toggle() {
    if (panel.hidden) open(); else close();
  }

  card.querySelector('[data-msn-toggle]').addEventListener('click', toggle);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();     // do not let the site also handle Escape
      close();
    }
  });

  // Click-away closes it, but a click inside must not.
  document.addEventListener('click', (event) => {
    if (panel.hidden || card.contains(event.target)) return;
    close();
  });

  nickInput?.addEventListener('change', (event) => commit(withNick(profile, event.target.value)));
  nickInput?.addEventListener('blur', (event) => commit(withNick(profile, event.target.value)));
  if (nickInput) nickInput.maxLength = NICK_MAX;

  paint();
  return { paint, close };
}
