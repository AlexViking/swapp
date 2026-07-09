import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '../components/Button'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

type SwapData = {
  itemATitle: string
  itemBTitle: string
  itemAImage: string | null
  itemBImage: string | null
  otherName: string
}

export function Match() {
  const navigate = useNavigate()
  const { matchId } = useParams<{ matchId: string }>()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id

  const [swapData, setSwapData] = useState<SwapData | null>(null)

  useEffect(() => {
    if (!matchId || !userId) return
    loadSwap()
  }, [matchId, userId])

  async function loadSwap() {
    if (!matchId || !userId) return
    const { data } = await supabase
      .from('swaps')
      .select('*, item_a:item_a_id(*), item_b:item_b_id(*), profile_a:user_a_id(name), profile_b:user_b_id(name)')
      .eq('id', matchId)
      .maybeSingle()

    if (data) {
      const isUserA = data.user_a_id === userId
      const otherProfile = isUserA ? data.profile_b : data.profile_a
      setSwapData({
        itemATitle: data.item_a?.title ?? 'Your item',
        itemBTitle: data.item_b?.title ?? 'Their item',
        itemAImage: data.item_a?.images?.[0] ?? null,
        itemBImage: data.item_b?.images?.[0] ?? null,
        otherName: (otherProfile as { name?: string } | null)?.name ?? 'Swapper',
      })
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--swapp-green)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        gap: 'var(--space-5)',
        textAlign: 'center',
      }}
    >
      {/* Kicker */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: 'var(--tracking-caption)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
        }}
      >
        It's a swapp!
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--parchment)' }}>
        You &amp; {swapData?.otherName ?? 'Swapper'} both said yes
      </h1>

      {/* Item photos side by side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0' }}>
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: 'var(--radius-card)',
            background: swapData?.itemAImage ? 'transparent' : 'var(--terracotta)',
            transform: 'rotate(-6deg)',
            boxShadow: 'var(--shadow-float)',
            overflow: 'hidden',
          }}
        >
          {swapData?.itemAImage && (
            <img src={swapData.itemAImage} alt={swapData.itemATitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--brass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--ink)',
            zIndex: 1,
          }}
        >
          ⇄
        </div>
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: 'var(--radius-card)',
            background: swapData?.itemBImage ? 'transparent' : 'var(--denim)',
            transform: 'rotate(6deg)',
            boxShadow: 'var(--shadow-float)',
            overflow: 'hidden',
          }}
        >
          {swapData?.itemBImage && (
            <img src={swapData.itemBImage} alt={swapData.itemBTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      </div>

      {swapData && (
        <div style={{ color: 'var(--parchment)', opacity: 0.9, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px' }}>
          {swapData.itemATitle} ⇄ {swapData.itemBTitle}
        </div>
      )}

      <p style={{ font: 'var(--type-body)', color: 'var(--text-on-green)', opacity: 0.8, maxWidth: '300px' }}>
        Say hi and sort out where to meet. Keep it friendly — that's the Swapp way.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%', maxWidth: '360px' }}>
        <Button
          variant="accent"
          size="lg"
          fullWidth
          onClick={() => navigate(`/chat/${matchId}`)}
        >
          Say hi to {swapData?.otherName ?? 'Swapper'}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          style={{ color: 'var(--parchment)', borderColor: 'rgba(247,242,225,0.4)' }}
          onClick={() => navigate('/hunt')}
        >
          Keep hunting
        </Button>
      </div>
    </main>
  )
}
