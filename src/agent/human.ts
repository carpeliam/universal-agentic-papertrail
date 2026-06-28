import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { z } from 'zod'
import { displayPrompt } from './markdown-adapter'
import { agentActionSchema } from '@/types'
import type { AgentTeam } from '.'
import type { AgentAction, AgentPrompt } from '@/types'

export default function createRepl({ planMode }: { planMode: boolean }): AgentTeam {
  const schema = (planMode) ? z.array(agentActionSchema) : agentActionSchema
  return {
    createPlayer() {
      return {
        async play(prompt: AgentPrompt) {
          const markdown = displayPrompt(prompt)
          console.log(markdown)
          const rl = readline.createInterface({ input: stdin, output: stdout })
          let plan: AgentAction[]
          while (true) {
            const response = await rl.question('Action Plan> ')
            try {
              plan = JSON.parse(response)
              schema.parse(plan)
              rl.close()
              return { plan }
            } catch (error) {
              console.error("Validation failed:", error, 'Please submit again.')
            }
          }
        },
        canContinue() { return true }
      }
    },
    async summarize() {
      return { truths: [], openQuestions: [], corrections: [], situation: '' }
    }
  }
}
