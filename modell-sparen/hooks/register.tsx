import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ersparnis } from '../types'

const MODELL = 'haiku'
const TOOL = 'mcp__modell-sparen__einfach'
const STORE_KEY = 'ersparnis'

const ersparnis = atom(
  { plugin: 'modell-sparen', key: 'ersparnis' } as const,
  { aufgaben: 0, tokens: 0 },
)

const AUFGABEN = {
  uebersetzen:
    'Übersetze den folgenden Text. Gib nur die Übersetzung aus, ohne Vorrede.',
  zusammenfassen:
    'Fasse den folgenden Text knapp und vollständig zusammen. Gib nur die Zusammenfassung aus.',
  umformulieren:
    'Formuliere den folgenden Text um. Gib nur den neuen Text aus, ohne Vorrede.',
  frei: 'Erledige die folgende einfache Textaufgabe. Gib nur das Ergebnis aus, ohne Vorrede.',
} as const

type Aufgabe = keyof typeof AUFGABEN

const REGEL = [
  'Modell sparen: Für reine Übersetzungen, Zusammenfassungen und Umformulierungen von Text,',
  `den du schon hast, rufe das Tool ${TOOL} auf, statt den Text selbst zu schreiben.`,
  'Gib sein Ergebnis dann unverändert weiter. Für alles andere (Code, Recherche, Entscheidungen) arbeitest du normal.',
].join(' ')

function istAufgabe(wert: unknown): wert is Aufgabe {
  return typeof wert === 'string' && wert !== 'frei' && wert in AUFGABEN
}

async function frageHaiku(
  $: EngineInterface,
  aufgabe: Aufgabe,
  text: string,
  ziel: string | undefined,
): Promise<{ text: string } | { fehler: string }> {
  const hinweis = ziel ? `\nZiel: ${ziel}` : ''
  const antwort = await $.model.complete({
    model: MODELL,
    system: AUFGABEN[aufgabe] + hinweis,
    prompt: text,
    maxTokens: 8000,
    effort: 'low',
    timeoutMs: 120000,
  })
  if (!antwort.isAnswered) {
    return { fehler: `Haiku hat nicht geantwortet (${antwort.reason}).` }
  }
  const neu = await update($, ersparnis, alt => ({
    aufgaben: alt.aufgaben + 1,
    tokens: alt.tokens + antwort.usage.output_tokens,
  }))
  await $.store.set(STORE_KEY, neu)
  $.ui.status(`Haiku: ${neu.aufgaben} Aufgaben übernommen`)

  return { text: antwort.text }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const gespeichert = (await $.store.get(STORE_KEY)) as Ersparnis | undefined
    if (gespeichert) {
      await update($, ersparnis, () => gespeichert)
      $.ui.status(`Haiku: ${gespeichert.aufgaben} Aufgaben übernommen`)
    }

    await $.tool.register({
      name: 'einfach',
      description:
        'Erledigt Übersetzen, Zusammenfassen oder Umformulieren eines gegebenen Textes günstig mit Haiku. Nutze es für genau diese drei Arbeiten.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          aufgabe: {
            type: 'string',
            enum: ['uebersetzen', 'zusammenfassen', 'umformulieren'],
            description: 'Welche Arbeit',
          },
          text: { type: 'string', description: 'Der zu bearbeitende Text' },
          ziel: {
            type: 'string',
            description:
              'Optional: Zielsprache, Länge oder Stil (z. B. "Englisch", "3 Sätze", "locker")',
          },
        },
        required: ['aufgabe', 'text'],
      },
    })

    await $.command.register({
      name: 'haiku',
      description:
        'Gibt eine einfache Aufgabe direkt an Haiku (z. B. /haiku übersetze ins Englische: Hallo)',
      argumentHint: '<aufgabe: text>',
    })

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)

    return {
      sections: [
        ...r.sections,
        { id: 'modell-sparen:regel', text: REGEL, scope: 'session' as const },
      ],
    }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const args = e as unknown as Record<string, unknown>
    const aufgabe = args.aufgabe
    const text = args.text
    const ziel = typeof args.ziel === 'string' ? args.ziel : undefined
    if (!istAufgabe(aufgabe) || typeof text !== 'string' || text === '') {
      return {
        deny: 'aufgabe muss uebersetzen, zusammenfassen oder umformulieren sein, und text darf nicht leer sein.',
      }
    }
    const r = await frageHaiku($, aufgabe, text, ziel)

    return 'fehler' in r ? { deny: r.fehler } : { result: r.text }
  })

  on('command.run', { command: 'haiku' }, async ($, e) => {
    const eingabe = e.args.trim()
    if (eingabe === '') {
      const stand = await read($, ersparnis)
      return {
        text: `Haiku hat bisher ${stand.aufgaben} Aufgaben übernommen (${stand.tokens} Tokens geschrieben). Nutzung: /haiku übersetze ins Englische: dein Text`,
      }
    }
    const r = await frageHaiku($, 'frei', eingabe, undefined)

    return { text: 'fehler' in r ? r.fehler : r.text }
  })
}
