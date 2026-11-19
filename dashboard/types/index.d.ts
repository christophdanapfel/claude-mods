export type Eintrag = { id: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    dashboard: {
      todos: Shaped<Eintrag[]>
      antworten: Shaped<Eintrag[]>
    }
  }
}
