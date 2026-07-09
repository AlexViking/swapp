import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { MapPin, X, Heart, Plus, Camera } from 'lucide-react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { TabBar } from '../components/TabBar'
import { DesktopNav } from '../components/DesktopNav'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { fetchFeed, recordSwipe, getMyItems, getProfile } from '../lib/api'
import logoUrl from '../assets/swapp-logo-lockup.png'

const CONDITION_LABELS: Record<number, string> = {
  1: 'Well-loved',
  2: 'Well-loved',
  3: 'Good',
  4: 'Good',
  5: 'Like new',
}

function conditionLabel(c: number) {
  return CONDITION_LABELS[c] ?? 'Good'
}

type Item = {
  id: string
  title: string
  description?: string
  condition: number
  images: string[]
  location_city: string
  wants_in_return: string[]
  user_id: string
  ownerName?: string
  ownerRating?: number | null
}

function OfferThumb({ item, selected, onClick }: { item: Item; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={item.title}
      style={{
        flexShrink: 0,
        width: 64,
        height: 64,
        borderRadius: 'var(--radius-card-sm)',
        overflow: 'hidden',
        border: selected ? '2.5px solid var(--swapp-green)' : '2.5px solid transparent',
        cursor: 'pointer',
        position: 'relative',
        background: 'var(--parchment-deep)',
        padding: 0,
      }}
    >
      {item.images?.[0]
        ? <img src={item.images[0]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', background: 'var(--parchment-deep)' }} />
      }
      {selected && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--swapp-green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
        </div>
      )}
    </button>
  )
}

function AddThumb({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 64,
        height: 64,
        borderRadius: 'var(--radius-card-sm)',
        background: 'var(--parchment-deep)',
        border: '1.5px dashed var(--ink-faint)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-soft)',
      }}
    >
      <Plus size={22} />
    </button>
  )
}

// Isolated card component — owns its own motion values so parent never re-renders during drag
function SwipeCard({ item, onLike, onPass }: {
  item: Item
  onLike: () => void
  onPass: () => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15])
  const likeOpacity = useTransform(x, [20, 100], [0, 1])
  const nopeOpacity = useTransform(x, [-100, -20], [1, 0])

  const fly = (dir: 1 | -1, cb: () => void) => {
    animate(x, dir * 800, {
      type: 'spring',
      stiffness: 400,
      damping: 40,
      velocity: dir * 800,
    }).then(cb)
  }

  return (
    <motion.div
      key={item.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      dragMomentum={false}
      style={{
        x, rotate,
        position: 'absolute', inset: 0,
        background: 'var(--surface-card)',
        borderRadius: 20,
        zIndex: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-float)',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        willChange: 'transform',
      }}
      onDragEnd={(_, info) => {
        const { offset, velocity } = info
        // Fly off on distance OR velocity (fast flick)
        if (offset.x > 80 || velocity.x > 500) {
          fly(1, onLike)
        } else if (offset.x < -80 || velocity.x < -500) {
          fly(-1, onPass)
        } else {
          // Snap back with spring — feels natural
          animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 })
        }
      }}
    >
      {/* Photo — 60% of card */}
      <div style={{
        height: '60%', flexShrink: 0, position: 'relative',
        background: 'var(--terracotta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.images?.[0]
          ? <img src={item.images[0]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : <Camera size={56} color="rgba(251,248,238,0.8)" />
        }
        {/* LIKE overlay */}
        <motion.div style={{
          opacity: likeOpacity, position: 'absolute', top: 16, left: 16,
          border: '3px solid #22c55e', borderRadius: 8, padding: '4px 12px',
          pointerEvents: 'none', transform: 'rotate(-15deg)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#22c55e', textTransform: 'uppercase' }}>LIKE</span>
        </motion.div>
        {/* NOPE overlay */}
        <motion.div style={{
          opacity: nopeOpacity, position: 'absolute', top: 16, right: 16,
          border: '3px solid #ef4444', borderRadius: 8, padding: '4px 12px',
          pointerEvents: 'none', transform: 'rotate(15deg)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#ef4444', textTransform: 'uppercase' }}>NOPE</span>
        </motion.div>
        {/* Badges */}
        <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
          <span style={{ background: 'var(--brass)', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
            {conditionLabel(item.condition)} condition
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
          <span style={{ background: 'var(--terracotta)', color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
            3 eyeing this
          </span>
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--ink)', margin: 0 }}>
          {item.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 14, fontFamily: 'var(--font-body)' }}>
          <MapPin size={13} color="var(--swapp-green)" />
          {item.location_city ?? 'Nearby'} · {item.ownerName ?? 'Swapper'}
          {item.ownerRating ? ` · ★ ${item.ownerRating}` : ''}
        </div>
        {item.wants_in_return?.length > 0 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Wants: {item.wants_in_return.slice(0, 3).join(', ')}…
          </p>
        )}
      </div>
    </motion.div>
  )
}

function LocationChip({ city }: { city: string }) {
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: 'var(--parchment-deep)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 14,
        color: 'var(--ink)',
      }}
    >
      <MapPin size={14} color="var(--swapp-green)" />
      {city} · 5 km
    </button>
  )
}

