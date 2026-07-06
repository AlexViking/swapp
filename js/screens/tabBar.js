/**
 * Tab bar — 5 tabs, persistent across swipe/matches/addItem/activity/profile.
 * Centre tab (Add) is a green pill with no label.
 * Active tab = green, inactive = muted. Matches/chat/cancel/rate all highlight Matches tab.
 */

import { AppState }     from '../state.js';
import { navigateTo }   from '../router.js';
import { guardAddItem } from '../freeTier.js';

// Screens on which the tab bar is hidden entirely
const HIDDEN_SCREENS = ['auth'];

// Active-screen resolver for each tab
const TABS = [
  {
    screen: 'swipe',
    icon:   'compass',
    label:  'Hunt',
    active: (s) => s === 'swipe',
  },
  {
    screen: 'matches',
    icon:   'arrow-left-right',
    label:  'Matches',
    active: (s) => ['matches', 'chat', 'cancel', 'rate'].includes(s),
  },
  {
    screen: 'addItem',
    icon:   'plus',
    label:  null,   // centre pill — no text label
    active: (s) => s === 'addItem',
  },
  {
    screen: 'activity',
    icon:   'bell',
    label:  'Activity',
    active: (s) => s === 'activity',
  },
  {
    screen: 'profile',
    icon:   'user',
    label:  'Profile',
    active: (s) => ['profile', 'settings'].includes(s),
  },
];

export function renderTabBar() {
  const el = document.getElementById('tab-bar');
  if (!el) return;

  const screen = AppState.currentScreen;

  // Hide on auth and any other non-tab screens
  if (HIDDEN_SCREENS.includes(screen)) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');

  el.innerHTML = `<div class="tab-bar-inner">${TABS.map(tab => _renderTab(tab, screen)).join('')}</div>`;

  // Re-initialise Lucide icons for the freshly rendered markup
  if (window.lucide) window.lucide.createIcons();

  // Bind clicks
  TABS.forEach(tab => {
    el.querySelector(`[data-tab="${tab.screen}"]`)?.addEventListener('click', async () => {
      if (tab.screen === 'addItem') {
        const allowed = await guardAddItem();
        if (!allowed) return;
      }
      navigateTo(tab.screen);
    });
  });
}

function _renderTab(tab, screen) {
  const isActive = tab.active(screen);

  if (tab.screen === 'addItem') {
    return `
      <button class="tab-item tab-item--add" data-tab="addItem" aria-label="Add an item">
        <i data-lucide="plus"></i>
      </button>
    `;
  }

  const activeClass = isActive ? ' tab-item--active' : '';
  const ariaCurrent = isActive ? ' aria-current="page"' : '';

  return `
    <button class="tab-item${activeClass}" data-tab="${tab.screen}"
      aria-label="${tab.label}"${ariaCurrent}>
      <i data-lucide="${tab.icon}"></i>
      <span>${tab.label}</span>
    </button>
  `;
}
