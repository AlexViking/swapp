import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Sheet } from '../components/Sheet'
import { CityPicker } from './CityPicker'
import { useAuthStore } from '../store/auth'
import { requestOTP } from '../lib/api'
import logoUrl from '../assets/swapp-logo-lockup.png'

export function Register() {
  const navigate = useNavigate()
  const { setPendingEmail, setSelectedCity, selectedCity } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notify, setNotify] = useState(true)
  const [cityOpen, setCityOpen] = useState(false)

  const handleSubmit = async () => {
    if (!email) return
    const { error } = await requestOTP(email)
    if (error) { alert(error.message); return }
    setPendingEmail(email)
    navigate('/verify')
  }

  return (
    <main
      className="register-split"
      style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}
    >
      {/* Left hero panel — desktop only */}
      <div
        className="register-hero"
        style={{
          display: 'none',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--swapp-green)',
          padding: '60px 48px',
          gap: '32px',
          textAlign: 'center',
        }}
      >
        <div style={{ background: 'var(--parchment)', borderRadius: 16, padding: '8px 16px' }}>
          <img src={logoUrl} alt="Swapp" style={{ height: 56 }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '36px', color: 'var(--parchment)', maxWidth: '360px', lineHeight: 1.2 }}>
          Find Unique Treasures. Swap Your Own.
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '18px', color: 'rgba(247,242,225,0.85)', maxWidth: '320px' }}>
          Trade the things you love with people nearby. No money, just good taste.
        </p>
        <div style={{ display: 'flex', gap: '16px', position: 'relative', height: '120px', alignItems: 'center' }}>
          <div style={{ width: '90px', height: '100px', background: 'var(--terracotta)', borderRadius: 'var(--radius-card)', transform: 'rotate(-6deg)', boxShadow: 'var(--shadow-float)' }} />
          <div style={{ width: '90px', height: '100px', background: 'var(--denim)', borderRadius: 'var(--radius-card)', transform: 'rotate(2deg)', boxShadow: 'var(--shadow-float)', alignSelf: 'flex-end' }} />
          <div style={{ width: '90px', height: '100px', background: 'var(--brass)', borderRadius: 'var(--radius-card)', transform: 'rotate(5deg)', boxShadow: 'var(--shadow-float)' }} />
        </div>
      </div>

      {/* Right / mobile form panel */}
      <div
        className="register-form"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {/* App header */}
        <header
          className="mobile-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>Create account</h1>
        </header>

        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', overflowY: 'auto' }}>
          {/* Desktop back + title */}
          <div className="desktop-nav" style={{ display: 'none', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}>
              <ArrowLeft size={22} />
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px' }}>Create account</h1>
          </div>

          <p style={{ font: 'var(--type-body)', color: 'var(--text-muted)' }}>
            Join a community of curious swappers. No money involved — just interesting trades.
          </p>

          <Input
            label="Your name"
            placeholder="What do folks call you?"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />

          {/* City picker button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>City</label>
            <button
              onClick={() => setCityOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--cream)',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '17px',
                color: selectedCity ? 'var(--ink)' : 'var(--text-muted)',
                textAlign: 'left',
              }}
            >
              {selectedCity || 'Choose your city'}
              <ChevronRight size={18} color="var(--ink-soft)" />
            </button>
          </div>

          {/* Notify checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--swapp-green)' }}
            />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--ink)' }}>
              Tell me when someone likes my finds
            </span>
          </label>

          <div style={{ flex: 1 }} />

          <Button variant="primary" size="lg" fullWidth onClick={handleSubmit}>
            Send me a magic link
          </Button>

          <p style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.02em' }}>
            By joining you agree to the house rules
          </p>
        </div>
      </div>

      <Sheet open={cityOpen} onClose={() => setCityOpen(false)} title="Choose your city">
        <CityPicker onSelect={(city) => { setSelectedCity(city); setCityOpen(false) }} />
      </Sheet>
    </main>
  )
}
