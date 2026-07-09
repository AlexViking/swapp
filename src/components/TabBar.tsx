import React from 'react'
import { useNavigate } from 'react-router'
import { Compass, ArrowLeftRight, PlusCircle, Bell, User } from 'lucide-react'

type Tab = 'hunt' | 'matches' | 'add' | 'activity' | 'profile'

interface TabBarProps {
  active: Tab
}

const tabs: { id: Tab; label: string; icon: React.ReactNode; path: string }[] = [
  { id: 'hunt', label: 'Hunt', icon: <Compass size={22} />, path: '/hunt' },
  { id: 'matches', label: 'Matches', icon: <ArrowLeftRight size={22} />, path: '/matches' },
  { id: 'add', label: 'Add', icon: <PlusCircle size={22} />, path: '/add' },
  { id: 'activity', label: 'Activity', icon: <Bell size={22} />, path: '/activity' },
  { id: 'profile', label: 'Profile', icon: <User size={22} />, path: '/profile' },
]

export function TabBar({ active }: TabBarProps) {
  const navigate = useNavigate()

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '8px 0 env(safe-area-inset-bottom, 8px)',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
      className="tab-bar"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '4px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--swapp-green)' : 'var(--ink-soft)',
              minWidth: '60px',
            }}
          >
            {tab.icon}
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '11px' }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
