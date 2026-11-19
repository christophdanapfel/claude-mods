import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Eintrag } from '../types'

const PANE = 'dashboard'
const TITEL = 'Dashboard'
const TOOL = 'mcp__dashboard__eintragen'

const todos = atom({ plugin: 'dashboard', key: 'todos' } as const, [], {
  shape: 'eintraege-1',
})
const antworten = atom({ plugin: 'dashboard', key: 'antworten' } as const, [], {
  shape: 'eintraege-1',
})

type Liste = 'todos' | 'antworten'

async function aendern(
  $: EngineInterface,
  liste: Liste,
  fn: (alt: Eintrag[]) => Eintrag[],
): Promise<Eintrag[]> {
  return liste === 'todos' ? update($, todos, fn) : update($, antworten, fn)
}

function neueId(): string {
  return crypto.randomUUID()
}

async function speichern($: EngineInterface, liste: Liste, werte: Eintrag[]) {
  await $.store.set(liste, werte)
}

async function hinzufuegen($: EngineInterface, liste: Liste, text: string) {
  const sauber = text.trim()
  if (sauber === '') return
  const neu = await aendern($, liste, alt => [
    ...alt,
    { id: neueId(), text: sauber },
  ])
  await speichern($, liste, neu)
}

async function erledigen($: EngineInterface, liste: Liste, id: string) {
  const neu = await aendern($, liste, alt =>
    alt.filter(eintrag => eintrag.id !== id),
  )
  await speichern($, liste, neu)
}

function alsText(liste: Eintrag[]): string {
  return liste.length === 0
    ? '(leer)'
    : liste.map(eintrag => `- ${eintrag.text}`).join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const liste of ['todos', 'antworten'] as const) {
      const gespeichert = await $.store.get(liste)
      if (Array.isArray(gespeichert)) {
        await aendern($, liste, () => gespeichert as Eintrag[])
      }
    }

    await $.command.register({
      name: 'uebersicht',
      description: 'Öffnet das Dashboard mit To-dos und offenen Antworten',
    })
    await $.command.register({
      name: 'todo',
      description: 'Setzt ein To-do aufs Dashboard',
      argumentHint: '<was zu tun ist>',
    })
    await $.command.register({
      name: 'antworten',
      description: 'Merkt auf dem Dashboard, wem du noch antworten musst',
      argumentHint: '<wem und worum>',
    })
    await $.tool.register({
      name: 'eintragen',
      description:
        'Setzt einen Eintrag auf das Dashboard des Nutzers: liste "todos" für Aufgaben, "antworten" für Personen, denen er noch antworten muss. Nutze es, wenn der Nutzer dich bittet, sich etwas zu merken, oder wenn du beim Lesen von Mails offene Antworten findest.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          liste: { type: 'string', enum: ['todos', 'antworten'] },
          text: { type: 'string', description: 'Kurz, z. B. "Max – Angebot"' },
        },
        required: ['liste', 'text'],
      },
    })

    void $.ui.open({ id: PANE, title: TITEL })

    return next(e)
  })

  on('command.run', { command: 'uebersicht' }, async $ => {
    await $.ui.open({ id: PANE, title: TITEL })
    const [t, a] = [await read($, todos), await read($, antworten)]

    return {
      text: `Dashboard geöffnet. To-dos:\n${alsText(t)}\nNoch antworten:\n${alsText(a)}`,
    }
  })

  on('command.run', { command: 'todo' }, async ($, e) => {
    if (e.args.trim() === '') return { text: 'Nutzung: /todo Rechnung schreiben' }
    await hinzufuegen($, 'todos', e.args)

    return { text: `To-do gemerkt: ${e.args.trim()}` }
  })

  on('command.run', { command: 'antworten' }, async ($, e) => {
    if (e.args.trim() === '') return { text: 'Nutzung: /antworten Max – Angebot' }
    await hinzufuegen($, 'antworten', e.args)

    return { text: `Gemerkt, dass du noch antworten musst: ${e.args.trim()}` }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const args = e as unknown as Record<string, unknown>
    const liste = args.liste
    const text = args.text
    if ((liste !== 'todos' && liste !== 'antworten') || typeof text !== 'string') {
      return { deny: 'liste muss "todos" oder "antworten" sein, text ein String.' }
    }
    await hinzufuegen($, liste, text)

    return { result: `Auf dem Dashboard unter ${liste} eingetragen: ${text}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const t = await read($, todos)
    const a = await read($, antworten)

    const abschnitt = (
      liste: Liste,
      titel: string,
      eintraege: Eintrag[],
      leer: string,
      platzhalter: string,
    ) => (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>
          {titel} ({eintraege.length})
        </Text>
        {eintraege.length === 0 && <Text dimColor>{leer}</Text>}
        {eintraege.map(eintrag => (
          <Button
            key={`${liste}-${eintrag.id}`}
            plain
            onPress={() => erledigen($, liste, eintrag.id)}
          >
            ☐ {eintrag.text}
          </Button>
        ))}
        <Input
          key={`neu-${liste}`}
          placeholder={platzhalter}
          submitLabel="hinzufügen"
          onSubmit={wert => hinzufuegen($, liste, wert)}
        />
      </Box>
    )

    return (
      <Box flexDirection="column">
        {abschnitt('todos', 'To-dos', t, 'Nichts zu tun.', 'Neues To-do …')}
        {abschnitt(
          'antworten',
          'Noch antworten',
          a,
          'Du bist niemandem eine Antwort schuldig.',
          'Wem, worum …',
        )}
        <Text dimColor>Klick auf einen Eintrag hakt ihn ab.</Text>
      </Box>
    )
  })
}
