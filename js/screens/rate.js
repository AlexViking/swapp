/**
 * Rating screen.
 *
 * Shown after:
 *   - Swap marked complete → rateContext = 'complete'
 *   - Swap cancelled       → rateContext = 'cancel'
 *
 * User picks 1–5 stars, optional tags, optional note, then submits.
 * On submit → submitRating() → navigateTo('matches')
 * On skip   → navigateTo('matches')
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { submitRating }       from '../api.js';

const TAGS_COMPLETE = [
  'on time',
  'friendly',
  'item as described',
  'would swap again',
];

const TAGS_CANCEL = [
  'unresponsive',
  'item not as described',
  'no-show',
  'changed mind last minute',
];

// ── Render ────────────────────────────────────────────────────────────────────

export function renderRate() {
  const panel = document.getElementById('right-chat-panel');
  if (!panel) return;

  const swap    = AppState.matchedSwap;
  const matched = AppState.matchedItem;
  if (!swap || !matched) { navigateTo('matches'); return; }

  panel.innerHTML = _html(matched);
  _bindDOM(swap, matched);

  if (window.lucide) lucide.createIcons();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html(matched) {
  const ctx         = AppState.rateContext;
  const stars       = AppState.ratingStars;
  const tags        = AppState.ratingTags;
  const tagList     = ctx === 'complete' ? TAGS_COMPLETE : TAGS_CANCEL;
  const ownerName   = _esc(matched.owner || 'them');
  const thumb       = _thumb(matched, 0);
  const initials    = _initials(matched.owner || 'SW');
  const kicker      = ctx === 'complete' ? 'Swap complete' : 'Swap ended';

  return `
    <div class="rate-screen">

      <p class="rate-kicker">${_esc(kicker)}</p>

      <h2 class="rate-headline">How was trading with ${ownerName}?</h2>

      <div class="rate-avatar" aria-label="${ownerName}">
        ${thumb
          ? `<img src="${thumb}" alt="${ownerName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : `<span class="rate-avatar-initials">${_esc(initials)}</span>`
        }
      </div>

      <div class="rate-stars" id="rate-stars" role="group" aria-label="Star rating">
        ${[1,2,3,4,5].map(n => `
          <button
            class="star-btn${n <= stars ? ' active' : ''}"
            data-star="${n}"
            aria-label="${n} star${n > 1 ? 's' : ''}"
          >
            <i data-lucide="${n <= stars ? 'star' : 'star'}"></i>
          </button>
        `).join('')}
      </div>

      ${stars > 0 ? `
        <div class="rate-tags" id="rate-tags">
          ${tagList.map(tag => `
            <button
              class="chip${tags.includes(tag) ? ' active' : ''}"
              data-tag="${_esc(tag)}"
            >${_esc(tag)}</button>
          `).join('')}
        </div>

        <div class="rate-note">
          <textarea
            class="input"
            id="rate-note-text"
            rows="3"
            placeholder="Leave a note for the next swapper (optional)"
          ></textarea>
        </div>
      ` : ''}

      <button
        class="btn btn--primary"
        id="btn-rate-submit"
        style="width:100%;max-width:400px;"
        ${stars === 0 ? 'disabled' : ''}
      >
        Send rating
      </button>

      <button class="rate-skip" id="btn-rate-skip">
        Skip for now
      </button>

    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

function _bindDOM(swap, matched) {
  const panel = document.getElementById('right-chat-panel');
  if (!panel) return;

  panel.addEventListener('click', (e) => {
    const starBtn = e.target.closest('[data-star]');
    if (starBtn) {
      const n = parseInt(starBtn.dataset.star, 10);
      setState({ ratingStars: n, ratingTags: [] });
      renderRate();
      return;
    }

    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      const tag = tagBtn.dataset.tag;
      const current = AppState.ratingTags;
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      setState({ ratingTags: next });
      _refreshTags(next);
      return;
    }

    const id = e.target.closest('[id]')?.id;
    switch (id) {
      case 'btn-rate-submit': _submit(swap, matched); break;
      case 'btn-rate-skip':   _skip(); break;
    }
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function _submit(swap, matched) {
  const stars = AppState.ratingStars;
  if (stars === 0) return;

  const myId   = AppState.user?.id;
  const toUser = matched.user_id ?? matched.owner_id;
  const note   = document.getElementById('rate-note-text')?.value.trim() || '';

  const { error } = await submitRating({
    swapId:   swap.id,
    fromUser: myId,
    toUser,
    stars,
    tags:     AppState.ratingTags,
    note,
    context:  AppState.rateContext,
  });

  if (error) { console.error('submitRating', error); }

  _reset();
  navigateTo('matches');
}

function _skip() {
  _reset();
  navigateTo('matches');
}

function _reset() {
  setState({ ratingStars: 0, ratingTags: [], cancelReason: -1 });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _refreshTags(activeTags) {
  document.querySelectorAll('.chip[data-tag]').forEach(btn => {
    btn.classList.toggle('active', activeTags.includes(btn.dataset.tag));
  });
}

function _thumb(item, photoIndex) {
  if (!item) return '';
  if (item.photo_urls?.[photoIndex]) return item.photo_urls[photoIndex];
  if (item.seed) return `https://picsum.photos/seed/${item.seed}-${photoIndex}/200/200`;
  return '';
}

function _initials(name) {
  return String(name)
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
