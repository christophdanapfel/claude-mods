import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['desktop'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

const USAGE = {
  input_tokens: 10,
  output_tokens: 7,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

type Anfrage = { model: string; system?: string; prompt: string }

async function starte($: Engine, on: On, antwortet = true) {
  const anfragen: Anfrage[] = []
  const status: (string | undefined)[] = []
  mock.store(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__modell-sparen__${e.name}` } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Basis', scope: 'shared' as const }] }))
  on('ui.status', (_, e) => {
    status.push((e as { text?: string }).text)
    return { value: undefined }
  })
  on('model.complete', (_, e) => {
    anfragen.push({ model: e.model, system: e.system, prompt: e.prompt })
    return antwortet
      ? { value: { isAnswered: true as const, text: 'Hello', usage: USAGE } }
      : { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage: USAGE } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return { anfragen, status }
}

test('die Regel steht im Systemprompt', async ($, on) => {
  await starte($, on)
  const r = await $.prompt.compose(COMPOSE)
  expect(r.sections.map(s => s.id)).toEqual(['intro', 'modell-sparen:regel'])
  expect(r.sections[1].text).toContain('mcp__modell-sparen__einfach')
})

test('das Werkzeug fragt Haiku mit passender Anweisung', async ($, on) => {
  const { anfragen } = await starte($, on)
  const r = await $.tool.call({
    tool: 'mcp__modell-sparen__einfach',
    aufgabe: 'uebersetzen',
    text: 'Hallo',
    ziel: 'Englisch',
  } as never)
  expect(r.result).toBe('Hello')
  expect(anfragen.length).toBe(1)
  expect(anfragen[0].model).toBe('haiku')
  expect(anfragen[0].prompt).toBe('Hallo')
  expect(anfragen[0].system).toContain('Übersetze')
  expect(anfragen[0].system).toContain('Ziel: Englisch')
})

test('falsche Eingaben werden abgelehnt, ohne Haiku zu fragen', async ($, on) => {
  const { anfragen } = await starte($, on)
  for (const falsch of [
    { aufgabe: 'frei', text: 'x' },
    { aufgabe: 'programmieren', text: 'x' },
    { aufgabe: 'zusammenfassen', text: '' },
  ]) {
    const r = await $.tool.call({ tool: 'mcp__modell-sparen__einfach', ...falsch } as never)
    expect(r.deny).toBeDefined()
  }
  expect(anfragen.length).toBe(0)
})

test('antwortet Haiku nicht, bekommt Claude eine klare Meldung', async ($, on) => {
  await starte($, on, false)
  const r = await $.tool.call({
    tool: 'mcp__modell-sparen__einfach',
    aufgabe: 'zusammenfassen',
    text: 'Langer Text',
  } as never)
  expect(r.deny).toContain('empty-reply')
})

test('/haiku erledigt eine freie Aufgabe und zählt mit', async ($, on) => {
  const { anfragen } = await starte($, on)
  const r = await $.command.run({ command: 'haiku', args: 'übersetze ins Englische: Hallo' })
  expect(r.text).toBe('Hello')
  expect(anfragen[0].system).toContain('einfache Textaufgabe')
  await $.command.run({ command: 'haiku', args: 'fasse zusammen: abc' })

  const stand = await $.command.run({ command: 'haiku', args: '' })
  expect(stand.text).toContain('2 Aufgaben')
  expect(stand.text).toContain('14 Tokens')
})
