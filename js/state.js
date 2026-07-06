/**
 * Central application state.
 * Call setState(patch) to update — it merges and triggers render().
 */

export const AppState = {
  // auth
  user: null,
  session: null,

  // routing
  currentScreen: 'auth',
  prevScreen: null,

  // swipe deck
  swipeQueue: [],
  offerIndex: 0,
  photoIndex: 0,
  viewerOpen: false,

  // match / swap
  matchedItem: null,
  matchedSwap: null,
  swapConfirmed: false,

  // p2p chat
  activeChatChannel: null,   // Supabase Realtime (signaling only)
  peerConnection: null,      // RTCPeerConnection
  dataChannel: null,         // RTCDataChannel

  // add item form
  addTitle: '',
  addDesc: '',
  addCat: 'Sports',
  addCond: 3,
  addPhotos: [],             // compressed WebP blobs pending upload
  addWants: [],

  // profile data (fetched after login)
  profile: null,
  myItems: null,             // user's own active listings (null = not loaded yet)

  // profile / settings
  swapRadius: 5,
  notifPush: true,
  notifMatch: true,
  notifEmail: false,
  notifLikes: false,

  // cancel / rate
  cancelReason: -1,
  ratingStars: 0,
  ratingTags: [],
  rateContext: 'complete',   // 'complete' | 'cancel'

  // network
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSwipes: [],         // localStorage-backed retry queue
};

/** Render function — set by app.js after boot */
let _render = () => {};
export function setRenderFn(fn) { _render = fn; }

/**
 * Merge patch into AppState and re-render.
 * Accepts object or updater function: setState(s => ({ ... }))
 */
export function setState(patch) {
  const update = typeof patch === 'function' ? patch(AppState) : patch;
  Object.assign(AppState, update);
  _render();
}
