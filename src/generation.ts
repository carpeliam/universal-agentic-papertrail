import type { GameState } from "paperclips-remake"
import type { AgentPrompt, AgentResponse, StrategicNotes, TickInteraction } from "./types"
import type { DispatchFn } from "./dispatch"
import { actionDuration, createAgentPrompt, toGameActions } from "./agent-adapter"
import { capture, isGameOver } from "./metrics"

export type Agent = (prompt: AgentPrompt, notes?: string) => Promise<AgentResponse>

export type NotesAgent = (priorNotes: StrategicNotes[], transcript: TickInteraction[]) => Promise<StrategicNotes>

type RunOptions = { ticksPerGeneration: number }
export interface RunResults {
  state: GameState
  transcript: TickInteraction[]
}
export async function run(agent: Agent, dispatch: DispatchFn, state: GameState, priorNotes: StrategicNotes[], options: RunOptions = { ticksPerGeneration: 60 }): Promise<RunResults> {
  let currentState = state
  const transcript: TickInteraction[] = []

  for (let i = 0; i < options.ticksPerGeneration; i++) {
    if (isGameOver(state)) {
      break
    }
    const prompt = createAgentPrompt(currentState, i === 0 ? priorNotes : undefined)
    const response = await agent(prompt)
    transcript.push({ prompt, response })
    for (const action of toGameActions(response.action, currentState)) {
      currentState = await dispatch(currentState, action)
    }
    currentState = await dispatch(currentState, { type: 'tick', deltaMs: actionDuration(response.action) })
  }

  return { state: currentState, transcript }
}

export function createRunner(agent: Agent, notesAgent: NotesAgent, dispatch: DispatchFn, config: { ticksPerGeneration: number } = { ticksPerGeneration: 60 }) {
  return async (priorState: GameState, priorNotes: StrategicNotes[]) => {
    const { state, transcript } = await capture(() => run(agent, dispatch, priorState, priorNotes, config))
    const notes = await notesAgent(priorNotes, transcript)
    return { state, notes }
  }
}
