/**
 * Match celebration screen.
 * Shown after a mutual swipe — both users liked each other's item.
 *
 * Renders into #match-overlay (fixed overlay div in the HTML).
 *
 * Shows:
 *  - Full-screen green-soft takeover
 *  - "IT'S A SWAPP!" kicker + "You & [ownerName] both said yes" heading
 *  - Both item photos side by side with arrow-left-right badge between them
 *  - "Say hi to [ownerName]" → chat screen
 *  - "Keep hunting" → close overlay + swipe screen
 */

import { AppState } from '../state.js';
import { navigateTo } from '../router.js';

export function renderMatch() {
  const overlay = document.getElementById('match-overlay');
  if (!overlay) return;

  const matched = AppState.matchedItem;
  const offer   = AppState.myItems?.[AppState.offerIndex];

  if (!matched) {
    navigateTo('swipe');
    return;
  }

  const offerThumb   = _thumb(offer, AppState.offerIndex);
  const matchedThumb = _thumb(matched, 0);
  const ownerName    = _esc(matched.owner || 'them');
  const myTitle      = _esc(offer?.title || 'your item');
  const theirTitle   = _esc(matched.title);

  overlay.innerHTML = `
    <div class="match-overlay-inner">

      <p class="match-kicker">It's a swapp!</p>

      <h1 class="match-headline">You &amp; ${ownerName} both said yes</h1>

      <div class="match-pair">
        <div
          class="match-item-thumb"
          style="background-image:url('${offerThumb}'); transform:rotate(-6deg);"
          aria-label="${myTitle}"
        ></div>

        <div class="match-swap-badge" aria-hidden="true">
          <i data-lucide="arrow-left-right"></i>
        </div>

        <div
          class="match-item-thumb"
          style="background-image:url('${matchedThumb}'); transform:rotate(6deg);"
          aria-label="${theirTitle}"
        ></div>
      </div>

      <p class="match-sub">
        ${myTitle} ⇄ ${ownerName}'s ${theirTitle}. Work out the where &amp; when in chat.
      </p>

      <div class="match-actions">
        <button class="btn btn--primary" id="btn-match-chat" style="width:100%;">
          Say hi to ${ownerName}
        </button>
        <button class="btn btn--ghost" id="btn-match-keep" style="width:100%;">
          Keep hunting
        </button>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();

  document.getElementById('btn-match-chat')?.addEventListener('click', () => {
    overlay.innerHTML = '';
    navigateTo('chat');
  });

  document.getElementById('btn-match-keep')?.addEventListener('click', () => {
    overlay.innerHTML = '';
    navigateTo('swipe');
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _thumb(item, photoIndex) {
  if (!item) return '';
  if (item.photo_urls?.[photoIndex]) return item.photo_urls[photoIndex];
  if (item.seed) return `https://picsum.photos/seed/${item.seed}-${photoIndex}/200/200`;
  return '';
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
