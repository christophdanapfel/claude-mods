import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'dashboard',
  component: 'Pane',
  requestId: 'dashboard',
  props: {
    title: 'Dashboard',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

async function starte($: Engine, on: On) {
  mock.store(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__dashboard__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

test('leeres Dashboard zeigt beide Listen leer', async ($, on) => {
  await starte($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Nichts zu tun/ }))?.text).toBe('Nichts zu tun.')
    expect(await ui.find({ type: 'Text', text: /niemandem/ })).toBeDefined()
    await ui.unmount()
  }
})

test('/todo und /antworten tragen ein, Klick hakt ab', async ($, on) => {
  await starte($, on)
  const r = await $.command.run({ command: 'todo', args: 'Rechnung schreiben' })
  expect(r.text).toBe('To-do gemerkt: Rechnung schreiben')
  await $.command.run({ command: 'antworten', args: 'Max – Angebot' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const knopf = await ui.find({ type: 'Button', text: /Rechnung/ })
  expect(knopf).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /Max/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /To-dos \(1\)/ })).toBeDefined()

  await ui.press({ key: knopf!.key! })
  expect(await ui.find({ type: 'Button', text: /Rechnung/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Nichts zu tun/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /Max/ })).toBeDefined()
  await ui.unmount()
})

test('Eingabefeld im Pane fügt ein To-do hinzu, leere Eingabe nicht', async ($, on) => {
  await starte($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const vorher = (await ui.findAll({ type: 'Button' })).length
    await ui.input({ key: 'neu-todos', text: '   ' })
    expect((await ui.findAll({ type: 'Button' })).length).toBe(vorher)
    await ui.input({ key: 'neu-todos', text: `Steuer ${surface}` })
    expect(await ui.find({ type: 'Button', text: new RegExp(`Steuer ${surface}`) })).toBeDefined()
    await ui.unmount()
  }
})

test('Claudes Werkzeug trägt ein und lehnt Unsinn ab', async ($, on) => {
  await starte($, on)
  const gut = await $.tool.call({
    tool: 'mcp__dashboard__eintragen',
    liste: 'antworten',
    text: 'Anna – Termin',
  } as never)
  expect(gut.deny).toBeUndefined()
  const schlecht = await $.tool.call({
    tool: 'mcp__dashboard__eintragen',
    liste: 'quatsch',
    text: 'x',
  } as never)
  expect(schlecht.deny).toBeDefined()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', text: /Anna/ })).toBeDefined()
  await ui.unmount()
})

test('Einträge kommen nach einem Neustart aus dem Speicher zurück', async ($, on) => {
  mock.store(on, {
    todos: [{ id: 'a', text: 'Altes To-do' }],
    antworten: [],
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', text: /Altes To-do/ })).toBeDefined()
  await ui.unmount()
})
