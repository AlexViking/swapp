import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '../components/Button'
import { Toggle } from '../components/Toggle'
import { Sheet } from '../components/Sheet'
import { CityPicker } from './CityPicker'
import { DesktopNav } from '../components/DesktopNav'
import { useAuthStore } from '../store/auth'
import { getProfile, updateProfile, signOut } from '../lib/api'

type ProfileNotifs = {
  notif_match: boolean
  notif_push: boolean
  notif_email: boolean
  home_city: string
}

export function Settings() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id

  const [notifMatch, setNotifMatch] = useState(true)
  const [notifPush, setNotifPush] = useState(true)
  const [notifEmail, setNotifEmail] = useState(false)
  const [homeCity, setHomeCity] = useState('')
  const [cityOpen, setCityOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadProfile()
  }, [userId])

  async function loadProfile() {
    if (!userId) return
    setLoading(true)
    try {
      const { data } = await getProfile(userId)
      if (data) {
        const p = data as ProfileNotifs
        setNotifMatch(p.notif_match ?? true)
        setNotifPush(p.notif_push ?? true)
        setNotifEmail(p.notif_email ?? false)
        setHomeCity(p.home_city ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function patch(changes: Record<string, unknown>) {
    if (!userId) return
    await updateProfile(userId, changes)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  async function handleCitySelect(city: string) {
    setHomeCity(city)
    setCityOpen(false)
    await patch({ home_city: city })
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div style={{ padding: '20px 20px 8px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', letterSpacing: 'var(--tracking-caption)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        {children}
      </div>
    </div>
  )

  const Row = ({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) => (
    <button
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '14px 20px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: '16px',
        color: 'var(--ink)',
        textAlign: 'left',
      }}
    >
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '14px' }}>
        {value && <span>{value}</span>}
        <ChevronRight size={16} />
      </div>
    </button>
  )

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string
    description?: string
    checked: boolean
    onChange: (v: boolean) => void
  }) => (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
      <Toggle label={label} description={description} checked={checked} onChange={onChange} />
    </div>
  )

  if (loading) return null

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <DesktopNav />
      <header className="mobile-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>Settings</h1>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '32px' }}>
        <Section title="Notifications">
          <ToggleRow
            label="New matches"
            description="When someone likes your item back"
            checked={notifMatch}
            onChange={(v) => { setNotifMatch(v); patch({ notif_match: v }) }}
          />
          <ToggleRow
            label="Push notifications"
            checked={notifPush}
            onChange={(v) => { setNotifPush(v); patch({ notif_push: v }) }}
          />
          <ToggleRow
            label="Email notifications"
            checked={notifEmail}
            onChange={(v) => { setNotifEmail(v); patch({ notif_email: v }) }}
          />
        </Section>

        <Section title="Preferences">
          <Row label="City" value={homeCity || 'Choose city'} onPress={() => setCityOpen(true)} />
          <Row label="Distance unit" value="km" />
        </Section>

        <Section title="Account">
          <Row label="Email" value={session?.user?.email ?? ''} />
        </Section>

        <div style={{ padding: '24px 20px 8px' }}>
          <Button variant="ghost" size="md" fullWidth onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        <div style={{ padding: '8px 20px 32px' }}>
          <Button variant="danger" size="md" fullWidth>
            Delete my account
          </Button>
        </div>
      </div>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title="Choose your city">
        <CityPicker onSelect={handleCitySelect} />
      </Sheet>
    </main>
  )
}
