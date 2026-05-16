import createAiAgent from './vercel'
import createFakeAgent from './fake'
import type { AgentOptions } from '@/types'

export default function createAgent(options: AgentOptions) {
  switch (options.type) {
    case 'fake': return createFakeAgent()
    default: return createAiAgent(options)
  }
}
