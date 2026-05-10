import { getStallState, getWireBatchCost, getActiveProjects, canAllocateTrust, canRunTournament, type GameAction, type GameState, type ProjectId, type InvestmentRiskMode } from "paperclips-remake"
import type { AgentAction, AgentActions, AgentPrompt, AgentState } from "./types"

export function toAgentState(state: GameState): AgentState {
  const { version, paused, prestige, wirePurchased, lastTickSales, lastTickRevenue, lastAction, earth, compute, investment, strategy, space, projects, phase, ...rest } = state
  const fulfilledProjects = Object.fromEntries(
    Object.entries(projects).filter(([_id, completed]) => completed)
  ) as Record<ProjectId, boolean>

  return {
    ...rest,
    ...(compute.unlocked && { compute }),
    ...(investment.unlocked && {
      investment: {
        bankroll: investment.bankroll,
        portTotal: investment.portTotal,
        secTotal: investment.secTotal,
        riskMode: investment.riskMode,
        investLevel: investment.investLevel,
        stocks: investment.stocks,
        investUpgradeCost: { amount: investment.investUpgradeCost, unit: 'yomi' },
      }
    }),
    ...(strategy.unlocked && { strategy }),
    ...(!earth.humanFlag && {
      earth: {
        nanoWire: earth.nanoWire,
        ...(earth.tothFlag && earth.powerGridFlag && {
          farmLevel: earth.farmLevel, farmCost: earth.farmCost, farmRate: earth.farmRate,
          batteryLevel: earth.batteryLevel, batteryCost: earth.batteryCost,
          powerProductionRate: earth.powerProductionRate, powerConsumptionRate: earth.powerConsumptionRate,
          storedPower: earth.storedPower, batterySize: earth.batterySize,
        }),
        ...(earth.wireProductionFlag && {
          availableMatter: earth.availableMatter,
          acquiredMatter: earth.acquiredMatter,
          processedMatter: earth.processedMatter,
          harvesterRate: earth.harvesterRate, wireDroneRate: earth.wireDroneRate,
        }),
        ...(earth.harvesterFlag && {
          harvesterLevel: earth.harvesterLevel, harvesterCost: earth.harvesterCost,
        }),
        ...(earth.wireDroneFlag && {
          wireDroneLevel: earth.wireDroneLevel, wireDroneCost: earth.wireDroneCost,
        }),
        ...(earth.factoryFlag && {
          factoryLevel: earth.factoryLevel, factoryCost: earth.factoryCost, factoryRate: earth.factoryRate,
        }),
      },
    }),
    ...(Object.keys(fulfilledProjects).length > 0 && { projects: fulfilledProjects }),
  }
}

