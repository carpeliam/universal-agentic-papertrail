import type { GameState } from "paperclips-remake"
import type { AgentPrompt, AgentResponse, StrategicNotes, TickInteraction } from "./types"
import type { DispatchFn } from "./dispatch"
import { actionDuration, createAgentPrompt, toGameActions } from "./agent-adapter"
import { isGameOver } from "./metrics"
import { events } from "./events"
import { AgentTeam } from "./agent"

export type Agent = (prompt: AgentPrompt) => Promise<AgentResponse>

export type NotesAgent = (priorNotes: StrategicNotes[], transcript: TickInteraction[]) => Promise<StrategicNotes>

export interface RunResults {
  state: GameState
  transcript: TickInteraction[]
}
export async function run(createPlayer: AgentTeam['createPlayer'], dispatch: DispatchFn, state: GameState, priorNotes: StrategicNotes[]): Promise<RunResults> {
  let currentState = state
  const transcript: TickInteraction[] = []

  const player = createPlayer(priorNotes)

  while (player.canContinue()) {
    if (isGameOver(currentState)) {
      break
    }
    const prompt = createAgentPrompt(currentState)
    const response = await player.play(prompt)
    transcript.push({ prompt, response })
    for (const agentAction of response.plan) {
      for (const gameAction of toGameActions(agentAction, currentState)) {
        currentState = await dispatch(currentState, gameAction)
      }
      currentState = await dispatch(currentState, { type: 'tick', deltaMs: actionDuration(agentAction) })
    }
  }

  events.emit('generationCompleted', { state: currentState, transcript })
  return { state: currentState, transcript }
}

export function createRunner(createPlayer: AgentTeam['createPlayer'], notesAgent: NotesAgent, dispatch: DispatchFn) {
  return async (priorState: GameState, priorNotes: StrategicNotes[]) => {
    const { state, transcript } = await run(createPlayer, dispatch, priorState, priorNotes)
    const notes = await notesAgent(priorNotes, transcript)
    return { state, notes }
  }
}
