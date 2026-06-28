import createAiAgent from './vercel'
import createFakeAgent from './fake'
import createRepl from './human'
import type { AgentOptions, AgentPrompt, AgentResponse, StrategicNotes, TickInteraction } from '@/types'

export interface Player {
  play(prompt: AgentPrompt): Promise<AgentResponse>
  canContinue(): boolean
}

export interface AgentTeam {
  createPlayer(priorNotes: StrategicNotes[]): Player
  summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes>
}

export default function createAgent(options: AgentOptions): AgentTeam {
  switch (options.type) {
    case 'fake': return createFakeAgent()
    case 'human': return createRepl(options)
    default: return createAiAgent(options)
  }
}
