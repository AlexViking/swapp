/**
 * Canvas swipe card renderer.
 * Renders the card stack (top card + 2 peek cards behind it) at 60fps during
 * drag; single static draw when idle. Everything visual about the card lives
 * here. DOM controls (buttons, offer strip, dots) are layered on top in HTML.
 *
 * API:
 *   initCardStack(canvas, getDeck, getPhotoIndex)
 *   drawFrame(dx, dy)   — call inside rAF during drag
 *   drawIdle()          — call once on deck change / photo change
 *   stampOpacity(dx)    — returns { like, pass } opacities (0–1)
 */

const CARD_RADIUS  = 26;
const STAMP_ROTATE = 14;  // degrees
const DRAG_SCALE   = 0.05; // rotation per pixel of dx
const THRESHOLD    = 120;  // px — commit swipe past this

let _canvas   = null;
let _ctx      = null;
let _getDeck  = null;
let _getPhotoIndex = null;

// Image cache: seed+index → HTMLImageElement
const _imgCache = new Map();

// ── Public API ────────────────────────────────────────────────────────────────

export function initCardStack(canvas, getDeck, getPhotoIndex) {
  _canvas        = canvas;
  _ctx           = canvas.getContext('2d');
  _getDeck       = getDeck;
  _getPhotoIndex = getPhotoIndex;
  _resize();
  window.addEventListener('resize', _resize);
}

/** Draw one frame during an active drag. dx/dy = pointer delta from start. */
export function drawFrame(dx = 0, dy = 0) {
  if (!_ctx) return;
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  const deck  = _getDeck();
  const pidx  = _getPhotoIndex();

  _drawPeek(deck, 1, 0.02, 10);  // second card
  _drawPeek(deck, 2, 0.05, 20);  // third card

  if (deck[0]) _drawTopCard(deck[0], pidx, dx, dy);
}

/** Draw the idle state (no drag). Used after deck advance or photo change. */
export function drawIdle() {
  drawFrame(0, 0);
}

/**
 * Returns LIKE and PASS stamp opacities based on drag distance.
 * Used by swipe.js to update the DOM stamps.
 */
export function stampOpacity(dx) {
  const t = Math.min(Math.abs(dx) / THRESHOLD, 1);
  return {
    like: dx > 0 ? t : 0,
    pass: dx < 0 ? t : 0,
  };
}

export { THRESHOLD };

// ── Private helpers ───────────────────────────────────────────────────────────

function _resize() {
  if (!_canvas) return;
  const rect = _canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  _canvas.width  = rect.width  * dpr;
  _canvas.height = rect.height * dpr;
  _ctx.scale(dpr, dpr);
  drawIdle();
}

function _drawPeek(deck, offset, scaleOffset, translateY) {
  const item = deck[offset];
  if (!item) return;
  const { w, h } = _dims();
  const scale = 1 - scaleOffset;

  _ctx.save();
  _ctx.translate(w / 2, h / 2);
  _ctx.scale(scale, scale);
  _ctx.translate(-w / 2, -h / 2 + translateY);

  _roundRect(0, 0, w, h, CARD_RADIUS);
  _ctx.fillStyle = offset === 1 ? '#dde9e6' : '#e4ece9';
  _ctx.fill();

  _ctx.restore();
}

function _drawTopCard(item, photoIndex, dx, dy) {
  const { w, h } = _dims();
  const angle    = dx * DRAG_SCALE * (Math.PI / 180);

  _ctx.save();
  _ctx.translate(w / 2, h / 2);
  _ctx.rotate(angle);
  _ctx.translate(-w / 2, -h / 2);
  _ctx.translate(dx, dy * 0.35);

  // Card shadow + clip
  _ctx.shadowColor   = 'rgba(15,60,55,0.35)';
  _ctx.shadowBlur    = 40;
  _ctx.shadowOffsetY = 16;

  _roundRect(0, 0, w, h, CARD_RADIUS);
  _ctx.clip();

  _ctx.shadowColor = 'transparent';

  // Photo background
  const img = _getImage(item, photoIndex);
  if (img && img.complete && img.naturalWidth) {
    _ctx.drawImage(img, 0, 0, w, h);
  } else {
    // Placeholder while image loads
    _ctx.fillStyle = '#d8ebe8';
    _ctx.fillRect(0, 0, w, h);
    // Retry draw when image loads
    if (img && !img._listenerAdded) {
      img._listenerAdded = true;
      img.addEventListener('load', () => drawIdle(), { once: true });
    }
  }

  // Bottom gradient overlay
  const grad = _ctx.createLinearGradient(0, h * 0.38, 0, h);
  grad.addColorStop(0, 'rgba(8,40,36,0)');
  grad.addColorStop(0.4, 'rgba(8,40,36,0.55)');
  grad.addColorStop(1,   'rgba(8,40,36,0.94)');
  _ctx.fillStyle = grad;
  _ctx.fillRect(0, 0, w, h);

  // Text overlays
  _drawCardText(item, w, h);

  // SWAP stamp
  const likeOp = Math.min(Math.max(dx / THRESHOLD, 0), 1);
  if (likeOp > 0) _drawStamp('SWAP ✓', '#0f857c', w * 0.08, h * 0.22, -STAMP_ROTATE, likeOp);

  // PASS stamp
  const passOp = Math.min(Math.max(-dx / THRESHOLD, 0), 1);
  if (passOp > 0) _drawStamp('PASS', '#c66a4a', w * 0.55, h * 0.22, STAMP_ROTATE, passOp);

  _ctx.restore();
}

