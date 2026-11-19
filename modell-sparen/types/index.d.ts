export type Ersparnis = { aufgaben: number; tokens: number }

declare module 'claude-code' {
  interface PluginState {
    'modell-sparen': { ersparnis: Ersparnis }
  }
}
