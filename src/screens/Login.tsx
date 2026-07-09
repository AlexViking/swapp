import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useAuthStore } from '../store/auth'
import { requestOTP } from '../lib/api'

export function Login() {
  const navigate = useNavigate()
  const { setPendingEmail } = useAuthStore()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!email) return
    setError('')
    setSending(true)
    const { error: err } = await requestOTP(email)
    setSending(false)
    if (err) { setError(err.message); return }
    setPendingEmail(email)
    navigate('/verify')
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <header
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
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>Welcome back</h1>
      </header>

      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '460px', width: '100%', margin: '0 auto' }}>
        <p style={{ font: 'var(--type-body)', color: 'var(--text-muted)' }}>
          Enter your email and we'll send you a magic link to sign in.
        </p>

        <Input
          label="Email"
          type="email"
          placeholder="you@somewhere.com"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        />

        <div style={{ flex: 1 }} />

        {error && (
          <p style={{ color: 'var(--terracotta)', fontFamily: 'var(--font-body)', fontSize: '14px', margin: 0 }}>
            {error}
          </p>
        )}

        <Button variant="primary" size="lg" fullWidth disabled={sending} onClick={handleSubmit}>
          {sending ? 'Sending…' : 'Send me a magic link'}
        </Button>

        <p style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' }}>
          New here?{' '}
          <span
            onClick={() => navigate('/register')}
            style={{ color: 'var(--swapp-green)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Create an account
          </span>
        </p>
      </div>
    </main>
  )
}
