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
          justifyContent: 'space-between',
          padding: '4px 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/matches')}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '1.5px solid var(--border-subtle)',
              background: 'var(--surface-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            <ArrowLeft size={19} color="var(--ink)" />
          </button>
          <Avatar initials={ctx.otherName[0]?.toUpperCase() ?? 'S'} color={AVATAR_COLORS[0]} size={42} />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '17px', color: 'var(--ink)', margin: 0 }}>{ctx.otherName}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--swapp-green)', display: 'inline-block' }} />
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>connected · peer-to-peer</span>
            </div>
          </div>
        </div>
        <button
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '1.5px solid var(--border-subtle)',
            background: 'var(--surface-card)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0,
          }}
        >
          <MoreVertical size={19} color="var(--ink)" />
        </button>
      </header>

      {/* Pinned swap card */}
      <div style={{ padding: '4px 16px', flexShrink: 0 }}>
        <Card style={{ padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Item A thumb */}
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--brass)', flexShrink: 0, overflow: 'hidden' }}>
              {ctx.itemAImages[0] && <img src={ctx.itemAImages[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--swapp-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h13M14 4l4 4-4 4M20 16H7M10 12l-4 4 4 4"/></svg>
            {/* Item B thumb */}
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'var(--denim)', flexShrink: 0, overflow: 'hidden' }}>
              {ctx.itemBImages[0] && <img src={ctx.itemBImages[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14.5px', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                {ctx.itemATitle} ⇄ {ctx.itemBTitle}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>swap in progress</div>
            </div>
            <button
              onClick={() => setDetailsOpen(true)}
              style={{
                padding: '7px 16px',
                minHeight: '36px',
                background: 'transparent',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
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
      <div style={{ padding: '2px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', padding: '6px 4px 0' }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && (
                <div style={{ flex: 1, height: '1px', background: s.done ? 'var(--swapp-green)' : 'var(--border-subtle)', alignSelf: 'center', marginBottom: '18px' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: s.done ? 'var(--swapp-green)' : s.next ? 'var(--parchment-deep)' : 'var(--parchment-deep)',
                  border: s.next ? '1.5px solid var(--swapp-green)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {s.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--parchment)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                  )}
                </div>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: s.done ? 700 : 400, color: s.done ? 'var(--swapp-green)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
        {step < 2 && (
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0 0', fontFamily: 'var(--font-body)' }}>
            {step === 0 ? 'Say hi and arrange a meetup' : 'One step left — meet up and it\'s yours'}
          </p>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Welcome message */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            style={{
              maxWidth: '76%',
              padding: '10px 14px',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px 16px 16px 4px',
              boxShadow: 'var(--shadow-card)',
              fontSize: '15.5px',
              lineHeight: 1.45,
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
                maxWidth: '76%',
                padding: '10px 14px',
                background: msg.fromMe ? 'var(--swapp-green)' : 'var(--surface-card)',
                color: msg.fromMe ? 'var(--parchment)' : 'var(--ink)',
                border: msg.fromMe ? 'none' : '1px solid var(--border-subtle)',
                borderRadius: msg.fromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                boxShadow: 'var(--shadow-card)',
                fontSize: '15.5px',
                lineHeight: 1.45,
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
      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
        Delivered · encrypted device-to-device
      </div>

      {/* Composer */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          padding: '8px 16px env(safe-area-inset-bottom, 10px)',
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
            minHeight: '48px',
            padding: '0 20px',
            background: '#fff',
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
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--swapp-green)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={20} color="var(--parchment)" />
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
