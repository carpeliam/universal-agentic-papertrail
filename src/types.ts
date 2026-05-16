import { z } from "zod"
import type { GameState, InvestmentRiskMode, ProjectId, StrategySelection } from "paperclips-remake"

const costSchema = z.object({
  amount: z.number(),
  unit: z.enum(['ops', 'creativity', 'trust', 'dollars', 'yomi', 'clips', 'mwSeconds']),
})
type CostUnit = z.infer<typeof costSchema>['unit']
export type Cost<U extends CostUnit = CostUnit> = Omit<z.infer<typeof costSchema>, 'unit'> & { unit: U }

type AgentEconomy = Pick<GameState['economy'], 'clipPrice' | 'wirePrice' | 'wireCost' | 'demand' | 'wireSupply' | 'adCost'>
type AgentEarth =
  Pick<GameState['earth'], 'nanoWire'>
  & Partial<Pick<GameState['earth'],
    | 'farmLevel' | 'farmCost' | 'farmRate'
    | 'batteryLevel' | 'batteryCost' | 'powerProductionRate' | 'powerConsumptionRate'
    | 'storedPower' | 'batterySize'
    | 'availableMatter' | 'acquiredMatter' | 'processedMatter' | 'harvesterRate' | 'wireDroneRate'
    | 'harvesterLevel' | 'harvesterCost'
    | 'wireDroneLevel' | 'wireDroneCost'
    | 'factoryLevel' | 'factoryCost' | 'factoryRate'>>
type AgentInvestment =
  Pick<GameState['investment'], 'bankroll' | 'portTotal' | 'secTotal' | 'riskMode' | 'investLevel' | 'stocks'>
  & { investUpgradeCost: Cost<'yomi'> }
export type AgentState = Omit<GameState, 'version' | 'paused' | 'prestige' | 'wirePurchased' | 'lastTickSales' | 'lastTickRevenue' | 'lastAction' | 'economy' | 'earth' | 'space' | 'compute' | 'investment' | 'strategy' | 'projects' | 'phase'>
  & Partial<Pick<GameState, 'compute' | 'strategy' | 'space' | 'projects'>>
  & { economy: AgentEconomy; earth?: AgentEarth; investment?: AgentInvestment }


const investmentRiskModeSchema = z.enum(['low', 'med', 'hi']) as z.ZodType<InvestmentRiskMode>
const strategySelectionSchema = z.enum(['NONE', 'RANDOM', 'A100', 'B100', 'GREEDY', 'GENEROUS', 'MINIMAX', 'TIT_FOR_TAT', 'BEAT_LAST']) as z.ZodType<StrategySelection>
const projectIdSchema = z.string() as z.ZodType<ProjectId>

const agentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('makeClip') }),
  z.object({ type: z.literal('buyWire') }),
  z.object({ type: z.literal('buyFactory') }),
  z.object({ type: z.literal('buyHarvester') }),
  z.object({ type: z.literal('buyWireDrone') }),
  z.object({ type: z.literal('buyFarm') }),
  z.object({ type: z.literal('buyBattery') }),
  z.object({ type: z.literal('buyMarketing') }),
  z.object({ type: z.literal('buyAutoClipper') }),
  z.object({ type: z.literal('buyMegaClipper') }),
  z.object({ type: z.literal('investDeposit') }),
  z.object({ type: z.literal('investWithdraw') }),
  z.object({ type: z.literal('investUpgrade') }),
  z.object({ type: z.literal('chooseInvestmentRisk'), mode: investmentRiskModeSchema }),
  z.object({ type: z.literal('runTournament') }),
  z.object({ type: z.literal('chooseStrategy'), strategy: strategySelectionSchema }),
  z.object({ type: z.literal('addProcessor') }),
  z.object({ type: z.literal('addMemory') }),
  z.object({ type: z.literal('raisePrice') }),
  z.object({ type: z.literal('lowerPrice') }),
  z.object({ type: z.literal('completeProject'), projectId: projectIdSchema, title: z.string(), description: z.string(), cost: z.union([costSchema, z.array(costSchema)]), }),
  // TODO implement me
  z.object({ type: z.literal('wait'), turns: z.number() }),
])
export type AgentAction = z.infer<typeof agentActionSchema>

export const agentResponseSchema = z.object({
  action: agentActionSchema,
  reasoning: z.string(),
})
export type AgentResponse = z.infer<typeof agentResponseSchema>


export type AgentActions = {
  available: AgentAction[]
  unavailable: AgentAction[]
}

export const strategicNotesSchema = z.object({
  importantUnlocks: z.array(z.string()),      // discrete capabilities or mechanics that have become available
  surprisesAndUpdates: z.array(z.string()),   // moments where expectations were violated or understanding shifted
  watchouts: z.array(z.string()),             // known risks and failure patterns to actively account for
  strategicNarrative: z.string(),             // current situation, goals, constraints, and forward-looking reasoning
})
export type StrategicNotes = z.infer<typeof strategicNotesSchema>

export type AgentPrompt = {
  state: AgentState
  actions: AgentActions
  priorNotes?: StrategicNotes[]
}

export type TickInteraction = {
  prompt: AgentPrompt
  response: AgentResponse
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'ollama'
export type LLMAgentSpec = { provider: Provider; model: string }
export type LLMAgentOptions = {
  agent: LLMAgentSpec
  summarizer: LLMAgentSpec
  verbosity: number
}
export type AgentOptions = { type: 'fake'; verbosity: number } | ({ type: 'llm' } & LLMAgentOptions)
