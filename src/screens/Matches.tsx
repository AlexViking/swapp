import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { TabBar } from '../components/TabBar'
import { DesktopNav } from '../components/DesktopNav'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

type Filter = 'active' | 'done' | 'cancelled'

type SwapRow = {
  id: string
  otherName: string
  otherInitial: string
  itemA: string
  itemB: string
  status: string
  createdAt: string
}

const badgeLabel: Record<string, string> = {
  proposed: 'New',
  confirmed: 'Meetup set',
  completed: 'Done',
  cancelled: 'Cancelled',
}

const badgeColor: Record<string, string> = {
  proposed: 'var(--terracotta)',
  confirmed: 'var(--swapp-green)',
  completed: 'var(--sage)',
  cancelled: 'var(--terracotta)',
}

const AVATAR_COLORS = ['var(--terracotta)', 'var(--denim)', 'var(--sage)', 'var(--brass)', 'var(--swapp-green)']

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function Matches() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id
  const [filter, setFilter] = useState<Filter>('active')
  const [allSwaps, setAllSwaps] = useState<SwapRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    loadSwaps()
  }, [userId])

  async function loadSwaps() {
    if (!userId) return
    setLoading(true)
    try {
      const { data: swapData } = await supabase
        .from('swaps')
        .select('*, item_a:item_a_id(*), item_b:item_b_id(*)')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (!swapData || swapData.length === 0) {
        setAllSwaps([])
        setLoading(false)
        return
      }

      const otherUserIds = swapData.map((s) =>
        s.user_a_id === userId ? s.user_b_id : s.user_a_id
      )
      const uniqueIds = [...new Set(otherUserIds)]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', uniqueIds)

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

      const built: SwapRow[] = swapData.map((s) => {
        const otherId = s.user_a_id === userId ? s.user_b_id : s.user_a_id
        const otherProfile = profileMap[otherId]
        const name = otherProfile?.name ?? 'Swapper'
        return {
          id: s.id,
          otherName: name,
          otherInitial: name[0]?.toUpperCase() ?? 'S',
          itemA: s.item_a?.title ?? 'Item A',
          itemB: s.item_b?.title ?? 'Item B',
          status: s.status ?? 'proposed',
          createdAt: s.created_at ?? new Date().toISOString(),
        }
      })

      setAllSwaps(built)
    } finally {
      setLoading(false)
    }
  }

  const filtered = allSwaps.filter((s) => {
    if (filter === 'active') return s.status === 'proposed' || s.status === 'confirmed'
    if (filter === 'done') return s.status === 'completed'
    if (filter === 'cancelled') return s.status === 'cancelled'
    return true
  })

  const activeCount = allSwaps.filter(
    (s) => s.status === 'proposed' || s.status === 'confirmed'
  ).length

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: 'active', label: 'Active', count: activeCount || undefined },
    { id: 'done', label: 'Done' },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  function handleRowClick(swap: SwapRow) {
    // On desktop, set selectedSwapId; on mobile, navigate
    setSelectedSwapId(swap.id)
    navigate(`/chat/${swap.id}`)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <DesktopNav />

      <div className="matches-chat-split" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Swaps list column */}
        <div className="matches-list-col" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <header
            className="mobile-header"
            style={{ padding: '6px 20px 14px', flexShrink: 0 }}
          >
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, lineHeight: 1.15, color: 'var(--ink)', margin: '0 0 14px' }}>Your swaps</h1>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 'var(--radius-pill)',
                    background: filter === f.id ? 'var(--swapp-green)' : '#fff',
                    color: filter === f.id ? 'var(--parchment)' : 'var(--ink)',
                    border: filter === f.id ? '1.5px solid var(--swapp-green)' : '1.5px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.label}{f.count != null ? ` (${f.count})` : ''}
                </button>
              ))}
            </div>
          </header>

          {/* Desktop title — shown in list col on desktop */}
          <div
            className="matches-desktop-title"
            style={{ display: 'none', padding: '18px 18px 14px', flexShrink: 0, flexDirection: 'column' }}
          >
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, marginBottom: 14, color: 'var(--ink)' }}>Your swaps</h1>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 'var(--radius-pill)',
                    background: filter === f.id ? 'var(--swapp-green)' : '#fff',
                    color: filter === f.id ? 'var(--parchment)' : 'var(--ink)',
                    border: filter === f.id ? '1.5px solid var(--swapp-green)' : '1.5px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.label}{f.count != null ? ` (${f.count})` : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, padding: '0 0 16px' }}>
            {loading ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                Loading…
              </div>
            ) : filtered.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {filtered.map((swap, idx) => (
                    <button
                      key={swap.id}
                      onClick={() => handleRowClick(swap)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        padding: '14px 20px',
                        background: selectedSwapId === swap.id ? 'rgba(47,106,82,0.06)' : 'none',
                        border: 'none',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Avatar
                        initials={swap.otherInitial}
                        color={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
                        size={46}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, marginBottom: 2, color: 'var(--ink)' }}>
                          {swap.otherName}
                        </div>
                        <div style={{
                          fontSize: 14,
                          fontFamily: 'var(--font-body)',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}>
                          {swap.itemA} ⇄ {swap.itemB}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{relativeTime(swap.createdAt)}</span>
                        <Badge bg={badgeColor[swap.status] ?? 'var(--denim)'} color="#fff">
                          {badgeLabel[swap.status] ?? swap.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  That's all your swaps…
                </div>
              </>
            ) : (
              <div style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
                  {filter === 'active' ? 'No active swaps — go hunt!' : `No ${filter} swaps`}
                </div>
                {filter === 'active' && (
                  <button
                    onClick={() => navigate('/hunt')}
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
                    Go hunt
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop right pane — chat placeholder or chat */}
        <div
          className="matches-chat-col"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            borderLeft: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 16,
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12z"/></svg>
          <span>Select a swap to chat</span>
        </div>
      </div>

      <div className="mobile-tab-bar">
        <TabBar active="matches" />
      </div>
    </div>
  )
}
