import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  initialized: boolean
  pendingEmail: string
  selectedCity: string
  setSession: (session: Session | null) => void
  setInitialized: () => void
  setPendingEmail: (email: string) => void
  setSelectedCity: (city: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  pendingEmail: '',
  selectedCity: '',
  setSession: (session) => set({ session }),
  setInitialized: () => set({ initialized: true }),
  setPendingEmail: (pendingEmail) => set({ pendingEmail }),
  setSelectedCity: (selectedCity) => set({ selectedCity }),
}))
