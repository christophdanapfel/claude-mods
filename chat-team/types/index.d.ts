export type Rolle = 'chef' | 'recherche' | 'entwurf'

declare module 'claude-code' {
  interface PluginState {
    'chat-team': { rolle: Rolle | null }
  }
}
