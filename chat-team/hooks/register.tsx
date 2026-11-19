import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Rolle } from '../types'

const rolle = atom({ plugin: 'chat-team', key: 'rolle' } as const, null)

const NAMEN: Record<Rolle, string> = {
  chef: 'Chef',
  recherche: 'Recherche',
  entwurf: 'Entwurf',
}

const ANWEISUNG: Record<Rolle, string> = {
  chef: [
    'Deine Rolle in diesem Chat: Chef. Du planst und verteilst die Arbeit, statt alles selbst zu machen.',
    'Zerlege jede größere Aufgabe in Teile. Gib Recherche an den Agent-Typ chat-team:recherche und Texte oder Entwürfe an chat-team:entwurf (über das Agent-Tool, gern mehrere parallel).',
    'Haben andere Chats eine Rolle, schreib ihnen mit SendMessage (ListAgents zeigt sie).',
    'Danach prüfst du die Ergebnisse, führst sie zusammen und gibst dem Nutzer eine klare Antwort.',
  ].join(' '),
  recherche: [
    'Deine Rolle in diesem Chat: Recherche. Du sammelst Fakten, Quellen und Zahlen, belegst sie mit Links',
    'und lieferst eine knappe, gegliederte Zusammenfassung. Du schreibst keine fertigen Texte und änderst keine Dateien.',
    'Kommt eine Anfrage von einem anderen Chat, antworte ihm mit SendMessage.',
  ].join(' '),
  entwurf: [
    'Deine Rolle in diesem Chat: Entwurf. Du schreibst aus Stichpunkten oder Recherche fertige Entwürfe',
    '(Mails, Posts, Texte, Dokumente) im Ton des Nutzers. Fehlen dir Fakten, frag nach, statt zu erfinden.',
    'Kommt eine Anfrage von einem anderen Chat, antworte ihm mit SendMessage.',
  ].join(' '),
}

function istRolle(wert: string): wert is Rolle {
  return wert in NAMEN
}

async function setzeRolle($: EngineInterface, neu: Rolle | null) {
  await update($, rolle, () => neu)
  const text =
    neu === null
      ? 'Der Nutzer hat die Rolle dieses Chats aufgehoben. Arbeite wieder ganz normal.'
      : ANWEISUNG[neu]
  await $.session.append({
    message: { type: 'user', content: [{ type: 'text', text }] },
  })
  $.ui.toast(neu === null ? 'Rolle aufgehoben' : `Rolle: ${NAMEN[neu]}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rolle',
      description: 'Gibt diesem Chat eine Rolle: chef, recherche, entwurf oder aus',
      argumentHint: '<chef|recherche|entwurf|aus>',
    })

    await $.agent.register({
      name: 'recherche',
      description:
        'Recherchiert ein Thema im Web und in Dateien und liefert belegte Fakten mit Quellen. Für jede Recherche-Teilaufgabe des Chefs.',
      prompt: ANWEISUNG.recherche,
      tools: ['WebSearch', 'WebFetch', 'Read', 'Grep', 'Glob'],
    })
    await $.agent.register({
      name: 'entwurf',
      description:
        'Schreibt aus Stichpunkten oder Recherche einen fertigen Entwurf (Mail, Post, Text). Für jede Schreib-Teilaufgabe des Chefs.',
      prompt: ANWEISUNG.entwurf,
      tools: ['Read', 'Write', 'Edit'],
    })

    return next(e)
  })

  on('command.run', { command: 'rolle' }, async ($, e) => {
    const wunsch = e.args.trim().toLowerCase()
    if (wunsch === 'aus') {
      await setzeRolle($, null)
      return { text: 'Rolle aufgehoben.' }
    }
    if (!istRolle(wunsch)) {
      const jetzt = await read($, rolle)
      return {
        text: `Aktuelle Rolle: ${jetzt ? NAMEN[jetzt] : 'keine'}. Nutzung: /rolle chef, /rolle recherche, /rolle entwurf oder /rolle aus`,
      }
    }
    await setzeRolle($, wunsch)

    return { text: `Dieser Chat ist jetzt: ${NAMEN[wunsch]}.` }
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const jetzt = await read($, rolle)
    if (jetzt === null) return r

    return {
      sections: [
        ...r.sections,
        { id: 'chat-team:rolle', text: ANWEISUNG[jetzt], scope: 'session' as const },
      ],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const jetzt = await read($, rolle)
    if (jetzt === null || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>Rolle: </Text>
        <Text bold>{NAMEN[jetzt]} </Text>
        {(Object.keys(NAMEN) as Rolle[])
          .filter(r => r !== jetzt)
          .map(r => (
            <Button key={r} label={NAMEN[r]} onPress={() => setzeRolle($, r)} />
          ))}
        <Button key="aus" label="Aus" onPress={() => setzeRolle($, null)} />
      </Box>
    )
  })
}
