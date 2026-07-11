
import { useNavigate } from 'react-router'
import { Camera, Star, Heart } from 'lucide-react'
import { Button } from '../components/Button'
import logoUrl from '../assets/swapp-logo-lockup.png'

export function Welcome() {
  const navigate = useNavigate()

  return (
    <main
      className="welcome-split"
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-page)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Left hero panel — desktop only */}
      <div
        className="welcome-hero"
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
          Trade the things you've outgrown for things you'll love. No fees, no landfill.
        </p>
        {/* Photo tiles */}
        <div style={{ display: 'flex', gap: '16px', position: 'relative', height: '120px', alignItems: 'center' }}>
          <div style={{ width: '90px', height: '100px', background: 'var(--terracotta)', borderRadius: 'var(--radius-card)', transform: 'rotate(-6deg)', boxShadow: 'var(--shadow-float)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={28} color="rgba(255,255,255,0.7)" /></div>
          <div style={{ width: '90px', height: '100px', background: 'var(--denim)', borderRadius: 'var(--radius-card)', transform: 'rotate(2deg)', boxShadow: 'var(--shadow-float)', alignSelf: 'flex-end', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Star size={28} color="rgba(255,255,255,0.7)" /></div>
          <div style={{ width: '90px', height: '100px', background: 'var(--brass)', borderRadius: 'var(--radius-card)', transform: 'rotate(5deg)', boxShadow: 'var(--shadow-float)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Heart size={28} color="rgba(255,255,255,0.7)" /></div>
        </div>
      </div>

      {/* Right / mobile form panel */}
      <div
        className="welcome-form"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '10px 28px 24px',
          gap: '20px',
        }}
      >
        <img src={logoUrl} alt="Swapp" style={{ width: 210, borderRadius: 16 }} className="mobile-welcome-logo" />

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '34px',
            lineHeight: 1.15,
            color: 'var(--ink)',
            margin: 0,
          }}
          className="mobile-welcome-headline"
        >
          Find Unique Treasures.<br />Swap Your Own.
        </h1>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '17px', lineHeight: 1.55, color: 'var(--text-muted)', maxWidth: '300px', margin: 0 }} className="mobile-welcome-body">
          Trade the things you've outgrown for things you'll love. No fees, no landfill.
        </p>

        {/* Photo swatches */}
        <div className="mobile-welcome-photos" style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '8px 0' }}>
          <div style={{ width: '92px', height: '92px', background: 'var(--terracotta)', borderRadius: '14px', transform: 'rotate(-5deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Camera size={26} color="rgba(251,248,238,0.75)" /></div>
          <div style={{ width: '92px', height: '92px', background: 'var(--denim)', borderRadius: '14px', transform: 'rotate(3deg) translateY(-8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Star size={26} color="rgba(251,248,238,0.75)" /></div>
          <div style={{ width: '92px', height: '92px', background: 'var(--brass)', borderRadius: '14px', transform: 'rotate(6deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Heart size={26} color="rgba(251,248,238,0.75)" /></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '6px' }}>
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/register')}>
            Get started
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={() => navigate('/login')}>
            I already have an account
          </Button>
        </div>
      </div>
    </main>
  )
}
