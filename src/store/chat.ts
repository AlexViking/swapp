import { create } from 'zustand'

export interface ChatMessage {
  id: string
  fromMe: boolean
  text: string
  timestamp: string
}

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface ChatPeer {
  connectionState: ConnectionState
  messages: ChatMessage[]
}

interface ChatStore {
  peers: Record<string, ChatPeer>
  setConnectionState: (matchId: string, state: ConnectionState) => void
  addMessage: (matchId: string, message: ChatMessage) => void
  clearChat: (matchId: string) => void
}

const defaultPeer = (): ChatPeer => ({
  connectionState: 'idle',
  messages: [],
})

export const useChatStore = create<ChatStore>((set) => ({
  peers: {},
  setConnectionState: (matchId, connectionState) =>
    set((s) => ({
      peers: {
        ...s.peers,
        [matchId]: { ...(s.peers[matchId] ?? defaultPeer()), connectionState },
      },
    })),
  addMessage: (matchId, message) =>
    set((s) => ({
      peers: {
        ...s.peers,
        [matchId]: {
          ...(s.peers[matchId] ?? defaultPeer()),
          messages: [...(s.peers[matchId]?.messages ?? []), message],
        },
      },
    })),
  clearChat: (matchId) =>
    set((s) => ({
      peers: { ...s.peers, [matchId]: defaultPeer() },
    })),
}))
