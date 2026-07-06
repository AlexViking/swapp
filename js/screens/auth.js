/**
 * Auth screen — new endowment-effect onboarding
 *
 * Flow A (new user):  design → signup → verify → city modal → swipe
 * Flow B (returning): design → login  → verify → swipe
 *
 * Palette + card style saved to localStorage, applied on every load.
 */

import { AppState, setState } from '../state.js';
import { requestOTP, saveCity } from '../api.js';
import { navigateTo } from '../router.js';

// Views
let authView     = 'design';   // 'design' | 'signup' | 'login' | 'verify'
let pendingEmail = '';
let pendingName  = '';

// Profile customisation (persisted to localStorage)
const PALETTES = [
  { id: 'forest',     label: 'Forest',     bg: '#2F6A52', surface: '#F7F2E1' },
  { id: 'brass',      label: 'Brass',      bg: '#E9BE8C', surface: '#33322B' },
  { id: 'terracotta', label: 'Terracotta', bg: '#C97C5E', surface: '#F0EBD8' },
  { id: 'denim',      label: 'Denim',      bg: '#4E6FA3', surface: '#F7F2E1' },
];
const CARD_STYLES = [
  { id: 'rounded', label: 'Rounded', radius: '14px' },
  { id: 'sharp',   label: 'Sharp',   radius: '4px'  },
];

let _palette   = localStorage.getItem('swapp_palette')    || 'forest';
let _cardStyle = localStorage.getItem('swapp_card_style') || 'rounded';

// City picker
let _selectedCity     = null;
let _citySheetContext = null;

// Resend countdown
let _resendInterval = null;
let _resendSeconds  = 0;

function setView(v) { authView = v; renderAuth(); }

// ─── Apply theme to :root ──────────────────────────────────────────────────────

