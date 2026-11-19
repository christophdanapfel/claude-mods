import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  plugin: 'chat-team',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['desktop'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

const BASIS = { id: 'intro', text: 'Basis', scope: 'shared' as const }

async function starte($: Engine, on: On) {
  const agenten: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('agent.register', (_, e) => {
    agenten.push(e.name)
    return { value: { agent: `chat-team:${e.name}` } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.compose', () => ({ sections: [BASIS] }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const sitzung = mock.session(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return { agenten, sitzung }
}

test('registriert die Helfer recherche und entwurf', async ($, on) => {
  const { agenten } = await starte($, on)
  expect(agenten).toEqual(['recherche', 'entwurf'])
})

test('ohne Rolle: kein Band, kein Prompt-Zusatz', async ($, on) => {
  await starte($, on)
  const r = await $.prompt.compose(COMPOSE)
  expect(r.sections.map(s => s.id)).toEqual(['intro'])
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Rolle/ })).toBeUndefined()
  await ui.unmount()
})

test('/rolle chef setzt Rolle, Anweisung und Band', async ($, on) => {
  const { sitzung } = await starte($, on)
  const r = await $.command.run({ command: 'rolle', args: 'Chef' })
  expect(r.text).toBe('Dieser Chat ist jetzt: Chef.')

  const zeilen = sitzung.appended()
  expect(zeilen.length).toBe(1)
  expect(JSON.stringify(zeilen[0].message.content)).toContain('Rolle in diesem Chat: Chef')

  const p = await $.prompt.compose(COMPOSE)
  expect(p.sections.map(s => s.id)).toEqual(['intro', 'chat-team:rolle'])
  expect(p.sections[1].text).toContain('chat-team:recherche')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Chef/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'recherche' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'chef' })).toBeUndefined()
    await ui.unmount()
  }
})

test('Knopf im Band wechselt die Rolle, Aus hebt sie auf', async ($, on) => {
  const { sitzung } = await starte($, on)
  await $.command.run({ command: 'rolle', args: 'chef' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'entwurf' })
  expect(await ui.find({ type: 'Text', text: /Entwurf/ })).toBeDefined()
  const p = await $.prompt.compose(COMPOSE)
  expect(p.sections[1].text).toContain('Rolle in diesem Chat: Entwurf')

  await ui.press({ key: 'aus' })
  expect(await ui.find({ type: 'Text', text: /Rolle/ })).toBeUndefined()
  expect((await $.prompt.compose(COMPOSE)).sections.length).toBe(1)
  expect(sitzung.appended().length).toBe(3)
  await ui.unmount()
})

test('/rolle ohne gültigen Namen erklärt sich und ändert nichts', async ($, on) => {
  const { sitzung } = await starte($, on)
  const r = await $.command.run({ command: 'rolle', args: 'pirat' })
  expect(r.text).toContain('Aktuelle Rolle: keine')
  expect(sitzung.appended().length).toBe(0)
})
