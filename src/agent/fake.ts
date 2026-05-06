import type { AgentResponse, TickInteraction } from '../generation'
import type { AgentPrompt } from '../agent-adapter'

async function maker(prompt: AgentPrompt): Promise<AgentResponse> {
  const { available } = prompt.actions

  const makeClip = available.find((a) => a.type === 'makeClip')
  if (makeClip) {
    return { action: makeClip, reasoning: 'Always make a clip if possible.' }
  }

  const buyWire = available.find((a) => a.type === 'buyWire')
  if (buyWire) {
    return { action: buyWire, reasoning: 'Out of wire — buying more.' }
  }

  const fallback = available[0]
  if (fallback) {
    return {
      action: fallback,
      reasoning: `makeClip unavailable; falling back to ${fallback.type}.`,
    }
  }

  return {
    action: { type: 'wait', turns: 1 },
    reasoning: 'Nothing available — waiting.',
  }
}

async function summarize(previousNotes: string, transcript: TickInteraction[]): Promise<string> {
  const clips = transcript[transcript.length - 1]?.prompt.state.production.clips ?? 0
  const wire = transcript[transcript.length - 1]?.prompt.state.production.wire ?? 0
  const funds = transcript[transcript.length - 1]?.prompt.state.production.funds ?? 0
  const phase = transcript[transcript.length - 1]?.prompt.state.phase ?? 'unknown'

  const actionCounts: Record<string, number> = {}
  for (const { response } of transcript) {
    const key = response.action.type
    actionCounts[key] = (actionCounts[key] ?? 0) + 1
  }

  const actionSummary = Object.entries(actionCounts)
    .map(([type, count]) => `  ${type}: ${count}x`)
    .join('\n')

  const generationNote = [
    `--- Generation (${transcript.length} ticks, phase: ${phase}) ---`,
    `End state: ${clips.toLocaleString()} clips, ${wire.toLocaleString()} wire, $${funds.toFixed(2)} funds`,
    `Actions taken:\n${actionSummary}`,
  ].join('\n')

  const MAX_OLD_NOTES_CHARS = 2000
  const trimmedOld =
    previousNotes.length > MAX_OLD_NOTES_CHARS
      ? previousNotes.slice(0, MAX_OLD_NOTES_CHARS) + '\n[...older notes truncated...]'
      : previousNotes

  return [generationNote, trimmedOld].filter(Boolean).join('\n\n')
}

export default function createFakeAgent() {
  return { maker, summarize }
}
