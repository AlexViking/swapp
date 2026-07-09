
import { useNavigate, useLocation } from 'react-router'
import { Avatar } from './Avatar'
import { Button } from './Button'

export function DesktopNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navLink = (path: string, label: string) => {
    const isActive = location.pathname === path
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '16px',
          color: isActive ? 'var(--swapp-green)' : 'var(--ink)',
          padding: '4px 8px',
          borderBottom: isActive ? '2px solid var(--swapp-green)' : '2px solid transparent',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <header
      style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: '64px',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
      className="desktop-nav"
    >
      <img
        src="/src/assets/swapp-logo-lockup.png"
        alt="Swapp"
        style={{ height: '32px', cursor: 'pointer' }}
        onClick={() => navigate('/hunt')}
      />
      <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        {navLink('/hunt', 'Hunt')}
        {navLink('/matches', 'Matches')}
        {navLink('/activity', 'Activity')}
      </nav>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Button size="sm" onClick={() => navigate('/add')}>+ Add</Button>
        <Avatar initials="M" color="var(--denim)" size={36} style={{ cursor: 'pointer' }} />
      </div>
    </header>
  )
}
