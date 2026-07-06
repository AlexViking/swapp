/**
 * Router — manages which screen / panel is visible.
 *
 * Mobile  : one panel at a time, switched via .mobile-visible
 * Desktop : all three panels always visible in the CSS grid.
 *           Each panel has a "default" screen shown when the active
 *           route lives in a different panel, so no panel is ever blank.
 *
 * Desktop panel defaults:
 *   left   → matches (swap list)
 *   center → swipe
 *   right  → chat-placeholder (idle state)
 */

import { AppState, setState } from './state.js';

export const TAB_SCREENS = ['swipe', 'matches', 'addItem', 'activity', 'profile'];

export const PANEL_MAP = {
  auth:     null,
  swipe:    'center-swipe-panel',
  addItem:  'center-swipe-panel',
  match:    'center-swipe-panel',
  matches:  'left-nav-panel',
  activity: 'left-nav-panel',
  profile:  'left-nav-panel',
  settings: 'left-nav-panel',
  chat:     'right-chat-panel',
  cancel:   'right-chat-panel',
  rate:     'right-chat-panel',
};

// Default screen rendered in each panel when it is not the active panel.
// Lazy-imported to avoid circular deps — resolved at call time.
const PANEL_DEFAULTS = {
  'left-nav-panel':    'matches',
  'center-swipe-panel': 'swipe',
  'right-chat-panel':  '__placeholder',  // special: render idle placeholder
};

export function navigateTo(screen) {
  setState({ prevScreen: AppState.currentScreen, currentScreen: screen });

  const authView = document.getElementById('auth-view');
  const mainApp  = document.getElementById('main-app');
  const tabBar   = document.getElementById('tab-bar');

  if (screen === 'auth') {
    // Don't reveal auth-view during boot — splash covers it
    if (!window.__booting) authView.classList.remove('hidden');
    mainApp.classList.add('hidden');
    return;
  }

  authView.classList.add('hidden');
  if (!window.__booting) mainApp.classList.remove('hidden');

  // Tab bar
  tabBar.classList.toggle('hidden', !TAB_SCREENS.includes(screen));

  // Mobile: show only the target panel
  const allPanels = ['left-nav-panel', 'center-swipe-panel', 'right-chat-panel'];
  allPanels.forEach(id => document.getElementById(id)?.classList.remove('mobile-visible'));
  const activePanel = PANEL_MAP[screen];
  if (activePanel) document.getElementById(activePanel)?.classList.add('mobile-visible');

  // Clear idle marker on the panel becoming active so it re-renders fresh next time it's idle
  if (activePanel) {
    const el = document.getElementById(activePanel);
    if (el) delete el.dataset.idleScreen;
  }

  // Desktop: render idle defaults for the two non-active panels
  _renderIdlePanels(screen, activePanel);
}

/**
 * On desktop all panels are always visible.
 * For each panel that is NOT the active one, render its default screen
 * only if it is currently empty (innerHTML blank) or showing a stale screen
 * that belongs to a different route — detected via data-screen attribute.
 */
function _renderIdlePanels(screen, activePanel) {
  if (screen === 'auth') return;
  const isDesktop = window.matchMedia('(min-width: 769px)').matches;
  if (!isDesktop) return;

  const allPanels = ['left-nav-panel', 'center-swipe-panel', 'right-chat-panel'];

  allPanels.forEach(panelId => {
    if (panelId === activePanel) return; // active panel rendered by screen module

    const el = document.getElementById(panelId);
    if (!el) return;

    const defaultScreen = PANEL_DEFAULTS[panelId];
    const currentlyShowing = el.dataset.idleScreen;

    // Already showing the right idle content — skip
    if (currentlyShowing === defaultScreen && el.children.length > 0) return;

    if (defaultScreen === '__placeholder') {
      _renderChatPlaceholder(el);
    } else {
      // Dynamically import the renderer to avoid circular deps
      _renderScreenIntoPanel(defaultScreen, el);
    }

    el.dataset.idleScreen = defaultScreen;
  });
}

async function _renderScreenIntoPanel(screen, panelEl) {
  // Temporarily redirect the panel render to the correct element
  // Each renderer reads getElementById for its panel — we patch the id briefly.
  const map = {
    matches:  { file: './screens/matches.js',  fn: 'renderMatches',  panel: 'left-nav-panel' },
    swipe:    { file: './screens/swipe.js',    fn: 'renderSwipe',    panel: 'center-swipe-panel' },
    activity: { file: './screens/activity.js', fn: 'renderActivity', panel: 'left-nav-panel' },
  };
  const entry = map[screen];
  if (!entry) return;

  const mod = await import(entry.file);
  mod[entry.fn]?.();
}

function _renderChatPlaceholder(el) {
  el.innerHTML = `
    <div class="chat-placeholder">
      <div class="chat-placeholder-icon"><i data-lucide="message-circle"></i></div>
      <p class="chat-placeholder-text">Select a swap to start chatting</p>
    </div>
  `;
  window.__lucide?.();
}

export function goBack() {
  const prev = AppState.prevScreen;
  navigateTo(prev && prev !== 'addItem' ? prev : 'swipe');
}
