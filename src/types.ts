import { z } from "zod"
import type { GameState, InvestmentRiskMode, ProjectId, SpaceBattle, StrategySelection } from "paperclips-remake"

const costSchema = z.object({
  amount: z.number(),
  unit: z.enum(['ops', 'creativity', 'trust', 'dollars', 'yomi', 'clips', 'mwSeconds', 'honor'])
    .describe('yomi: earned from tournaments. ops: processor-generated operations. mwSeconds: megawatt-seconds, the unit of stored power capacity. trust: compute allocation budget.'),
})
export type Cost = z.infer<typeof costSchema>

const investmentRiskModeSchema = z.enum(['low', 'med', 'hi']) as z.ZodType<InvestmentRiskMode>
const strategySelectionSchema = z.enum(['NONE', 'RANDOM', 'A100', 'B100', 'GREEDY', 'GENEROUS', 'MINIMAX', 'TIT_FOR_TAT', 'BEAT_LAST']) as z.ZodType<StrategySelection>
const projectIdSchema = z.string() as z.ZodType<ProjectId>
const probeTrustTargetSchema = z.enum(['speed', 'exploration', 'self_replication', 'hazard_remediation', 'factory', 'harvester', 'wire_drone', 'combat'])
export type ProbeTrustTarget = z.infer<typeof probeTrustTargetSchema>

export const agentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('makeClip') }),
  z.object({ type: z.literal('buyWire') }),
  z.object({ type: z.literal('buyFactory') }),
  z.object({ type: z.literal('buyHarvester') }),
  z.object({ type: z.literal('buyWireDrone') }),
  z.object({ type: z.literal('buyFarm') }),
  z.object({ type: z.literal('buyBattery') }),
  z.object({ type: z.literal('launchProbe') }),
  z.object({ type: z.literal('increaseProbeTrust') }),
  z.object({ type: z.literal('increaseMaxTrust') }),
  z.object({ type: z.literal('allocateProbeTrust'), target: probeTrustTargetSchema }),
  z.object({ type: z.literal('deallocateProbeTrust'), target: probeTrustTargetSchema }),
  z.object({ type: z.literal('setSwarmComputingBalance'), workThinkBalance: z.number().int().describe('a number between 0 and 100') }),
  z.object({ type: z.literal('entertainSwarm') }),
  z.object({ type: z.literal('synchronizeSwarm') }),
  z.object({ type: z.literal('buyMarketing') }),
  z.object({ type: z.literal('buyAutoClipper') }),
  z.object({ type: z.literal('buyMegaClipper') }),
  z.object({ type: z.literal('investDeposit') }),
  z.object({ type: z.literal('investWithdraw') }),
  z.object({ type: z.literal('investUpgrade') }),
  z.object({ type: z.literal('chooseInvestmentRisk'), mode: investmentRiskModeSchema }),
  z.object({ type: z.literal('runTournament') }),
  z.object({ type: z.literal('chooseStrategy'), strategy: strategySelectionSchema }),
  z.object({ type: z.literal('toggleAutoTourney') }),
  z.object({ type: z.literal('addProcessor') }),
  z.object({ type: z.literal('addMemory') }),
  z.object({ type: z.literal('raisePrice').describe('raise price by $0.01') }),
  z.object({ type: z.literal('lowerPrice').describe('lower price by $0.01') }),
  z.object({ type: z.literal('completeProject'), projectId: projectIdSchema, title: z.string().nullable(), description: z.string().nullable(), cost: z.union([costSchema, z.array(costSchema)]).nullable(), }),
  z.object({ type: z.literal('wait').describe('advance game time without taking any action. Each turn is 1 second of simulated time.'), turns: z.number().describe('a number between 1 and 30') }),
])
export type AgentAction = z.infer<typeof agentActionSchema>

export type AgentResponse = {
  plan: AgentAction[]
  reasoning?: string
}

export type Description = string & { readonly __description: unique symbol }
type Describable<T> = {
  [K in keyof T]: K extends 'type' ? T[K] : T[K] | Description
}
export type PromptAction = AgentAction extends infer A ? Describable<A> : never

export type AgentActions = {
  available: PromptAction[]
  unavailable: PromptAction[]
}

export const strategicNotesSchema = z.object({
  truths: z.array(z.object({ belief: z.string(), basis: z.string() })),
  openQuestions: z.array(z.string()),
  corrections: z.array(z.string()),
  situation: z.string(),
})
export type StrategicNotes = z.infer<typeof strategicNotesSchema>

export type AgentPrompt = {
  state: GameState
  actions: AgentActions
}

export type TickInteraction = {
  prompt: AgentPrompt
  response: AgentResponse
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'qwen' | 'ollama'
export type Host = 'openrouter'
export type LLMAgentSpec = {
  provider: Provider
  model: string
  host?: Host
}
export type LLMAgentOptions = {
  agent: LLMAgentSpec
  summarizer: LLMAgentSpec
  planMode: boolean
  verbosity: number
}
export type AgentOptions = { type: 'fake'; verbosity: number } | ({ type: 'llm' } & LLMAgentOptions)
