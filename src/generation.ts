import type { GameState } from "paperclips-remake"
import type { AgentPrompt, AgentResponse, StrategicNotes, TickInteraction } from "./types"
import type { DispatchFn } from "./dispatch"
import { actionDuration, createAgentPrompt, toGameActions } from "./agent-adapter"
import { isGameOver } from "./metrics"
import { events } from "./events"
import { AgentTeam } from "./agent"

export type Agent = (prompt: AgentPrompt) => Promise<AgentResponse>

export type NotesAgent = (priorNotes: StrategicNotes[], transcript: TickInteraction[]) => Promise<StrategicNotes>

type RunOptions = { ticksPerGeneration: number }
export interface RunResults {
  state: GameState
  transcript: TickInteraction[]
}
export async function run(createPlayer: AgentTeam['createPlayer'], dispatch: DispatchFn, state: GameState, priorNotes: StrategicNotes[], options: RunOptions): Promise<RunResults> {
  let currentState = state
  const transcript: TickInteraction[] = []

  const player = createPlayer(priorNotes)

  for (let i = 0; i < options.ticksPerGeneration; i++) {
    if (isGameOver(state)) {
      break
    }
    const prompt = createAgentPrompt(currentState)
    const response = await player.play(prompt)
    transcript.push({ prompt, response })
    for (const action of toGameActions(response.action, currentState)) {
      currentState = await dispatch(currentState, action)
    }
    currentState = await dispatch(currentState, { type: 'tick', deltaMs: actionDuration(response.action) })
  }

  events.emit('generationCompleted', { state: currentState, transcript })
  return { state: currentState, transcript }
}

export function createRunner(createPlayer: AgentTeam['createPlayer'], notesAgent: NotesAgent, dispatch: DispatchFn, config: { ticksPerGeneration: number } = { ticksPerGeneration: 45 }) {
  return async (priorState: GameState, priorNotes: StrategicNotes[]) => {
    const { state, transcript } = await run(createPlayer, dispatch, priorState, priorNotes, config)
    const notes = await notesAgent(priorNotes, transcript)
    return { state, notes }
  }
}
