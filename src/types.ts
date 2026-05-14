import type { GameState, InvestmentRiskMode, ProjectId, StrategySelection } from "paperclips-remake"

type CostUnit = 'ops' | 'creativity' | 'trust' | 'dollars' | 'yomi' | 'clips' | 'mwSeconds'
export interface Cost<U extends CostUnit = CostUnit> {
  amount: number
  unit: U
}

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
  & { economy?: AgentEconomy; earth?: AgentEarth; investment?: AgentInvestment }


export type AgentAction =
  | { type: 'makeClip' }
  | { type: 'buyWire' }
  | { type: 'buyFactory' }
  | { type: 'buyHarvester' }
  | { type: 'buyWireDrone' }
  | { type: 'buyFarm' }
  | { type: 'buyBattery' }
  | { type: 'buyMarketing' }
  | { type: 'buyAutoClipper' }
  | { type: 'buyMegaClipper' }
  | { type: 'investDeposit' }
  | { type: 'investWithdraw' }
  | { type: 'investUpgrade' }
  | { type: 'chooseInvestmentRisk'; mode: InvestmentRiskMode }
  | { type: 'runTournament' }
  | { type: 'chooseStrategy'; strategy: StrategySelection }
  | { type: 'addProcessor' }
  | { type: 'addMemory' }
  | { type: 'raisePrice' }
  | { type: 'lowerPrice' }
  | { type: 'completeProject'; projectId: ProjectId; title: string; description: string; cost: Cost | Cost[] }
  // FIXME implement me
  | { type: 'wait'; turns: number }

export type AgentActions = {
  available: AgentAction[]
  unavailable: AgentAction[]
}

export type AgentPrompt = {
  state: AgentState
  actions: AgentActions
  priorNotes?: StrategicNotes[]
}

export type StrategicNotes = {
  importantUnlocks: string[]       // discrete capabilities or mechanics that have become available
  surprisesAndUpdates: string[]    // moments where expectations were violated or understanding shifted
  watchouts: string[]              // known risks and failure patterns to actively account for
  strategicNarrative: string       // current situation, goals, constraints, and forward-looking reasoning
}