export function Swipe() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id

  const [cards, setCards] = useState<Item[]>([])
  const [myItems, setMyItems] = useState<Item[]>([])
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('Nearby')
  const [cursor, setCursor] = useState(0)
  const [noOfferError, setNoOfferError] = useState(false)

  // Drag-to-swipe
  const constraintsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId) return
    loadData()
  }, [userId])

  async function loadData() {
    if (!userId) return
    setLoading(true)
    try {
      const { data: myProfile } = await getProfile(userId)
      const homeCity = myProfile?.home_city ?? undefined
      const radius = myProfile?.swap_radius_km ?? 15
      if (homeCity) setCity(homeCity)

      const { data: feedData, error: feedErr } = await fetchFeed({
        city: homeCity,
        radiusKm: radius,
        cursor: 0,
        limit: 20,
        userId,
      })

      let items: Item[] = feedData?.items ?? feedData ?? []

      if (feedErr || items.length === 0) {
        const { data: directItems } = await supabase
          .from('items')
          .select('*')
          .neq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20)
        items = directItems ?? []
      }

      if (items.length > 0) {
        const ownerIds = [...new Set(items.map((i: Item) => i.user_id))]
        const { data: profiles } = await supabase.from('profiles').select('id, name, rating').in('id', ownerIds)
        const pm = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string; rating: number | null }) => [p.id, p]))
        items = items.map((item: Item) => ({
          ...item,
          ownerName: pm[item.user_id]?.name ?? 'Swapper',
          ownerRating: pm[item.user_id]?.rating ?? null,
        }))
      }

      setCards(items)
      setCursor(items.length)

      const { data: mine } = await getMyItems(userId)
      setMyItems(mine ?? [])
    } finally {
      setLoading(false)
    }
  }

  // Auto-select first offer item
  useEffect(() => {
    if (myItems.length > 0 && selectedOffer === null) setSelectedOffer(myItems[0].id)
  }, [myItems])

  const topCard = cards[0]

  const handleLike = async () => {
    if (!topCard || !userId) return
    if (!selectedOffer) {
      setNoOfferError(true)
      setTimeout(() => setNoOfferError(false), 3000)
      return
    }
    setNoOfferError(false)
    const { data, error } = await recordSwipe({
      swiperId: userId,
      targetItemId: topCard.id,
      targetOwnerId: topCard.user_id,
      isLike: true,
    })
    setCards((prev) => prev.slice(1))
    if (!error && data && (data as { matched?: boolean }).matched === true) {
      navigate(`/match/${(data as { swap_id: string }).swap_id}`)
    }
  }

  const handlePass = async () => {
    if (!topCard || !userId) return
    await recordSwipe({
      swiperId: userId,
      targetItemId: topCard.id,
      targetOwnerId: topCard.user_id,
      isLike: false,
    })
    setCards((prev) => prev.slice(1))
  }

  // Load more when deck runs low
  useEffect(() => {
    if (!loading && cards.length < 3 && cursor > 0 && userId) {
      loadMoreCards()
    }
  }, [cards.length])

  // Keyboard: left arrow → pass, right arrow → like
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') handlePass()
      if (e.key === 'ArrowRight') handleLike()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards, selectedOffer])

  async function loadMoreCards() {
    if (!userId) return
    const { data: myProfile } = await getProfile(userId)
    const homeCity = myProfile?.home_city ?? undefined
    const { data: feedData, error } = await fetchFeed({
      city: homeCity,
      radiusKm: myProfile?.swap_radius_km ?? 15,
      cursor,
      limit: 10,
      userId,
    })
    if (!error && feedData) {
      const items: Item[] = Array.isArray(feedData) ? feedData : (feedData.items ?? [])
      if (items.length > 0) {
        setCards((prev) => [...prev, ...items])
        setCursor((c) => c + items.length)
      }
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      <DesktopNav />

      {/* Mobile header */}
      <header
        className="mobile-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <img src={logoUrl} alt="Swapp" style={{ height: 36 }} />
        <LocationChip city={city} />
      </header>

      <div
        className="hunt-layout"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
      >
        {/* Left rail — desktop */}
        <div className="hunt-left" style={{ display: 'none' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
            Your offer
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', margin: 0 }}>
            Pick what you'd trade before you like.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myItems.map((item) => (
              <OfferThumb key={item.id} item={item} selected={selectedOffer === item.id} onClick={() => setSelectedOffer(item.id)} />
            ))}
            <AddThumb onClick={() => navigate('/add')} />
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 0 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
            Hunting for
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['All', 'Cameras', 'Books', 'Vinyl', 'Scarves', 'Curiosities'].map((cat) => (
              <button
                key={cat}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid var(--border-subtle)',
                  background: cat === 'All' ? 'var(--swapp-green)' : 'var(--surface-card)',
                  color: cat === 'All' ? 'var(--parchment)' : 'var(--text-body)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Center — card stack */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 20px',
            gap: 16,
            overflowY: 'auto',
            maxWidth: 480,
            margin: '0 auto',
            width: '100%',
            paddingBottom: 80,
          }}
        >
          {/* Card stack */}
          <div ref={constraintsRef} style={{ position: 'relative', width: '100%', height: 440, flexShrink: 0 }}>
            {/* Ghost cards */}
            {cards[2] && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 20,
                transform: 'scale(0.92) translateY(16px)',
                zIndex: 1,
                boxShadow: 'var(--shadow-card)',
              }} />
            )}
            {cards[1] && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 20,
                transform: 'scale(0.96) translateY(8px)',
                zIndex: 2,
                boxShadow: 'var(--shadow-card)',
              }} />
            )}

            {/* Top card */}
            {loading ? (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 20, background: 'var(--parchment-deep)',
              }}>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Loading…</p>
              </div>
            ) : topCard ? (
              <SwipeCard
                key={topCard.id}
                item={topCard}
                onLike={handleLike}
                onPass={handlePass}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16,
                borderRadius: 20,
                border: '2px dashed var(--border-subtle)',
              }}>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--text-muted)' }}>
                  You've seen everything nearby!
                </p>
                <button
                  onClick={() => navigate('/add')}
                  style={{
                    padding: '10px 24px',
                    background: 'var(--swapp-green)',
                    color: 'var(--parchment)',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                  }}
                >
                  Add your item
                </button>
              </div>
            )}
          </div>

          {/* Offer strip — mobile only */}
          <div className="hunt-mobile-offer-strip" style={{ width: '100%' }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: noOfferError ? 'var(--terracotta)' : 'var(--text-muted)', margin: '0 0 10px',
              transition: 'color 0.2s',
            }}>
              {noOfferError ? 'Pick an item to offer first!' : 'Offer one of yours'}
            </p>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {myItems.map((item) => (
                <OfferThumb key={item.id} item={item} selected={selectedOffer === item.id} onClick={() => setSelectedOffer(item.id)} />
              ))}
              <AddThumb onClick={() => navigate('/add')} />
            </div>
          </div>

          {/* FABs — mobile */}
          <div
            className="hunt-mobile-fabs"
            style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'center' }}
          >
            <button
              onClick={handlePass}
              disabled={!topCard}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--surface-card)',
                border: '1.5px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-float)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: topCard ? 'pointer' : 'not-allowed',
                opacity: topCard ? 1 : 0.4,
              }}
            >
              <X size={28} color="var(--terracotta)" />
            </button>
            <button
              onClick={handleLike}
              disabled={!topCard}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--swapp-green)',
                border: 'none',
                boxShadow: 'var(--shadow-float)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: topCard ? 'pointer' : 'not-allowed',
                opacity: topCard ? 1 : 0.4,
              }}
            >
              <Heart size={28} color="var(--parchment)" fill="var(--parchment)" />
            </button>
          </div>

          {/* FABs + hints — desktop */}
          <div
            className="hunt-desktop-fabs"
            style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
              <button
                onClick={handlePass}
                disabled={!topCard}
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'var(--surface-card)',
                  border: '1.5px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-float)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: topCard ? 'pointer' : 'not-allowed',
                  opacity: topCard ? 1 : 0.4,
                }}
              >
                <X size={24} color="var(--terracotta)" />
              </button>
              <button
                onClick={handleLike}
                disabled={!topCard}
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'var(--swapp-green)',
                  border: 'none',
                  boxShadow: 'var(--shadow-float)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: topCard ? 'pointer' : 'not-allowed',
                  opacity: topCard ? 1 : 0.4,
                }}
              >
                <Heart size={24} color="var(--parchment)" fill="var(--parchment)" />
              </button>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)' }}>
              ← pass &nbsp;·&nbsp; → like &nbsp;·&nbsp; keyboard works too
            </p>
          </div>
        </div>

        {/* Right rail — desktop */}
        {topCard && (
          <div className="hunt-right" style={{ display: 'none' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
              About this find
            </p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, margin: 0 }}>
              {topCard.title}
            </h3>
            {topCard.description && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                {topCard.description}
              </p>
            )}
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                background: 'var(--terracotta)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                color: 'var(--parchment)', fontSize: 18,
              }}>
                {topCard.ownerName?.[0] ?? 'S'}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, margin: 0 }}>
                  {topCard.ownerName ?? 'Swapper'}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  ★ {topCard.ownerRating ?? '—'}
                </p>
              </div>
            </div>
            {topCard.wants_in_return?.length > 0 && (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                  {topCard.ownerName ?? 'Swapper'} wants
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {topCard.wants_in_return.map((w: string) => (
                    <span key={w} style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1.5px solid var(--border-subtle)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600, fontSize: 13,
                    }}>
                      {w}
                    </span>
                  ))}
                </div>
              </>
            )}
            {topCard.images?.length > 1 && (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                  More photos
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {topCard.images.slice(1, 4).map((img: string, i: number) => (
                    <img key={i} src={img} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover' }} alt={`photo ${i + 2}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mobile-tab-bar">
        <TabBar active="hunt" />
      </div>
    </div>
  )
}
