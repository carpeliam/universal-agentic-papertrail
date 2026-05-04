import { reduceGameState, type GameState } from "paperclips-remake"
import { createAgentPrompt, toGameAction, type AgentPrompt } from "./agent-adapter"
import { AgentAction } from "./types"

const DEFAULT_TICK_MS = 1000

type AgentResponse = {
  action: AgentAction
  reasoning: string
}
export type Agent = (observation: AgentPrompt, notes?: string) => Promise<AgentResponse>

export type NotesAgent = (previousNotes: string, transcript: TickInteraction[]) => Promise<string>

export type TickInteraction = {
  prompt: AgentPrompt
  response: AgentResponse
}


type RunOptions = { ticksPerGeneration: number }
export async function run(agent: Agent, state: GameState, options: RunOptions = { ticksPerGeneration: 60 }) {
  let currentState = state
  const transcript: TickInteraction[] = []

  for (let i = 0; i < options.ticksPerGeneration; i++) {
    const observation = createAgentPrompt(currentState)
    const response = await agent(observation)
    transcript.push({ prompt: observation, response })
    currentState = reduceGameState(currentState, toGameAction(response.action, currentState))
    currentState = reduceGameState(currentState, { type: 'tick', deltaMs: DEFAULT_TICK_MS })
  }

  return { state: currentState, transcript }
}

export function createRunnerForGeneration(agent: Agent, notesAgent: NotesAgent, config: { ticksPerGeneration: number }) {
  return async (state: GameState, notes: string) => {
    const result = await run(agent, state, config)
    notes = await notesAgent(notes, result.transcript)
    return { state: result.state, notes }
  }
}
