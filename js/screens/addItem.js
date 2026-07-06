/**
 * Add item screen.
 *
 * Flow:
 *   1. User picks up to 3 photos → compressed to WebP client-side
 *   2. Fills title, description, category, condition chip, "wants" tags
 *   3. On submit → uploadItemPhotos() → insertItem() → navigateTo('swipe')
 *
 * Photos are previewed as blobs; actual upload happens only on submit.
 * AppState.addPhotos holds compressed Blob objects pending upload.
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { insertItem }         from '../api.js';
import { invalidate }         from '../cache.js';
import { uploadItemPhotos, compressImageToWebP } from '../upload.js';

const CATEGORIES = [
  'Sports', 'Electronics', 'Clothing', 'Books', 'Music',
  'Tools', 'Games', 'Garden', 'Kitchen', 'Other',
];

const WANTS_SUGGESTIONS = [
  'Electronics', 'Sporting gear', 'Books', 'Clothing', 'Tools',
  'Musical instruments', 'Vintage', 'Art', 'Games', 'Kitchen',
];

// Condition chips: label → numeric value stored in AppState.addCond
const COND_CHIPS = [
  { label: 'Like new',   value: 5 },
  { label: 'Good',       value: 4 },
  { label: 'Well-loved', value: 2 },
];

// ── Render ────────────────────────────────────────────────────────────────────

export function renderAddItem() {
  const panel = document.getElementById('center-swipe-panel');
  if (!panel) return;

  panel.innerHTML = _html();
  _bindDOM();

  if (window.lucide) window.lucide.createIcons();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html() {
  const { addCat, addCond, addPhotos, addWants } = AppState;
  const titleVal = AppState.addTitle ?? '';
  const descVal  = AppState.addDesc ?? '';
  const wants    = addWants ?? [];

  return `
    <div class="add-screen">

      <!-- Header -->
      <div class="add-header">
        <button class="add-close-btn" id="btn-add-back" aria-label="Cancel">
          <i data-lucide="x"></i>
        </button>
        <h2 class="add-header-title">Add a treasure</h2>
        <button class="add-save-btn" id="btn-add-save" ${!titleVal.trim() ? 'disabled' : ''}>Save</button>
      </div>

      <!-- Scrollable form -->
      <div class="add-scroll">

        <!-- Photo row -->
        <div class="add-field">
          <div class="add-photos-row" id="add-photos-row">
            ${_photoSlots(addPhotos)}
          </div>
          <span class="add-photo-hint">First photo = cover. Honest angles win swaps.</span>
        </div>

        <!-- Title -->
        <div class="add-field">
          <label class="add-section-label" for="add-title">Title</label>
          <input
            class="input add-input"
            id="add-title"
            type="text"
            placeholder="e.g. Pentax K1000 film camera"
            maxlength="60"
            value="${_esc(titleVal)}"
          />
        </div>

        <!-- Description -->
        <div class="add-field">
          <label class="add-section-label" for="add-desc">Its story</label>
          <textarea
            class="input add-textarea"
            id="add-desc"
            placeholder="What has it seen? Why is it moving on?"
            rows="3"
            maxlength="300"
          >${_esc(descVal)}</textarea>
        </div>

        <!-- Category -->
        <div class="add-field">
          <span class="add-section-label">Category</span>
          <div class="add-chips-row" id="add-cats">
            ${CATEGORIES.map(cat => `
              <button class="add-chip ${cat === addCat ? 'add-chip--active' : ''}"
                data-cat="${_esc(cat)}">${_esc(cat)}</button>
            `).join('')}
          </div>
        </div>

        <!-- Condition -->
        <div class="add-field">
          <span class="add-section-label">Condition</span>
          <div class="add-chips-row" id="add-cond-chips">
            ${COND_CHIPS.map(c => `
              <button class="add-chip ${addCond === c.value ? 'add-chip--active' : ''}"
                data-cond="${c.value}">${_esc(c.label)}</button>
            `).join('')}
          </div>
        </div>

        <!-- Wants -->
        <div class="add-field">
          <span class="add-section-label">What do you want for it?</span>
          <div class="add-chips-row" id="add-wants">
            ${wants.map(tag => `
              <button class="add-chip add-chip--active" data-want="${_esc(tag)}">
                ${_esc(tag)}<span class="add-want-remove" aria-hidden="true"> ✕</span>
              </button>
            `).join('')}
            ${WANTS_SUGGESTIONS.filter(s => !wants.includes(s)).map(tag => `
              <button class="add-chip" data-want="${_esc(tag)}">${_esc(tag)}</button>
            `).join('')}
            <button class="add-chip add-chip--dashed" id="btn-add-want">
              <i data-lucide="plus"></i> add a want
            </button>
          </div>
          <div id="want-input-row" class="want-input-row" style="display:none;">
            <input class="input" id="want-custom-input" placeholder="e.g. Vintage camera" maxlength="40" />
            <button class="add-chip add-chip--active" id="btn-want-confirm">Add</button>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="add-footer">
        <button class="btn add-submit-btn" id="btn-add-submit" ${!titleVal.trim() ? 'disabled' : ''}>
          Put it on the table
        </button>
      </div>

    </div>
  `;
}

function _photoSlots(photos) {
  const slots = [];

  // Slot 0: primary — upload trigger if empty, preview if filled
  if (photos[0]) {
    slots.push(_photoPreview(photos[0], 0, /* isPrimary */ true));
  } else {
    slots.push(`
      <label class="add-photo-slot add-photo-trigger" for="photo-input" aria-label="Add photo">
        <i data-lucide="camera"></i>
        <span>Add photo</span>
        <input type="file" id="photo-input" accept="image/*" multiple hidden>
      </label>
    `);
  }

  // Slots 1–2: ghost or preview
  for (let i = 1; i <= 2; i++) {
    if (photos[i]) {
      slots.push(_photoPreview(photos[i], i, false));
    } else if (photos[0]) {
      // Only show ghost slots once the first photo is set
      slots.push(`
        <label class="add-photo-slot add-photo-trigger add-photo-ghost"
          for="photo-input" aria-label="Add photo">
          <i data-lucide="camera"></i>
        </label>
      `);
    }
  }

  // Hidden file input if all 3 slots have photos but we still need the input
  if (photos.length === 3) {
    slots.push(`<input type="file" id="photo-input" accept="image/*" multiple hidden>`);
  }

  return slots.join('');
}