function _applyTheme() {
  const p = PALETTES.find(p => p.id === _palette) || PALETTES[0];
  const c = CARD_STYLES.find(c => c.id === _cardStyle) || CARD_STYLES[0];
  document.documentElement.style.setProperty('--theme-accent', p.bg);
  document.documentElement.style.setProperty('--theme-surface', p.surface);
  document.documentElement.style.setProperty('--r-card', c.radius);
  localStorage.setItem('swapp_palette', _palette);
  localStorage.setItem('swapp_card_style', _cardStyle);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderAuth() {
  const el = document.getElementById('auth-view');
  if (!el) return;

  _applyTheme();

  if (_resendInterval && authView !== 'verify') {
    clearInterval(_resendInterval);
    _resendInterval = null;
  }

  const views = {
    design: _design,
    signup: _signup,
    login:  _login,
    verify: _verify,
  };

  el.innerHTML = `<div class="auth-shell">${(views[authView] || _design)()}</div>`;

  _renderCitySheet();
  _bindEvents();

  if (authView === 'verify') _startResendCountdown();
}

// ─── Design your profile ──────────────────────────────────────────────────────

function _design() {
  const p = PALETTES.find(p => p.id === _palette) || PALETTES[0];

  return `
    <div class="auth-design">

      <!-- Live preview card -->
      <div class="auth-preview-card" id="preview-card"
        style="background:${p.bg}; border-radius: var(--r-card);">
        <div class="auth-preview-avatar" style="background:${p.surface}20;">
          <span id="preview-initial">${pendingName ? _esc(pendingName[0].toUpperCase()) : '?'}</span>
        </div>
        <div class="auth-preview-name" style="color:${p.surface};">
          ${pendingName ? _esc(pendingName) : 'Your name'}
        </div>
        <div class="auth-preview-tag" style="color:${p.surface}80;">swapper</div>
      </div>

      <div class="auth-design-form">
        <div class="auth-design-header">
          <div class="auth-logo">swapp</div>
          <h1>Design your profile</h1>
          <p class="auth-sub">Make it yours before you sign up.</p>
        </div>

        <!-- Name -->
        <div class="auth-field">
          <label class="label" for="inp-name">Your name</label>
          <input class="input" id="inp-name" type="text"
            placeholder="e.g. Maya" autocomplete="name"
            value="${_esc(pendingName)}" maxlength="30">
        </div>

        <!-- Palette -->
        <div class="auth-field">
          <span class="label">Colour palette</span>
          <div class="auth-palette-row">
            ${PALETTES.map(p => `
              <button class="auth-palette-swatch ${_palette === p.id ? 'auth-palette-swatch--active' : ''}"
                data-palette="${p.id}"
                style="background:${p.bg};"
                aria-label="${p.label}"
                title="${p.label}">
                ${_palette === p.id ? '<i data-lucide="check"></i>' : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Card style -->
        <div class="auth-field">
          <span class="label">Card style</span>
          <div class="auth-card-style-row">
            ${CARD_STYLES.map(c => `
              <button class="auth-card-style-btn ${_cardStyle === c.id ? 'auth-card-style-btn--active' : ''}"
                data-card-style="${c.id}"
                style="border-radius:${c.radius};">
                ${c.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- CTA -->
        <button class="btn btn-primary auth-cta" id="btn-continue-signup"
          ${!pendingName.trim() ? 'disabled' : ''}>
          Continue to sign up
        </button>

        <button class="auth-link" id="btn-go-login">I already have an account</button>
      </div>

    </div>
  `;
}

// ─── Sign up ──────────────────────────────────────────────────────────────────

function _signup() {
  const cityLabel = _selectedCity || 'Pick your city ▾';
  const cityClass = _selectedCity ? 'input city-trigger has-city' : 'input city-trigger';

  return `
    <div class="auth-form-screen">
      <button class="auth-back-btn" id="btn-back-design" aria-label="Back">
        <i data-lucide="arrow-left"></i>
      </button>

      <div class="auth-form-body">
        <h2>Almost there</h2>
        <p class="auth-sub">We'll send a magic link — no password needed.</p>

        <div class="auth-field">
          <label class="label" for="inp-email">Email</label>
          <input class="input" id="inp-email" type="email"
            placeholder="you@somewhere.com" autocomplete="email"
            value="${_esc(pendingEmail)}">
        </div>

        <div class="auth-field">
          <label class="label">Where do you swap?</label>
          <button class="${cityClass}" id="btn-city-trigger" type="button">${_esc(cityLabel)}</button>
        </div>

        <div id="auth-error" class="auth-error hidden"></div>

        <button class="btn btn-primary" id="btn-send-otp">Send me a magic link</button>
      </div>
    </div>
  `;
}

// ─── Login ────────────────────────────────────────────────────────────────────

function _login() {
  return `
    <div class="auth-form-screen">
      <button class="auth-back-btn" id="btn-back-design" aria-label="Back">
        <i data-lucide="arrow-left"></i>
      </button>

      <div class="auth-form-body">
        <h2>Welcome back</h2>
        <p class="auth-sub">Enter your email and we'll send a magic link.</p>

        <div class="auth-field">
          <label class="label" for="inp-email">Email</label>
          <input class="input" id="inp-email" type="email"
            placeholder="you@somewhere.com" autocomplete="email"
            value="${_esc(pendingEmail)}">
        </div>

        <div id="auth-error" class="auth-error hidden"></div>

        <button class="btn btn-primary" id="btn-send-otp-login">Send me a magic link</button>

        <button class="auth-link" id="btn-go-signup">Create an account instead</button>
      </div>
    </div>
  `;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

function _verify() {
  return `
    <div class="auth-form-screen">
      <button class="auth-back-btn" id="btn-back-design" aria-label="Back">
        <i data-lucide="arrow-left"></i>
      </button>

      <div class="auth-form-body auth-form-body--centered">
        <div class="auth-verify-icon">
          <i data-lucide="mail"></i>
        </div>

        <h2>Check your inbox</h2>
        <p class="auth-sub">Magic link sent to <strong>${_esc(pendingEmail)}</strong>. Tap it to sign in.</p>

        <div class="auth-resend-card">
          <p>Didn't get it?</p>
          <button class="btn btn-primary" id="btn-resend" disabled>Resend link (1:00)</button>
        </div>

        <button class="auth-link" id="btn-diff-email">Use a different email</button>
      </div>
    </div>
  `;
}

// ─── Resend countdown ─────────────────────────────────────────────────────────

function _startResendCountdown() {
  if (_resendInterval) clearInterval(_resendInterval);
  _resendSeconds = 60;
  _updateResendBtn();
  _resendInterval = setInterval(() => {
    _resendSeconds -= 1;
    _updateResendBtn();
    if (_resendSeconds <= 0) {
      clearInterval(_resendInterval);
      _resendInterval = null;
      const btn = document.getElementById('btn-resend');
      if (btn) { btn.disabled = false; btn.textContent = 'Resend link'; }
    }
  }, 1000);
}

function _updateResendBtn() {
  const btn = document.getElementById('btn-resend');
  if (!btn) return;
  const m = Math.floor(_resendSeconds / 60);
  const s = String(_resendSeconds % 60).padStart(2, '0');
  btn.textContent = `Resend link (${m}:${s})`;
  btn.disabled = true;
}

// ─── City sheet ───────────────────────────────────────────────────────────────

const CITIES = [
  'Amsterdam', 'Barcelona', 'Berlin', 'Brussels', 'Copenhagen',
  'Dublin', 'Helsinki', 'Lisbon', 'London', 'Madrid',
  'Milan', 'Oslo', 'Paris', 'Prague', 'Rome',
  'Stockholm', 'Vienna', 'Warsaw', 'Zurich',
];

function _renderCitySheet() {
  const overlay = document.getElementById('city-modal-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="sheet-overlay" id="sheet-overlay-bg">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Pick your city">
        <div class="sheet-grabber"></div>
        <h3>Where do you swap?</h3>

        <div class="city-search">
          <i data-lucide="search"></i>
          <input class="input" id="city-search-inp" type="search"
            placeholder="Search cities…" autocomplete="off">
        </div>

        <button class="city-location-btn" id="btn-use-location" type="button">
          <i data-lucide="map-pin"></i>
          Use my location
        </button>

        <hr class="sheet-divider">

        <div class="city-sheet-list" id="city-list">
          ${_cityRows(CITIES)}
        </div>

        <button class="btn btn-primary" id="btn-confirm-city" disabled>Swap here</button>
      </div>
    </div>
  `;

  overlay.classList.add('hidden');
  _bindCitySheet();
}

function _cityRows(cities) {
  return cities.map((c, i) => `
    <div class="city-sheet-row ${_selectedCity === c ? 'selected' : ''}" data-city="${_esc(c)}">
      <span>${_esc(c)}</span>
      <input type="radio" name="city-radio" value="${_esc(c)}"
        ${_selectedCity === c ? 'checked' : ''} tabindex="-1" aria-hidden="true">
    </div>
    ${i < cities.length - 1 ? '<hr class="sheet-row-divider">' : ''}
  `).join('');
}

function _bindCitySheet() {
  _on('city-search-inp', 'input', (e) => {
    const q = e.target.value.toLowerCase();
    const list = document.getElementById('city-list');
    if (list) list.innerHTML = _cityRows(CITIES.filter(c => c.toLowerCase().includes(q)));
    _bindCityRows();
    _updateConfirmBtn();
  });

  _on('btn-use-location', 'click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {}
    );
  });

  _bindCityRows();
  _on('btn-confirm-city', 'click', _handleConfirmCity);
  _on('sheet-overlay-bg', 'click', (e) => {
    if (e.target.id === 'sheet-overlay-bg') _closeCitySheet();
  });
}

function _bindCityRows() {
  document.querySelectorAll('.city-sheet-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.city-sheet-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      const radio = row.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      _selectedCity = row.dataset.city;
      _updateConfirmBtn();
    });
  });
}

function _updateConfirmBtn() {
  const btn = document.getElementById('btn-confirm-city');
  if (btn) btn.disabled = !_selectedCity;
}

function _closeCitySheet() {
  const overlay = document.getElementById('city-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function _handleConfirmCity() {
  if (!_selectedCity) return;
  if (_citySheetContext === 'signup') {
    const trigger = document.getElementById('btn-city-trigger');
    if (trigger) { trigger.textContent = _selectedCity; trigger.classList.add('has-city'); }
    _closeCitySheet();
  } else {
    _handleSaveCity();
  }
}

export function showCityModal() {
  _citySheetContext = 'modal';
  _selectedCity = null;
  const overlay = document.getElementById('city-modal-overlay');
  if (!overlay) return;
  _renderCitySheet();
  if (window.lucide) window.lucide.createIcons();
  overlay.classList.remove('hidden');
}

// ─── Event binding ────────────────────────────────────────────────────────────

function _bindEvents() {
  // Design screen
  const nameInput = document.getElementById('inp-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      pendingName = nameInput.value;
      // Live update preview
      const initial = document.getElementById('preview-initial');
      const nameEl  = document.querySelector('.auth-preview-name');
      if (initial) initial.textContent = pendingName ? pendingName[0].toUpperCase() : '?';
      if (nameEl)  nameEl.textContent  = pendingName || 'Your name';
      // Gate CTA
      const cta = document.getElementById('btn-continue-signup');
      if (cta) cta.disabled = !pendingName.trim();
    });
  }

  // Palette swatches
  document.querySelectorAll('[data-palette]').forEach(btn => {
    btn.addEventListener('click', () => {
      _palette = btn.dataset.palette;
      localStorage.setItem('swapp_palette', _palette);
      _applyTheme();
      // Re-render design screen to update swatch active states + preview
      renderAuth();
    });
  });

  // Card style buttons
  document.querySelectorAll('[data-card-style]').forEach(btn => {
    btn.addEventListener('click', () => {
      _cardStyle = btn.dataset.cardStyle;
      localStorage.setItem('swapp_card_style', _cardStyle);
      _applyTheme();
      renderAuth();
    });
  });

  _on('btn-continue-signup', 'click', () => {
    if (pendingName.trim()) setView('signup');
  });
  _on('btn-go-login',    'click', () => setView('login'));
  _on('btn-go-signup',   'click', () => setView('signup'));
  _on('btn-back-design', 'click', () => setView('design'));

  _on('btn-send-otp',       'click', _handleSendOTP);
  _on('btn-send-otp-login', 'click', _handleSendOTPLogin);
  _on('btn-resend',         'click', _handleResend);
  _on('btn-diff-email',     'click', () => {
    if (_resendInterval) { clearInterval(_resendInterval); _resendInterval = null; }
    setView(pendingName ? 'signup' : 'login');
  });

  _on('btn-city-trigger', 'click', () => {
    _citySheetContext = 'signup';
    const overlay = document.getElementById('city-modal-overlay');
    if (overlay) { overlay.classList.remove('hidden'); if (window.lucide) window.lucide.createIcons(); }
  });

  if (window.lucide) window.lucide.createIcons();
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function _handleSendOTP() {
  const email = document.getElementById('inp-email')?.value.trim();
  if (!email || !email.includes('@')) return _showError('Please enter a valid email.');

  pendingEmail = email;
  sessionStorage.setItem('swapp_pending_name', pendingName);

  _setLoading(true);
  const { error } = await requestOTP(email);
  _setLoading(false);

  if (error) return _showError(error.message);
  setView('verify');
}

async function _handleSendOTPLogin() {
  const email = document.getElementById('inp-email')?.value.trim();
  if (!email || !email.includes('@')) return _showError('Please enter a valid email.');

  pendingEmail = email;
  pendingName  = '';

  _setLoading(true);
  const { error } = await requestOTP(email);
  _setLoading(false);

  if (error) return _showError(error.message);
  setView('verify');
}

async function _handleResend() {
  if (!pendingEmail) return;
  const btn = document.getElementById('btn-resend');
  if (btn) btn.disabled = true;
  await requestOTP(pendingEmail);
  _startResendCountdown();
}

async function _handleSaveCity() {
  if (!_selectedCity || !AppState.user) return;
  const btn = document.getElementById('btn-confirm-city');
  if (btn) btn.disabled = true;

  _setLoading(true);
  const { error } = await saveCity(AppState.user.id, _selectedCity);
  _setLoading(false);

  if (error) { if (btn) btn.disabled = false; return; }

  setState({ user: { ...AppState.user, home_city: _selectedCity } });
  _closeCitySheet();
  navigateTo('swipe');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function _on(id, event, fn) {
  document.getElementById(id)?.addEventListener(event, fn);
}

function _showError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function _setLoading(on) {
  document.getElementById('global-spinner')?.classList.toggle('hidden', !on);
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
