import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ChevronDown, MapPin } from 'lucide-react'
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
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!email) { setError('Please enter your email'); return }
    setError('')
    setSending(true)
    const { error: err } = await requestOTP(email)
    setSending(false)
    if (err) { setError(err.message); return }
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
            justifyContent: 'space-between',
            padding: '6px 20px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigate(-1)}
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
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '18px', color: 'var(--ink)', margin: 0 }}>
            Create account
          </h3>
          <span style={{ width: '40px' }} />
        </header>

        <div style={{ flex: 1, padding: '10px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', overflowY: 'auto' }}>

          <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', lineHeight: 1.55, color: 'var(--text-muted)', margin: 0 }}>
            Just an email — we'll send you a magic link. No passwords to forget.
          </p>

          <Input
            label="Your name"
            placeholder="e.g. Maya"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@somewhere.com"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />

          {/* City picker button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
              Where do you swap?
            </div>
            <button
              onClick={() => setCityOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '44px',
                padding: '11px 16px',
                background: '#fff',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                color: 'var(--ink)',
                width: '100%',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="var(--swapp-green)" />
                {selectedCity || 'Berlin'}
              </span>
              <ChevronDown size={15} color="var(--swapp-green)" />
            </button>
            <p style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-muted)', margin: 0 }}>
              Detected from your location — tap to change
            </p>
          </div>

          {/* Notify checkbox — custom styled */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--ink)', minHeight: '28px' }}>
            <span
              style={{
                width: '22px', height: '22px', flexShrink: 0,
                borderRadius: '7px',
                background: notify ? 'var(--swapp-green)' : 'var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 140ms',
              }}
              onClick={() => setNotify((v) => !v)}
            >
              {notify && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.5L4.8 9.2L10 3.2" stroke="var(--parchment)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            Tell me when someone likes my finds
          </label>

          <div style={{ flex: 1 }} />

          {error && (
            <p style={{ color: 'var(--terracotta)', fontFamily: 'var(--font-body)', fontSize: '14px', margin: 0 }}>
              {error}
            </p>
          )}

          <Button variant="primary" size="lg" fullWidth disabled={sending} onClick={handleSubmit}>
            {sending ? 'Sending…' : 'Send me a magic link'}
          </Button>

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
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
