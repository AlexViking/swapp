/**
 * app.js — Entry point.
 * Boots Supabase auth listener, wires state → render, starts app.
 */

import { AppState, setState, setRenderFn } from './state.js';
import { navigateTo, PANEL_MAP }           from './router.js';
import { supabase }                        from './api.js';
import { initResilience }                  from './resilience.js';
import { initPush, teardownPush }          from './push.js';

// Screen render functions (stubbed — filled in per task)
import { renderAuth, showCityModal } from './screens/auth.js';
import { renderSwipe }    from './screens/swipe.js';
import { renderAddItem }  from './screens/addItem.js';
import { renderMatch }    from './screens/match.js';
import { renderChat }     from './screens/chat.js';
import { renderMatches }  from './screens/matches.js';
import { renderActivity } from './screens/activity.js';
import { renderProfile }  from './screens/profile.js';
import { renderSettings } from './screens/settings.js';
import { renderCancel }   from './screens/cancel.js';
import { renderRate }     from './screens/rate.js';
import { renderTabBar }   from './screens/tabBar.js';

const SCREEN_RENDERERS = {
  auth:     renderAuth,
  swipe:    renderSwipe,
  addItem:  renderAddItem,
  match:    renderMatch,
  chat:     renderChat,
  matches:  renderMatches,
  activity: renderActivity,
  profile:  renderProfile,
  settings: renderSettings,
  cancel:   renderCancel,
  rate:     renderRate,
};

/** Main render — called by setState on every state change */
function render() {
  const screen = AppState.currentScreen;
  console.log('[render]', screen);

  // Always render the active screen
  const fn = SCREEN_RENDERERS[screen];
  if (fn) fn();

  renderTabBar();

  // On desktop: ensure idle panels have default content
  _renderIdlePanels(screen);

  // Replace Lucide icon placeholders after every render
  window.__lucide?.();
}

/** Render default content into panels not owned by the current screen. */
function _renderIdlePanels(screen) {
  if (typeof window === 'undefined') return;
  if (screen === 'auth') return;  // auth has no panels — nothing to fill
  if (!window.matchMedia('(min-width: 769px)').matches) return;

  const activePanel = PANEL_MAP[screen];

  // Left panel idle default: matches list
  if (activePanel !== 'left-nav-panel') {
    const leftEl = document.getElementById('left-nav-panel');
    if (leftEl && !leftEl.dataset.idleScreen) {
      renderMatches();
      leftEl.dataset.idleScreen = 'matches';
    }
  }

  // Right panel idle default: placeholder
  if (activePanel !== 'right-chat-panel') {
    const rightEl = document.getElementById('right-chat-panel');
    if (rightEl && !rightEl.dataset.idleScreen) {
      rightEl.innerHTML = `
        <div class="chat-placeholder">
          <div class="chat-placeholder-icon">💬</div>
          <p class="chat-placeholder-text">Select a swap to start chatting</p>
        </div>
      `;
      rightEl.dataset.idleScreen = '__placeholder';
    }
  }
}

// Register render with state module
setRenderFn(render);

// --- Boot ---

function _hideSplash() {
  window.__booting = false;
  const splash = document.getElementById('boot-splash');
  if (splash) splash.classList.add('hidden');

  // Now reveal whichever panel boot decided on
  const screen = AppState.currentScreen;
  const authView = document.getElementById('auth-view');
  const mainApp  = document.getElementById('main-app');
  if (screen === 'auth') {
    authView?.classList.remove('hidden');
    mainApp?.classList.add('hidden');
  } else {
    authView?.classList.add('hidden');
    mainApp?.classList.remove('hidden');
  }
}

window.__booting = true;

async function boot() {
  console.log('[boot] starting');
  initResilience();

  // Restore existing session on page load
  const { data: { session } } = await supabase.auth.getSession();
  console.log('[boot] getSession →', session ? `user ${session.user.email}` : 'no session');

  if (session) {
    setState({ session, user: session.user });
    initPush();
    await checkUserProfileLocation(session.user.id);
  } else {
    navigateTo('auth');
  }

  // Reveal app — session resolved, no more flash
  _hideSplash();

  // Keep session in sync (tab switching, token refresh, magic link callback, etc.)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[auth]', event, session?.user?.email ?? 'signed out');

    // INITIAL_SESSION is handled by getSession() above — skip to avoid double render
    if (event === 'INITIAL_SESSION') return;

    if (session) {
      // Preserve enriched fields (e.g. home_city) set after login
      setState({ session, user: { ...AppState.user, ...session.user } });
      initPush();

      // Magic link landing: save pending name then route normally
      if (event === 'SIGNED_IN') {
        const pendingName = sessionStorage.getItem('swapp_pending_name');
        if (pendingName) {
          console.log('[auth] saving pending name:', pendingName);
          sessionStorage.removeItem('swapp_pending_name');
          await supabase.from('profiles').update({ name: pendingName }).eq('id', session.user.id);
        }
        await checkUserProfileLocation(session.user.id);
      }
    } else {
      await teardownPush();
      setState({ session: null, user: null, profile: null, myItems: null, swipeQueue: [] });
      navigateTo('auth');
    }
  });
}

/** After login: check if user has set their city. */
async function checkUserProfileLocation(userId) {
  console.log('[location] checking home_city for', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('home_city')
    .eq('id', userId)
    .single();

  if (error || !data?.home_city) {
    console.log('[location] no city found → show city modal');
    navigateTo('auth');
    showCityModal();
  } else {
    console.log('[location] city:', data.home_city, '→ navigating to swipe');
    setState({ user: { ...AppState.user, home_city: data.home_city } });
    navigateTo('swipe');
  }
}

// Expose for auth screen to call after successful OTP verify
window.__checkUserProfileLocation = checkUserProfileLocation;

boot();
