import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, MoreVertical, Send } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Card } from '../components/Card'
import { Sheet } from '../components/Sheet'
import { DesktopNav } from '../components/DesktopNav'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

type Message = {
  id: string
  fromMe: boolean
  text: string
  timestamp: string
}

type SwapContext = {
  status: string
  itemATitle: string
  itemBTitle: string
  itemAImages: string[]
  itemBImages: string[]
  otherName: string
}

const AVATAR_COLORS = ['var(--terracotta)', 'var(--denim)', 'var(--sage)', 'var(--brass)']

const STEP_STATUS_MAP: Record<string, number> = {
  proposed: 0,
  confirmed: 1,
  completed: 2,
}

function getLocalMessages(matchId: string): Message[] {
  try {
    const raw = localStorage.getItem(`chat:${matchId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalMessages(matchId: string, messages: Message[]) {
  try {
    localStorage.setItem(`chat:${matchId}`, JSON.stringify(messages))
  } catch {
    // ignore storage errors
  }
}

export function Chat() {
  const navigate = useNavigate()
  const { matchId } = useParams<{ matchId: string }>()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [ctx, setCtx] = useState<SwapContext>({
    status: 'proposed',
    itemATitle: 'Your item',
    itemBTitle: 'Their item',
    itemAImages: [],
    itemBImages: [],
    otherName: 'Swapper',
  })
  const [detailsOpen, setDetailsOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!matchId || !userId) return

    // Load persisted messages from localStorage
    setMessages(getLocalMessages(matchId))

    // Load swap context
    loadContext()

    // Subscribe to Supabase Realtime broadcast for P2P messages
    const channel = supabase.channel(`swap:${matchId}`, {
      config: { broadcast: { self: false } },
    })

    channelRef.current = channel

    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const incoming: Message = {
          id: payload.id as string,
          fromMe: false,
          text: payload.text as string,
          timestamp: payload.timestamp as string,
        }
        setMessages((prev) => {
          const updated = [...prev, incoming]
          saveLocalMessages(matchId, updated)
          return updated
        })
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [matchId, userId])

  async function loadContext() {
    if (!matchId || !userId) return

    const { data: swap } = await supabase
      .from('swaps')
      .select('*, item_a:item_a_id(*), item_b:item_b_id(*), profile_a:user_a_id(name), profile_b:user_b_id(name)')
      .eq('id', matchId)
      .maybeSingle()

    if (swap) {
      const isUserA = swap.user_a_id === userId
      const otherProfile = isUserA ? swap.profile_b : swap.profile_a
      setCtx({
        status: swap.status ?? 'proposed',
        itemATitle: swap.item_a?.title ?? 'Item A',
        itemBTitle: swap.item_b?.title ?? 'Item B',
        itemAImages: swap.item_a?.images ?? [],
        itemBImages: swap.item_b?.images ?? [],
        otherName: otherProfile?.name ?? 'Swapper',
      })
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !userId || !matchId || !channelRef.current) return
    const newMsg: Message = {
      id: Date.now().toString(),
      fromMe: true,
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => {
      const updated = [...prev, newMsg]
      saveLocalMessages(matchId, updated)
      return updated
    })
    setInput('')

    // Broadcast to other party via Supabase Realtime
    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: { id: newMsg.id, text: newMsg.text, timestamp: newMsg.timestamp },
    })
  }

  const step = STEP_STATUS_MAP[ctx.status] ?? 0

  const steps = [
    { label: 'Matched', done: step >= 0 },
    { label: 'Meetup set', done: step >= 1, next: step === 0 },
    { label: 'Swapped', done: step >= 2, next: step === 1 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--surface-page)' }}>
      <DesktopNav />
      {/* Header */}
      <header
        className="mobile-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <button onClick={() => navigate('/matches')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} />
        </button>
        <Avatar initials={ctx.otherName[0]?.toUpperCase() ?? 'S'} color={AVATAR_COLORS[0]} size={36} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--ink)' }}>{ctx.otherName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            connected · peer-to-peer
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MoreVertical size={22} />
        </button>
      </header>

      {/* Pinned swap card */}
      <div style={{ padding: '12px 16px', flexShrink: 0 }}>
        <Card style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--brass)', flexShrink: 0 }} />
            <div style={{ fontSize: '18px', color: 'var(--ink-soft)' }}>⇄</div>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--denim)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ctx.itemATitle} ⇄ {ctx.itemBTitle}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>swap in progress</div>
            </div>
            <button
              onClick={() => setDetailsOpen(true)}
              style={{
                padding: '6px 14px',
                background: 'var(--parchment-deep)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: 'var(--ink)',
                flexShrink: 0,
              }}
            >
              Details
            </button>
          </div>
        </Card>
      </div>

      {/* Swap stepper */}
      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--cream)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-subtle)' }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div style={{ flex: 1, height: '1px', background: s.done ? 'var(--swapp-green)' : 'var(--border-subtle)' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: s.done ? 'var(--swapp-green)' : s.next ? 'var(--parchment-deep)' : 'var(--border-subtle)',
                  border: s.next ? '2px solid var(--swapp-green)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px',
                }}>
                  {s.done ? <span style={{ color: '#fff' }}>✓</span> : null}
                </div>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 600, color: s.done ? 'var(--swapp-green)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
        {step < 2 && (
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600, marginTop: '4px' }}>
            {step === 0 ? 'Say hi and arrange a meetup' : 'One step left — confirm the swap!'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Welcome message */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            style={{
              maxWidth: '70%',
              padding: '10px 14px',
              background: 'var(--surface-card)',
              borderRadius: '4px 14px 14px 14px',
              boxShadow: 'var(--shadow-card)',
              fontSize: '16px',
              color: 'var(--ink)',
              fontFamily: 'var(--font-body)',
            }}
          >
            It's a match! Say hello 👋
          </div>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.fromMe ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '70%',
                padding: '10px 14px',
                background: msg.fromMe ? 'var(--swapp-green)' : 'var(--surface-card)',
                color: msg.fromMe ? 'var(--parchment)' : 'var(--ink)',
                borderRadius: msg.fromMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                boxShadow: 'var(--shadow-card)',
                fontSize: '16px',
                fontFamily: 'var(--font-body)',
              }}
            >
              {msg.text}
              {msg.fromMe && (
                <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7, textAlign: 'right' }}>
                  {msg.timestamp}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer note */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', padding: '4px 0', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em' }}>
        Delivered · encrypted device-to-device
      </div>

      {/* Composer */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          padding: '12px 16px env(safe-area-inset-bottom, 12px)',
          background: 'var(--surface-card)',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={`Message ${ctx.otherName}…`}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--parchment-deep)',
            border: '1.5px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            outline: 'none',
            color: 'var(--ink)',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: input.trim() ? 'var(--swapp-green)' : 'var(--ink-faint)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: `background var(--dur-fast)`,
          }}
        >
          <Send size={18} color={input.trim() ? 'var(--parchment)' : 'var(--ink-soft)'} />
        </button>
      </div>
      <Sheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Swap details" height="auto">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '8px' }}>
          {/* Item A */}
          {[
            { title: ctx.itemATitle, images: ctx.itemAImages, label: 'Your item' },
            { title: ctx.itemBTitle, images: ctx.itemBImages, label: `${ctx.otherName}'s item` },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: 'var(--radius-card)', overflow: 'hidden', flexShrink: 0, background: 'var(--parchment-deep)' }}>
                {item.images[0]
                  ? <img src={item.images[0]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%' }} />
                }
              </div>
              <div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)' }}>{item.title}</div>
              </div>
            </div>
          ))}
          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>
            <span>Status</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>{ctx.status}</span>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
