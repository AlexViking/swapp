/**
 * API — all Supabase calls live here.
 * Import supabase client from here, never instantiate it elsewhere.
 */

const SUPABASE_URL      = 'https://cjsugsbqtwsvdsfpdqmy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_J0YhgDgl4Kaj642a6WQcYA_vOY2CmTa';

// Supabase client ��� loaded via ESM CDN in index.html, available as window.__supabaseFactory
export const supabase = window.__supabaseFactory(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth ---

export async function requestOTP(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
}

export async function verifyOTP(email, token) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// --- Profile ---

export async function getProfile(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single();
}

export async function saveCity(userId, city) {
  return supabase.from('profiles').update({ home_city: city }).eq('id', userId);
}

export async function updateProfile(userId, patch) {
  return supabase.from('profiles').update(patch).eq('id', userId);
}

// --- Items ---

export async function insertItem(item) {
  return supabase.from('items').insert(item).select().single();
}

export async function getMyItems(userId) {
  return supabase.from('items').select('*').eq('user_id', userId).eq('status', 'active');
}

export async function deleteItem(itemId) {
  return supabase.from('items').delete().eq('id', itemId);
}

// --- Signed upload URLs ---

export async function getR2UploadUrls(count, userId) {
  return supabase.functions.invoke('get-r2-upload-urls', {
    body: { count, userId },
  });
}

// --- Feed ---

export async function fetchFeed({ city, lat, lng, radiusKm = 15, cursor = 0, limit = 10, userId }) {
  return supabase.functions.invoke('feed', {
    body: { city, lat, lng, radius_km: radiusKm, cursor, limit, user_id: userId },
  });
}

// --- Swipes ---

export async function recordSwipe({ swiperId, targetItemId, targetOwnerId, isLike }) {
  return supabase.functions.invoke('swipe', {
    body: {
      swiper_id:       swiperId,
      target_item_id:  targetItemId,
      target_owner_id: targetOwnerId,
      is_like:         isLike,
    },
  });
}

// --- Swaps ---

export async function getMySwaps(userId) {
  return supabase
    .from('swaps')
    .select('*, item_a:item_a_id(*), item_b:item_b_id(*)')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });
}

export async function updateSwapStatus(swapId, status, cancelReason = null) {
  const patch = { status };
  if (cancelReason) patch.cancel_reason = cancelReason;
  return supabase.from('swaps').update(patch).eq('id', swapId);
}

// --- Ratings ---

export async function submitRating({ swapId, fromUser, toUser, stars, tags, context }) {
  return supabase.from('ratings').insert({ swap_id: swapId, from_user: fromUser, to_user: toUser, stars, tags, context });
}
