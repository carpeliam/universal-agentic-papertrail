import type { InvestmentRiskMode, ProjectId, StrategySelection } from "paperclips-remake"

type CostUnit = 'ops' | 'creativity' | 'trust' | 'dollars' | 'yomi' | 'clips' | 'mwSeconds'
export interface Cost {
  amount: number
  unit: CostUnit
}

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
  | { type: 'completeProject'; projectId: ProjectId; title: string; description: string }
  // FIXME implement me
  | { type: 'wait'; turns: number }
