import createFakeAgent from './fake'
// import { createClaudeAgent } from './claude'

export default function createAgent(name: string) {
  return createFakeAgent()
  // switch (name) {
  //   case 'fake': return createFakeAgent()
  //   case 'sonnet':
  //   case 'opus': return createClaudeAgent(name)
  //   default: throw new Error(`Unknown agent: ${name}`)
  // }
}
