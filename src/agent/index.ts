import createAiAgent from './vercel'
import createFakeAgent from './fake'
import type { AgentType } from '../types'

export default function createAgent(name: AgentType) {
  switch (name) {
    case 'fake': return createFakeAgent()
    default: return createAiAgent(name)
  }
}