function _drawCardText(item, w, h) {
  const pad = 18;
  const y0  = h - 20;

  // Wants chips row
  _ctx.font = '600 11px Hanken Grotesk, sans-serif';
  _ctx.fillStyle = 'rgba(255,255,255,0.7)';
  _ctx.fillText('Wants:', pad, y0 - 64);

  let chipX = pad + 46;
  (item.wants || []).slice(0, 3).forEach(w_ => {
    const tw = _ctx.measureText(w_).width;
    _chipRect(chipX, y0 - 75, tw + 18, 20, 6, 'rgba(255,255,255,0.18)');
    _ctx.fillStyle = '#fff';
    _ctx.font = '600 11px Hanken Grotesk, sans-serif';
    _ctx.fillText(w_, chipX + 9, y0 - 64);
    chipX += tw + 26;
  });

  // Title
  _ctx.font      = '700 26px Bricolage Grotesque, sans-serif';
  _ctx.fillStyle = '#fff';
  _wrapText(item.title, pad, y0 - 38, w - pad * 2, 30);

  // Meta chips: category, distance, condition
  const meta = [item.cat, `📍 ${item.dist}`, item.cond].filter(Boolean);
  let mx = pad;
  _ctx.font = '600 11px Hanken Grotesk, sans-serif';
  meta.forEach(m => {
    const tw = _ctx.measureText(m).width;
    _chipRect(mx, y0 - 128, tw + 18, 22, 7, 'rgba(255,255,255,0.2)');
    _ctx.fillStyle = '#fff';
    _ctx.fillText(m, mx + 9, y0 - 115);
    mx += tw + 26;
  });
}

function _drawStamp(text, color, x, y, rotateDeg, opacity) {
  _ctx.save();
  _ctx.globalAlpha = opacity;
  _ctx.translate(x + 60, y + 20);
  _ctx.rotate(rotateDeg * Math.PI / 180);
  _ctx.translate(-60, -20);

  // Border + background
  _ctx.strokeStyle = color;
  _ctx.lineWidth   = 3;
  _ctx.fillStyle   = 'rgba(255,255,255,0.85)';
  _roundRect(x, y, 120, 40, 10);
  _ctx.fill();
  _ctx.stroke();

  // Text
  _ctx.fillStyle  = color;
  _ctx.font       = '800 22px Bricolage Grotesque, sans-serif';
  _ctx.textAlign  = 'center';
  _ctx.textBaseline = 'middle';
  _ctx.fillText(text, x + 60, y + 20);
  _ctx.textAlign    = 'left';
  _ctx.textBaseline = 'alphabetic';

  _ctx.restore();
}

function _getImage(item, photoIndex) {
  const id   = item.id ?? item.seed ?? 'unknown';
  const key  = `${id}-${photoIndex}`;
  const key0 = `${id}-0`;

  if (!_imgCache.has(key)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = item.photo_urls?.[photoIndex]
      ?? `https://picsum.photos/seed/${id}-${photoIndex}/600/800`;
    _imgCache.set(key, img);
  }
  // Also preload the first photo of next cards
  if (!_imgCache.has(key0)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = item.photo_urls?.[0]
      ?? `https://picsum.photos/seed/${id}-0/600/800`;
    _imgCache.set(key0, img);
  }

  return _imgCache.get(key);
}

// ── Canvas primitives ─────────────────────────────────────────────────────────

function _dims() {
  const dpr = window.devicePixelRatio || 1;
  return {
    w: _canvas.width  / dpr,
    h: _canvas.height / dpr,
  };
}

function _roundRect(x, y, w, h, r) {
  _ctx.beginPath();
  _ctx.moveTo(x + r, y);
  _ctx.lineTo(x + w - r, y);
  _ctx.arcTo(x + w, y,     x + w, y + r,     r);
  _ctx.lineTo(x + w, y + h - r);
  _ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  _ctx.lineTo(x + r, y + h);
  _ctx.arcTo(x,     y + h, x,     y + h - r, r);
  _ctx.lineTo(x, y + r);
  _ctx.arcTo(x,     y,     x + r, y,         r);
  _ctx.closePath();
}

function _chipRect(x, y, w, h, r, fill) {
  _ctx.beginPath();
  _roundRect(x, y, w, h, r);
  _ctx.fillStyle = fill;
  _ctx.fill();
}

function _wrapText(text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line  = '';
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (_ctx.measureText(test).width > maxW && line) {
      _ctx.fillText(line, x, lineY);
      line  = word;
      lineY -= lineH;
    } else {
      line = test;
    }
  }
  if (line) _ctx.fillText(line, x, lineY);
}
