/**
 * Settings screen.
 *
 * Sections:
 *   Notifications — new matches, messages, likes, weekly digest (toggle switches)
 *   Preferences   — city, categories, distance unit (link rows)
 *   Account       — email (read-only), blocked swappers
 *   Danger zone   — delete account (confirmation required)
 *
 * Toggles update AppState immediately; updateProfile() persists to Supabase.
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { updateProfile }      from '../api.js';

// ── Render ────────────────────────────────────────────────────────────────────

export function renderSettings() {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  panel.innerHTML = _html();
  _bindDOM();
  if (window.lucide) window.lucide.createIcons();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html() {
  const { notifPush, notifMatch, notifEmail } = AppState;
  const email = AppState.user?.email ?? '';

  return `
    <div class="settings-screen">

      <div class="settings-header">
        <button class="settings-back-btn" id="btn-settings-back" aria-label="Go back">
          <i data-lucide="arrow-left"></i>
        </button>
        <h2>Settings</h2>
        <div style="flex:1;"></div>
      </div>

      <div class="settings-scroll">

        <!-- Notifications -->
        <div class="settings-section">
          <div class="settings-kicker">Notifications</div>

          ${_toggleRow({ id: 'toggle-match',  label: 'New matches',           checked: notifMatch })}
          ${_toggleRow({ id: 'toggle-push',   label: 'Messages',              checked: notifPush  })}
          ${_toggleRow({ id: 'toggle-likes',  label: 'Likes on my items',     checked: false      })}
          ${_toggleRow({ id: 'toggle-email',  label: 'Weekly treasure digest', checked: notifEmail })}
        </div>

        <div class="settings-divider"></div>

        <!-- Preferences -->
        <div class="settings-section">
          <div class="settings-kicker">Preferences</div>

          ${_linkRow({ label: 'City',              value: AppState.user?.home_city || 'Set city', action: 'change-city' })}
          ${_linkRow({ label: 'Categories I hunt', value: 'All', action: 'categories' })}
          ${_linkRow({ label: 'Show distance in',  value: 'km',  action: 'distance-unit' })}
        </div>

        <div class="settings-divider"></div>

        <!-- Account -->
        <div class="settings-section">
          <div class="settings-kicker">Account</div>

          ${_linkRow({ label: 'Email',            value: email,         truncate: true })}
          ${_linkRow({ label: 'Blocked swappers', value: '0' })}
        </div>

        <div class="settings-spacer"></div>

        <!-- Danger zone -->
        <div class="settings-danger">
          <button class="settings-danger-btn" id="btn-delete-account">
            Delete my account
          </button>
        </div>

      </div>
    </div>
  `;
}

function _toggleRow({ id, label, checked }) {
  return `
    <div class="settings-row">
      <span class="settings-row-label">${_esc(label)}</span>
      <button
        class="toggle-track ${checked ? 'toggle-track--on' : ''}"
        id="${id}"
        role="switch"
        aria-checked="${checked}"
        aria-label="${_esc(label)}"
      >
        <span class="toggle-knob"></span>
      </button>
    </div>
  `;
}

function _linkRow({ label, value, truncate = false, action = '' }) {
  return `
    <div class="settings-row settings-row--tappable" ${action ? `data-action="${action}"` : ''}>
      <span class="settings-row-label">${_esc(label)}</span>
      <span class="settings-row-value ${truncate ? 'settings-row-value--truncate' : ''}">
        ${_esc(value)}
        <i data-lucide="chevron-right" style="width:14px;height:14px;"></i>
      </span>
    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

let _panelClickHandler = null;

function _bindDOM() {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  if (_panelClickHandler) {
    panel.removeEventListener('click', _panelClickHandler);
  }

  _panelClickHandler = async (e) => {
    if (e.target.closest('#btn-settings-back')) {
      navigateTo('profile');
      return;
    }

    // Preference rows
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'change-city') {
      const { showCityModal } = await import('./auth.js');
      showCityModal();
      return;
    }

    const id = e.target.closest('[id]')?.id;
    switch (id) {
      case 'toggle-push':  await _toggle('notifPush',  'notif_push');  break;
      case 'toggle-match': await _toggle('notifMatch', 'notif_match'); break;
      case 'toggle-email': await _toggle('notifEmail', 'notif_email'); break;
      case 'toggle-likes': await _toggleLocal('toggle-likes');         break;
      case 'btn-delete-account': _confirmDelete(); break;
    }
  };

  panel.addEventListener('click', _panelClickHandler);
}

// ── Toggle logic ──────────────────────────────────────────────────────────────

async function _toggle(stateKey, dbKey) {
  const newVal = !AppState[stateKey];
  setState({ [stateKey]: newVal });

  const btn = document.getElementById(_dbKeyToToggleId(dbKey));
  if (btn) {
    btn.classList.toggle('toggle-track--on', newVal);
    btn.setAttribute('aria-checked', String(newVal));
  }

  const userId = AppState.user?.id;
  if (userId) await updateProfile(userId, { [dbKey]: newVal });
}

async function _toggleLocal(toggleId) {
  const btn = document.getElementById(toggleId);
  if (!btn) return;
  const newVal = btn.getAttribute('aria-checked') !== 'true';
  btn.classList.toggle('toggle-track--on', newVal);
  btn.setAttribute('aria-checked', String(newVal));
}

function _dbKeyToToggleId(dbKey) {
  const map = {
    'notif_push':  'toggle-push',
    'notif_match': 'toggle-match',
    'notif_email': 'toggle-email',
  };
  return map[dbKey] ?? '';
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function _confirmDelete() {
  const confirmed = window.confirm(
    'Delete your account? This removes all your listings and swap history. This cannot be undone.'
  );
  if (!confirmed) return;
  // TODO: call delete-account Edge Function in a later task
  console.warn('Account deletion not yet implemented.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
