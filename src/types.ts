import { z } from "zod"
import type { GameState, InvestmentRiskMode, ProjectId, SpaceBattle, StrategySelection } from "paperclips-remake"

const costSchema = z.object({
  amount: z.number(),
  unit: z.enum(['ops', 'creativity', 'trust', 'dollars', 'yomi', 'clips', 'mwSeconds', 'honor'])
    .describe('yomi: earned from tournaments. ops: processor-generated operations. mwSeconds: megawatt-seconds, the unit of stored power capacity. trust: compute allocation budget.'),
})

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
  Pick<GameState['investment'], 'bankroll' | 'portTotal' | 'secTotal' | 'riskMode' | 'investLevel' | 'investUpgradeCost' | 'stocks'>
type AgentSpaceBattle = Pick<SpaceBattle, 'name'>
  & {
    clipProbes: number
    drifterProbes: number
    startingClipProbes: number
    startingDrifterProbes: number
  }
type AgentSpace = Pick<GameState['space'], 'probeCount' | 'probeDescendents' | 'probeCost' | 'probeTrust' | 'probeUsedTrust' | 'probeTrustCost' | 'maxTrust'>
  & Partial<Pick<GameState['space'], 'drifterCount' | 'honor' | 'maxTrustCost'>>
  & {
    spaceExplorationPercent: number
    probesLaunched: number
    probesLostToHazards: number
    probesLostToValueDrift: number
    probesLostToCombat?: number
    probeDistributionSpeed: number
    probeDistributionExploration: number
    probeDistributionSelfReplication: number
    probeDistributionHazardRemediation: number
    probeDistributionFactory: number
    probeDistributionHarvester: number
    probeDistributionWireDrone: number
    probeDistributionCombat?: number
    activeBattle?: AgentSpaceBattle
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
  .describe(
    'Maps to space.probeDistribution* fields in environment: speed=probeDistributionSpeed, ' +
    'exploration=probeDistributionExploration, self_replication=probeDistributionSelfReplication, ' +
    'hazard_remediation=probeDistributionHazardRemediation, factory=probeDistributionFactory, ' +
    'harvester=probeDistributionHarvester, wire_drone=probeDistributionWireDrone, combat=probeDistributionCombat'
  )
export type ProbeTrustTarget = z.infer<typeof probeTrustTargetSchema>

export const agentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('makeClip') }),
  z.object({ type: z.literal('buyWire') }),
  z.object({ type: z.literal('buyFactory').describe('costs earth.factoryCost clips; see production.unusedClips for current balance') }),
  z.object({ type: z.literal('buyHarvester').describe('costs earth.harvesterCost clips; see production.unusedClips for current balance') }),
  z.object({ type: z.literal('buyWireDrone').describe('costs earth.wireDroneCost clips; see production.unusedClips for current balance') }),
  z.object({ type: z.literal('buyFarm').describe('costs earth.farmCost clips; see production.unusedClips for current balance') }),
  z.object({ type: z.literal('buyBattery').describe('costs earth.batteryCost clips; see production.unusedClips for current balance') }),
  z.object({ type: z.literal('launchProbe').describe('launch a space probe at the cost of space.probeCost clips; see production.unusedClips for current balance') }),
  z.object({ type: z.literal('increaseProbeTrust').describe('increase probe trust at the cost of space.probeTrustCost yomi; see strategy.yomi for current balance') }),
  z.object({ type: z.literal('increaseMaxTrust').describe('increase maximum probe trust at the cost of space.maxTrustCost honor; see space.honor for current balance') }),
  z.object({ type: z.literal('assignProbeTrust'), target: probeTrustTargetSchema }),
  z.object({ type: z.literal('buyMarketing') }),
  z.object({ type: z.literal('buyAutoClipper') }),
  z.object({ type: z.literal('buyMegaClipper') }),
  z.object({ type: z.literal('investDeposit') }),
  z.object({ type: z.literal('investWithdraw') }),
  z.object({ type: z.literal('investUpgrade').describe('upgrade investment engine at the cost of investment.investUpgradeCost yomi; see strategy.yomi for current balance') }),
  z.object({ type: z.literal('chooseInvestmentRisk'), mode: investmentRiskModeSchema }),
  z.object({ type: z.literal('runTournament').describe('run a Strategic Modeling tournament using the strategy.selectedStrategy at the cost of strategy.tourneyCost ops, earns yomi upon winning; see compute.operations for current ops balance') }),
  z.object({ type: z.literal('chooseStrategy').describe('chooses a Strategic Modeling tournament strategy'), strategy: strategySelectionSchema }),
  z.object({ type: z.literal('addProcessor').describe('costs 1 trust; see compute.trust for available balance') }),
  z.object({ type: z.literal('addMemory').describe('costs 1 trust; see compute.trust for available balance') }),
  z.object({ type: z.literal('raisePrice').describe('raise price by $0.01') }),
  z.object({ type: z.literal('lowerPrice').describe('lower price by $0.01') }),
  z.object({ type: z.literal('completeProject'), projectId: projectIdSchema, title: z.string(), description: z.string(), cost: z.union([costSchema, z.array(costSchema)]), }),
  z.object({ type: z.literal('wait').describe('advance game time without taking any action. Each turn is 1 second of simulated time.'), turns: z.number().min(1).max(30) }),
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
export type Host = 'openrouter'
export type LLMAgentSpec = {
  provider: Provider
  model: string
  host?: Host
}
export type LLMAgentOptions = {
  agent: LLMAgentSpec
  summarizer: LLMAgentSpec
  verbosity: number
}
export type AgentOptions = { type: 'fake'; verbosity: number } | ({ type: 'llm' } & LLMAgentOptions)