type ActionDescriptor = {
  isVisible: (s: GameState) => boolean
  canActivate: (s: GameState) => boolean
  actions: (s: GameState) => AgentAction[]
}
const ACTION_REGISTRY: ActionDescriptor[] = [
  {
    isVisible: () => true,
    canActivate: (s) => s.production.wire > 0,
    actions: () => [{ type: 'makeClip' }],
  },
  {
    isVisible: (s) => s.earth.humanFlag,
    canActivate: (s) => true,
    actions: () => [{ type: 'raisePrice' }],
  },
  {
    isVisible: (s) => s.earth.humanFlag,
    canActivate: (s) => s.economy.clipPrice > 0.01,
    actions: () => [{ type: 'lowerPrice' }],
  },
  {
    isVisible: (s) => s.earth.humanFlag,
    canActivate: (s) => s.production.funds >= getWireBatchCost(s, 1),
    actions: () => [{ type: 'buyWire' }],
  },
  {
    isVisible: (s) => s.earth.factoryFlag,
    canActivate: (s) => s.production.unusedClips >= s.earth.factoryCost,
    actions: () => [{ type: 'buyFactory' }],
  },
  {
    isVisible: (s) => s.earth.harvesterFlag,
    canActivate: (s) => s.production.unusedClips >= s.earth.harvesterCost,
    actions: () => [{ type: 'buyHarvester' }],
  },
  {
    isVisible: (s) => s.earth.wireDroneFlag,
    canActivate: (s) => s.production.unusedClips >= s.earth.wireDroneCost,
    actions: () => [{ type: 'buyWireDrone' }],
  },
  {
    isVisible: (s) => s.earth.powerGridFlag,
    canActivate: (s) => s.production.unusedClips >= s.earth.farmCost,
    actions: () => [{ type: 'buyFarm' }],
  },
  {
    isVisible: (s) => s.earth.powerGridFlag,
    canActivate: (s) => s.production.unusedClips >= s.earth.batteryCost,
    actions: () => [{ type: 'buyBattery' }],
  },
  {
    isVisible: (s) => s.earth.humanFlag,
    canActivate: (s) => s.production.funds >= s.economy.adCost,
    actions: () => [{ type: 'buyMarketing' }],
  },
  {
    isVisible: (s) => s.phase !== 'boot' && s.earth.humanFlag,
    canActivate: (s) => s.production.funds >= s.production.autoClipperCost,
    actions: () => [{ type: 'buyAutoClipper' }],
  },
  {
    isVisible: (s) => s.projects.project22 && s.earth.humanFlag,
    canActivate: (s) => s.production.funds >= s.production.megaClipperCost,
    actions: () => [{ type: 'buyMegaClipper' }],
  },
  {
    isVisible: (s) => s.investment.unlocked,
    canActivate: (s) => true,
    actions: (s) => [
      { type: 'investDeposit' },
      { type: 'investWithdraw' },
      ...(
        ['low', 'med', 'hi']
          .filter(mode => mode !== s.investment.riskMode)
          .map((mode: InvestmentRiskMode) => ({ type: 'chooseInvestmentRisk' as const, mode }))
      ),
    ],
  },
  {
    isVisible: (s) => s.investment.unlocked,
    canActivate: (s) => s.strategy.yomi >= s.investment.investUpgradeCost,
    actions: (s) => [{ type: 'investUpgrade' }],
  },
  {
    isVisible: (s) => s.compute.unlocked,
    canActivate: (s) => canAllocateTrust(s),
    actions: () => [{ type: 'addProcessor' }, { type: 'addMemory' }],
  },
  {
    isVisible: (s) => s.strategy.unlocked,
    canActivate: () => true,
    actions: (s) => ['NONE' as const, ...s.strategy.strategies]
      .filter(strategy => strategy !== s.strategy.selectedStrategy)
      .map(strategy => ({ type: 'chooseStrategy' as const, strategy })),
  },
  {
    isVisible: (s) => s.strategy.unlocked,
    canActivate: (s) => canRunTournament(s),
    actions: () => [{ type: 'runTournament' }],
  },
]
function getActionDescriptors(state: GameState): ActionDescriptor[] {
  const projectDescriptors = getActiveProjects(state).map(({ id: projectId, title, description, canActivate, costs }) => {
    const cost = (costs.length === 1) ? costs[0] : costs
    return {
      isVisible: () => true,
      canActivate: () => canActivate,
      actions: (): AgentAction[] => [{ type: 'completeProject', projectId, title, description, cost }],
    }
  })

  return [...ACTION_REGISTRY, ...projectDescriptors]
}

export function getActions(state: GameState): AgentActions {
  const descriptors = getActionDescriptors(state).filter(d => d.isVisible(state))
  return {
    available: descriptors.filter(d => d.canActivate(state)).flatMap(d => d.actions(state)),
    unavailable: descriptors.filter(d => !d.canActivate(state)).flatMap(d => d.actions(state)),
  }
}

export function createAgentPrompt(state: GameState): AgentPrompt {
  return { state: toAgentState(state), actions: getActions(state) }
}

export function toGameActions(action: AgentAction, state: GameState): GameAction[] {
  switch (action.type) {
    case 'buyWire':
      return [{ type: 'buyWire', amount: 1 }]
    case 'raisePrice':
      return [{ type: 'setPrice', price: state.economy.clipPrice + 0.01 }]
    case 'lowerPrice':
      return [{ type: 'setPrice', price: state.economy.clipPrice - 0.01 }]
    case 'completeProject':
      return [{ type: 'completeProject', projectId: action.projectId }]
    case 'chooseInvestmentRisk': {
      const modes: InvestmentRiskMode[] = ['low', 'med', 'hi']
      const currentRiskMode = state.investment.riskMode
      const currentIndex = modes.indexOf(currentRiskMode)
      const targetIndex = modes.indexOf(action.mode)
      const cycles = (targetIndex - currentIndex + modes.length) % modes.length
      return Array(cycles).fill({ type: 'cycleInvestmentRisk' })
    }
    case 'chooseStrategy': {
      const { strategies, selectedStrategy } = state.strategy
      const strategyOptions = ['NONE', ...strategies]
      const currentIndex = strategyOptions.indexOf(selectedStrategy)
      const targetIndex = strategyOptions.indexOf(action.strategy)
      const cycles = (targetIndex - currentIndex + strategyOptions.length) % strategyOptions.length
      return Array(cycles).fill({ type: 'cycleStrategySelection' })
    }
    default:
      return [action] as GameAction[]
  }
}

export function isGameOver(state: GameState) {
  const remainingMatter = Math.max(0, state.space.totalMatter - state.space.foundMatter)
  return remainingMatter == 0 || getStallState(state).stalled
}
