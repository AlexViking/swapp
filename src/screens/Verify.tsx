import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Mail } from 'lucide-react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useAuthStore } from '../store/auth'
import { requestOTP } from '../lib/api'

export function Verify() {
  const navigate = useNavigate()
  const { pendingEmail } = useAuthStore()
  const [countdown, setCountdown] = useState(60)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const formattedTime = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`

  const handleResend = async () => {
    if (!pendingEmail) return
    await requestOTP(pendingEmail)
    setCountdown(60)
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        gap: 'var(--space-5)',
        textAlign: 'center',
      }}
    >
      {/* Green circle with mail icon */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'var(--swapp-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Mail size={36} color="var(--parchment)" />
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--ink)' }}>
        Check your inbox
      </h1>

      <p style={{ font: 'var(--type-body)', color: 'var(--text-muted)', maxWidth: '300px' }}>
        We sent a magic link to{' '}
        <strong style={{ color: 'var(--ink)' }}>{pendingEmail || 'your email'}</strong>.
        Tap it to sign in instantly.
      </p>

      <Card style={{ width: '100%', maxWidth: '360px' }}>
        <Button
          variant="ghost"
          fullWidth
          disabled={countdown > 0}
          onClick={handleResend}
        >
          {countdown > 0 ? `Resend link (${formattedTime})` : 'Resend link'}
        </Button>
      </Card>

      <button
        onClick={() => navigate('/register')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--swapp-green)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '15px',
          textDecoration: 'underline',
        }}
      >
        Use a different email
      </button>
    </main>
  )
}
