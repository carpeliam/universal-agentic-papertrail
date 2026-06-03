import createAiAgent from './vercel'
import createFakeAgent from './fake'
import type { AgentOptions, AgentPrompt, AgentResponse, StrategicNotes, TickInteraction } from '@/types'

export interface Player {
  play(prompt: AgentPrompt): Promise<AgentResponse>
}

export interface AgentTeam {
  createPlayer(priorNotes: StrategicNotes[]): Player
  summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes>
}

export default function createAgent(options: AgentOptions): AgentTeam {
  switch (options.type) {
    case 'fake': return createFakeAgent()
    default: return createAiAgent(options)
  }
}
