import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Settings, Plus } from 'lucide-react'
import { TabBar } from '../components/TabBar'
import { DesktopNav } from '../components/DesktopNav'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useAuthStore } from '../store/auth'
import { getProfile, updateProfile, getMyItems, signOut } from '../lib/api'

type ProfileData = {
  name: string
  home_city: string
  rating: number | null
  swap_count: number
  swap_radius_km: number
}

type ItemData = {
  id: string
  title: string
  images: string[]
}

export function Profile() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [items, setItems] = useState<ItemData[]>([])
  const [radius, setRadius] = useState(15)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadData()
  }, [userId])

  async function loadData() {
    if (!userId) return
    setLoading(true)
    try {
      const [{ data: prof }, { data: myItems }] = await Promise.all([
        getProfile(userId),
        getMyItems(userId),
      ])
      if (prof) {
        setProfile(prof as ProfileData)
        setRadius(prof.swap_radius_km ?? 15)
      }
      setItems((myItems ?? []) as ItemData[])
    } finally {
      setLoading(false)
    }
  }

  async function handleRadiusChange(value: number) {
    setRadius(value)
    if (!userId) return
    await updateProfile(userId, { swap_radius_km: value })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const swapCount = profile?.swap_count ?? 0
  const rating = profile?.rating ?? null
  const activeCount = items.length
  const initial = (profile?.name ?? 'U')[0]?.toUpperCase() ?? 'U'

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column', paddingBottom: '80px' }}>
      <DesktopNav />
      {/* Header */}
      <header className="mobile-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px' }}>Profile</h1>
        <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
          <Settings size={22} />
        </button>
      </header>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Avatar initials={initial} color="var(--denim)" size={64} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px' }}>{profile?.name ?? 'You'}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              {profile?.home_city ?? 'Somewhere'} · swapping since 2026{rating != null ? ` · ★ ${rating.toFixed(1)}` : ''}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Swaps done', value: String(swapCount) },
            { label: 'On the table', value: String(activeCount) },
            { label: 'Rating', value: rating != null ? `${rating.toFixed(1)} ★` : '—' },
          ].map((stat) => (
            <Card key={stat.label} style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: 'var(--swapp-green)' }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600, marginTop: '2px' }}>{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Trusted swapper progress */}
        <Card>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Trusted Swapper</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>{swapCount} / 15 swaps to unlock badge</div>
          <div style={{ height: '8px', background: 'var(--parchment-deep)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((swapCount / 15) * 100, 100)}%`, background: 'var(--swapp-green)', borderRadius: 'var(--radius-pill)', transition: 'width var(--dur-med)' }} />
          </div>
        </Card>

        {/* Hunt radius */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>Hunt radius</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--swapp-green)' }}>{radius} km</div>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--swapp-green)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </Card>

        {/* Listings grid */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>On the table</div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', color: 'var(--swapp-green)' }}>
              Manage
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  width: '78px',
                  height: '78px',
                  borderRadius: 'var(--radius-card-sm)',
                  background: 'var(--parchment-deep)',
                  overflow: 'hidden',
                }}
              >
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--parchment-deep)' }} />
                )}
              </div>
            ))}
            <button
              onClick={() => navigate('/add')}
              style={{
                width: '78px',
                height: '78px',
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
          </div>
        </div>

        <Button variant="ghost" size="md" fullWidth onClick={handleSignOut}>
          Sign out
        </Button>
      </div>

      <div className="mobile-tab-bar">
        <TabBar active="profile" />
      </div>
    </div>
  )
}
