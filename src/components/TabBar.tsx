import React from 'react'
import { useNavigate } from 'react-router'

type Tab = 'hunt' | 'matches' | 'add' | 'activity' | 'profile'

interface TabBarProps {
  active: Tab
}

// SVG icons matching the design exactly
const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
)

const HeartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20s-7-4.6-9.2-9A5.2 5.2 0 0 1 12 6.7 5.2 5.2 0 0 1 21.2 11C19 15.4 12 20 12 20z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11L12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8z" />
  </svg>
)

const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
)

const tabs: { id: Tab; icon: React.ReactNode; path: string; label: string }[] = [
  { id: 'hunt',     icon: <SearchIcon />,  path: '/hunt',     label: 'hunt' },
  { id: 'matches',  icon: <HeartIcon />,   path: '/matches',  label: 'matches' },
  { id: 'add',      icon: <PlusIcon />,    path: '/add',      label: 'add' },
  { id: 'activity', icon: <HomeIcon />,    path: '/activity', label: 'activity' },
  { id: 'profile',  icon: <ProfileIcon />, path: '/profile',  label: 'profile' },
]

export function TabBar({ active }: TabBarProps) {
  const navigate = useNavigate()

  return (
    <div style={{ padding: '6px 16px env(safe-area-inset-bottom, 8px)' }}>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          background: 'var(--swapp-green)',
          borderRadius: 'var(--radius-pill)',
          padding: '8px 12px',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              style={{
                background: isActive ? 'rgba(247, 242, 225, 0.16)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--parchment)',
                transition: 'background 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {tab.icon}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
