import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeftRight } from 'lucide-react'
import { TabBar } from '../components/TabBar'
import { DesktopNav } from '../components/DesktopNav'
import { Button } from '../components/Button'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

type ActivityItem = {
  id: string
  icon: React.ReactNode
  iconBg: string
  title: string
  sub: string
  action?: string
  actionPath?: string
  group: 'TODAY' | 'YESTERDAY' | 'EARLIER'
}

function groupKey(iso: string): 'TODAY' | 'YESTERDAY' | 'EARLIER' {
  const now = new Date()
  const d = new Date(iso)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  if (d >= todayStart) return 'TODAY'
  if (d >= yesterdayStart) return 'YESTERDAY'
  return 'EARLIER'
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export function Activity() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadActivity()
  }, [userId])

  async function loadActivity() {
    if (!userId) return
    setLoading(true)
    try {
      const { data: swapData } = await supabase
        .from('swaps')
        .select('*, item_a:item_a_id(title), item_b:item_b_id(title)')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!swapData) {
        setItems([])
        return
      }

      // Fetch the other user's profile names
      const otherUserIds = [...new Set(swapData.map((s) => s.user_a_id === userId ? s.user_b_id : s.user_a_id).filter(Boolean))]
      const { data: profiles } = otherUserIds.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', otherUserIds)
        : { data: [] }
      const nameMap = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))

      const built: ActivityItem[] = swapData.map((s) => {
        const isUserA = s.user_a_id === userId
        const myItem = isUserA ? s.item_a?.title : s.item_b?.title
        const theirItem = isUserA ? s.item_b?.title : s.item_a?.title
        const theirUserId = isUserA ? s.user_b_id : s.user_a_id
        const theirName = nameMap[theirUserId] ?? 'Someone'
        const iso = s.created_at ?? new Date().toISOString()
        let title = ''
        let action: string | undefined
        let actionPath: string | undefined

        switch (s.status) {
          case 'proposed':
            if (isUserA) {
              title = `You proposed a swap with ${theirName}`
              action = 'Chat'
            } else {
              title = `${theirName} liked your ${myItem ?? 'item'}`
              action = 'Like back'
            }
            actionPath = `/chat/${s.id}`
            break
          case 'confirmed':
            title = `New match with ${theirName}`
            action = 'Chat'
            actionPath = `/chat/${s.id}`
            break
          case 'completed':
            title = `Swap complete with ${theirName}`
            action = 'Rate'
            actionPath = `/rate/${s.id}`
            break
          case 'cancelled':
            title = `Swap cancelled: ${myItem ?? 'your item'} ⇄ ${theirItem ?? 'their item'}`
            break
          default:
            title = `Swap update with ${theirName}`
        }

        return {
          id: s.id,
          icon: <ArrowLeftRight size={16} color="#fff" />,
          iconBg: s.status === 'completed' ? 'var(--swapp-green)'
            : s.status === 'cancelled' ? 'var(--terracotta)'
            : s.status === 'confirmed' ? 'var(--denim)'
            : 'var(--brass)',
          title,
          sub: relativeTime(iso),
          action,
          actionPath,
          group: groupKey(iso),
        }
      })

      setItems(built)
    } finally {
      setLoading(false)
    }
  }

  const GROUP_ORDER: Array<'TODAY' | 'YESTERDAY' | 'EARLIER'> = ['TODAY', 'YESTERDAY', 'EARLIER']
  const grouped: Partial<Record<'TODAY' | 'YESTERDAY' | 'EARLIER', ActivityItem[]>> = {}
  items.forEach((item) => {
    if (!grouped[item.group]) grouped[item.group] = []
    grouped[item.group]!.push(item)
  })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', paddingBottom: '80px' }}>
      <DesktopNav />
      <header className="mobile-header" style={{ padding: '24px 20px 16px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px' }}>Activity</h1>
      </header>

      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '16px' }}>
            No activity yet — go find something to swap!
          </div>
        ) : (
          GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
            <div key={group}>
              <div style={{ padding: '12px 20px 8px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', letterSpacing: 'var(--tracking-caption)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {group}
              </div>
              {grouped[group]!.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: item.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--ink)', marginBottom: '2px' }}>{item.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  {item.action && item.actionPath && (
                    <Button size="sm" variant="ghost" style={{ flexShrink: 0 }} onClick={() => navigate(item.actionPath!)}>
                      {item.action}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="mobile-tab-bar">
        <TabBar active="activity" />
      </div>
    </div>
  )
}
