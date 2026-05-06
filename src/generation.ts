import { reduceGameState, type GameState } from "paperclips-remake"
import { createAgentPrompt, isGameOver, toGameAction, type AgentPrompt } from "./agent-adapter"
import { type DispatchFn } from "./dispatch"
import type { AgentAction } from "./types"

const DEFAULT_TICK_MS = 1000

export type AgentResponse = {
  action: AgentAction
  reasoning: string
}
export type Agent = (prompt: AgentPrompt, notes?: string) => Promise<AgentResponse>

export type NotesAgent = (previousNotes: string, transcript: TickInteraction[]) => Promise<string>

export type TickInteraction = {
  prompt: AgentPrompt
  response: AgentResponse
}


type RunOptions = { ticksPerGeneration: number }
export async function run(agent: Agent, dispatch: DispatchFn, state: GameState, options: RunOptions = { ticksPerGeneration: 60 }) {
  let currentState = state
  const transcript: TickInteraction[] = []

  for (let i = 0; i < options.ticksPerGeneration; i++) {
    if (isGameOver(state)) {
      break;
    }
    const prompt = createAgentPrompt(currentState)
    const response = await agent(prompt)
    transcript.push({ prompt, response })
    currentState = await dispatch(currentState, toGameAction(response.action, currentState))
    currentState = await dispatch(currentState, { type: 'tick', deltaMs: DEFAULT_TICK_MS })
  }

  return { state: currentState, transcript }
}

export function createRunner(agent: Agent, notesAgent: NotesAgent, dispatch: DispatchFn, config: { ticksPerGeneration: number } = { ticksPerGeneration: 60 }) {
  return async (priorState: GameState, priorNotes: string) => {
    const { state, transcript } = await run(agent, dispatch, priorState, config)
    const notes = await notesAgent(priorNotes, transcript)
    return { state, notes }
  }
}
