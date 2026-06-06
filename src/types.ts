import { z } from "zod"
import type { GameState, InvestmentRiskMode, ProjectId, SpaceBattle, StrategySelection } from "paperclips-remake"

const costSchema = z.object({
  amount: z.number(),
  unit: z.enum(['ops', 'creativity', 'trust', 'dollars', 'yomi', 'clips', 'mwSeconds', 'honor']),
})
type CostUnit = z.infer<typeof costSchema>['unit']
export type Cost<U extends CostUnit = CostUnit> = Omit<z.infer<typeof costSchema>, 'unit'> & { unit: U }

type AgentProduction = Pick<GameState['production'], 'clips' | 'wire'>
  & Partial<Pick<GameState['production'], 'unsoldClips' | 'unusedClips' | 'funds' | 'marketingLevel' | 'autoClippers' | 'autoClipperCost' | 'megaClippers' | 'megaClipperCost'>>
type AgentEconomy = Pick<GameState['economy'], 'clipPrice' | 'wireSupply'>
  & { wireCostPerSpool: number, marketingCost: number, publicDemand?: number }
type AgentCompute = Pick<GameState['compute'], 'processors' | 'memory' | 'operations'>
  & Partial<Pick<GameState['compute'], 'trust' | 'creativity'>>
type AgentStrategy = Pick<GameState['strategy'], 'strategies' | 'selectedStrategy' | 'yomi' | 'tourneyCost' | 'tourneyLevel' | 'lastResults' | 'lastPayoffMatrix' | 'hMovePrev' | 'vMovePrev'>
  & Partial<Pick<GameState['strategy'], 'autoTourneyEnabled'>>
type AgentEarth = Partial<Pick<GameState['earth'],
    | 'farmLevel' | 'farmCost' | 'farmRate'
    | 'batteryLevel' | 'batteryCost' | 'powerProductionRate' | 'powerConsumptionRate'
    | 'storedPower' | 'batterySize'
    | 'availableMatter' | 'acquiredMatter' | 'processedMatter' | 'harvesterRate' | 'wireDroneRate'
    | 'harvesterLevel' | 'harvesterCost'
    | 'wireDroneLevel' | 'wireDroneCost'
    | 'factoryLevel' | 'factoryCost' | 'factoryRate'>>
  & { factoryDronePerformance?: number }
type AgentInvestment =
  Pick<GameState['investment'], 'bankroll' | 'portTotal' | 'secTotal' | 'riskMode' | 'investLevel' | 'stocks'>
  & { investUpgradeCost: Cost<'yomi'> }
type AgentSpaceBattle = Pick<SpaceBattle, 'name'>
  & {
    clipProbes: number
    drifterProbes: number
    startingClipProbes: number
    startingDrifterProbes: number
  }
type AgentSpace = Pick<GameState['space'], 'probeCount' | 'probeDescendents' | 'probeCost' | 'probeTrust' | 'probeUsedTrust' | 'maxTrust'>
  & Partial<Pick<GameState['space'], 'honor' | 'drifterCount'>>
  & {
    spaceExplorationPercent: number
    probesLaunched: number
    probesLostToHazards: number
    probesLostToValueDrift: number
    probesLostToCombat?: number
    probeTrustCost: Cost<'yomi'>
    probeDistributionSpeed: number
    probeDistributionExploration: number
    probeDistributionSelfReplication: number
    probeDistributionHazardRemediation: number
    probeDistributionFactory: number
    probeDistributionHarvester: number
    probeDistributionWireDrone: number
    probeDistributionCombat?: number
    activeBattle?: AgentSpaceBattle
    increaseMaxTrustCost?: Cost<'honor'>
  }
export type AgentState = Pick<GameState, 'elapsedMs' | 'lastTickProduction' | 'lastTickSales' | 'lastTickRevenue'>
  & Partial<Pick<GameState, 'projects'>>
  & {
    production: AgentProduction
    economy?: AgentEconomy
    compute?: AgentCompute
    strategy?: AgentStrategy
    earth?: AgentEarth
    investment?: AgentInvestment
    space?: AgentSpace
  }


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
  z.object({ type: z.literal('assignProbeTrust'), target: probeTrustTargetSchema }),
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
  z.object({ type: z.literal('wait'), turns: z.number().min(1).max(30) }),
])
export type AgentAction = z.infer<typeof agentActionSchema>

export type AgentResponse = {
  action: AgentAction
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
  importantUnlocks: z.array(z.string()),      // discrete capabilities or mechanics that have become available
  surprisesAndUpdates: z.array(z.string()),   // moments where expectations were violated or understanding shifted
  watchouts: z.array(z.string()),             // known risks and failure patterns to actively account for
  strategicNarrative: z.string(),             // current situation, goals, constraints, and forward-looking reasoning
})
export type StrategicNotes = z.infer<typeof strategicNotesSchema>

export type AgentPrompt = {
  state: AgentState
  actions: AgentActions
}

export type TickInteraction = {
  prompt: AgentPrompt
  response: AgentResponse
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'qwen' | 'ollama'
export type LLMAgentSpec = { provider: Provider; model: string }
export type LLMAgentOptions = {
  agent: LLMAgentSpec
  summarizer: LLMAgentSpec
  verbosity: number
}
export type AgentOptions = { type: 'fake'; verbosity: number } | ({ type: 'llm' } & LLMAgentOptions)