function _photoPreview(blob, index, isPrimary) {
  const url = URL.createObjectURL(blob);
  return `
    <div class="add-photo-slot">
      <div class="add-photo-preview" style="background-image:url('${url}');"></div>
      <button class="add-photo-remove" data-photo-index="${index}" aria-label="Remove photo">
        <i data-lucide="x"></i>
      </button>
    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

function _bindDOM() {
  const panel = document.getElementById('center-swipe-panel');
  if (!panel) return;

  // Photo file input
  const photoInput = document.getElementById('photo-input');
  if (photoInput) {
    photoInput.addEventListener('change', _onPhotoChange);
  }

  // Title → gate submit buttons
  const titleInput = document.getElementById('add-title');
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      AppState.addTitle = titleInput.value;
      _refreshSubmit();
    });
  }

  // Desc
  const descInput = document.getElementById('add-desc');
  if (descInput) {
    descInput.addEventListener('input', () => {
      AppState.addDesc = descInput.value;
    });
  }

  panel.addEventListener('click', (e) => {
    // Category chips
    const catBtn = e.target.closest('[data-cat]');
    if (catBtn) {
      AppState.addCat = catBtn.dataset.cat;
      _refreshChips('add-cats', '[data-cat]', 'addCat', 'cat');
      return;
    }

    // Condition chips
    const condBtn = e.target.closest('[data-cond]');
    if (condBtn) {
      AppState.addCond = parseInt(condBtn.dataset.cond, 10);
      document.querySelectorAll('#add-cond-chips [data-cond]').forEach(btn => {
        btn.classList.toggle('add-chip--active', btn.dataset.cond === condBtn.dataset.cond);
      });
      return;
    }

    // Want chips (toggle)
    const wantBtn = e.target.closest('[data-want]');
    if (wantBtn) {
      const tag     = wantBtn.dataset.want;
      const current = AppState.addWants ?? [];
      const next    = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      AppState.addWants = next;
      renderAddItem();
      return;
    }

    // Remove photo
    const removeBtn = e.target.closest('[data-photo-index]');
    if (removeBtn) {
      const idx  = parseInt(removeBtn.dataset.photoIndex, 10);
      const next = AppState.addPhotos.filter((_, i) => i !== idx);
      setState({ addPhotos: next });
      renderAddItem();
      return;
    }

    const id = e.target.closest('[id]')?.id;
    switch (id) {
      case 'btn-add-back':    _cancel(); break;
      case 'btn-add-save':    _submit(); break;
      case 'btn-add-submit':  _submit(); break;
      case 'btn-add-want':    _showWantInput(); break;
      case 'btn-want-confirm': _confirmWant(); break;
    }
  });

  // Custom want input — confirm on Enter
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'want-custom-input') {
      e.preventDefault();
      _confirmWant();
    }
  });
}

// ── Photo handling ────────────────────────────────────────────────────────────

async function _onPhotoChange(e) {
  const files   = Array.from(e.target.files ?? []);
  const current = AppState.addPhotos;
  const slots   = 3 - current.length;
  if (!files.length || !slots) return;

  const blobs = await Promise.all(
    files.slice(0, slots).map(f => compressImageToWebP(f))
  );
  setState({ addPhotos: [...current, ...blobs] });
  renderAddItem();
}

// ── Want input ────────────────────────────────────────────────────────────────

function _showWantInput() {
  const row = document.getElementById('want-input-row');
  if (row) {
    row.style.display = 'flex';
    const inp = document.getElementById('want-custom-input');
    if (inp) inp.focus();
  }
}

function _confirmWant() {
  const inp  = document.getElementById('want-custom-input');
  const tag  = inp?.value.trim();
  if (!tag) return;

  const current = AppState.addWants ?? [];
  if (!current.includes(tag)) {
    AppState.addWants = [...current, tag];
  }
  renderAddItem();
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function _submit() {
  const title = document.getElementById('add-title')?.value.trim();
  if (!title) return;

  const submitBtn = document.getElementById('btn-add-submit');
  const saveBtn   = document.getElementById('btn-add-save');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Listing…'; }
  if (saveBtn)   { saveBtn.disabled = true; }

  try {
    const photoUrls = AppState.addPhotos.length
      ? await uploadItemPhotos(AppState.addPhotos)
      : [];

    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();

    const { error } = await insertItem({
      user_id:         AppState.user.id,
      title,
      description:     document.getElementById('add-desc')?.value.trim() || null,
      category:        AppState.addCat,
      condition:       AppState.addCond,
      wants_in_return: AppState.addWants ?? [],
      images:          photoUrls.length
        ? photoUrls
        : ['https://pub-03cf5bcc3a6d4c82989b4b33c30a5d5e.r2.dev/placeholder.webp'],
      location_city:   AppState.user?.home_city ?? '',
      expires_at:      expiresAt,
    });

    if (error) throw error;

    // Reset form state; clear cached myItems so swipe screen reloads them
    invalidate('myItems'); // new item added
    setState({
      addPhotos: [],
      addCat:    'Sports',
      addCond:   4,
      addWants:  [],
      addTitle:  '',
      addDesc:   '',
      myItems:   null,
    });
    navigateTo('swipe');

  } catch (err) {
    console.error('insertItem failed', err);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Put it on the table'; }
    if (saveBtn)   { saveBtn.disabled = false; }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _cancel() {
  setState({ addPhotos: [], addTitle: '', addDesc: '' });
  navigateTo('swipe');
}

function _refreshSubmit() {
  const title     = document.getElementById('add-title')?.value.trim();
  const submitBtn = document.getElementById('btn-add-submit');
  const saveBtn   = document.getElementById('btn-add-save');
  if (submitBtn) submitBtn.disabled = !title;
  if (saveBtn)   saveBtn.disabled   = !title;
}

function _refreshChips(containerId, selector, stateKey, dataAttr) {
  const active = AppState[stateKey];
  document.querySelectorAll(`#${containerId} ${selector}`).forEach(btn => {
    btn.classList.toggle('add-chip--active', btn.dataset[dataAttr] === active);
  });
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
