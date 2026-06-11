import { getWireBatchCost, getActiveProjects, canAllocateTrust, canRunTournament, type GameAction, type GameState, type ProjectId, type InvestmentRiskMode } from "paperclips-remake"
import type { AgentAction, AgentActions, AgentPrompt, AgentState, Description, PromptAction, ProbeTrustTarget } from "./types"

function areAutoClippersVisible(state: GameState) {
  return state.earth.humanFlag &&
    (state.production.funds >= 5 ||
    state.production.autoClippers > 0 ||
    state.production.marketingLevel > 1 ||
    state.wirePurchased > 0)
}
function productionStateFor(state: GameState): Pick<AgentState, 'production'> {
  const { unsoldClips, unusedClips, funds, marketingLevel, autoClippers, autoClipperCost, megaClippers, megaClipperCost, ...productionFields } = state.production
  return {
    production: {
      ...productionFields,
      ...(state.earth.humanFlag ? { unsoldClips, funds, marketingLevel } : { unusedClips }),
      ...(areAutoClippersVisible(state) && { autoClippers, autoClipperCost }),
      ...(state.earth.humanFlag && state.projects.project22 && { megaClippers, megaClipperCost }),
    }
  }
}

function economyStateFor(state: GameState): Pick<AgentState, 'economy'> {
  const { clipPrice, wireCost, demand, wireSupply, adCost } = state.economy
  return (state.earth.humanFlag)
    ? {
      economy: {
        clipPrice, wireSupply,
        wireCostPerSpool: wireCost, marketingCost: adCost, publicDemand: demand,
      }
    }
    : { }
}

function computeStateFor(state: GameState): Pick<AgentState, 'compute'> {
  const { unlocked, processors, memory, operations, trust, nextTrust, creativity, creativityOn } = state.compute
  return (unlocked)
    ? {
      compute: {
        processors, memory, operations,
        ...(state.earth.humanFlag && { trust, nextTrust }),
        ...(creativityOn && { creativity }),
      }
    }
    : {}
}

function investmentStateFor(state: GameState): Pick<AgentState, 'investment'> {
  const { unlocked, bankroll, portTotal, secTotal, riskMode, investLevel, stocks, investUpgradeCost } = state.investment
  return unlocked
    ? { investment: { bankroll, portTotal, secTotal, riskMode, investLevel, stocks, investUpgradeCost } }
    : {}
}

function strategyStateFor(state: GameState): Pick<AgentState, 'strategy'> {
  const { unlocked, strategies, selectedStrategy, yomi, tourneyCost, tourneyLevel, autoTourneyEnabled, lastResults, lastPayoffMatrix, hMovePrev, vMovePrev } = state.strategy
  return (unlocked)
    ? {
      strategy: {
        strategies, selectedStrategy, yomi, tourneyCost, tourneyLevel, lastResults, lastPayoffMatrix, hMovePrev, vMovePrev,
        ...(state.projects.project118 && { autoTourneyEnabled }),
      }
    }
    : {}
}

function earthStateFor(state: GameState): Pick<AgentState, 'earth'> {
  const {
    humanFlag, spaceFlag, tothFlag, powerGridFlag, wireProductionFlag,
    farmLevel, farmCost, farmRate,
    batteryLevel, batteryCost, powerProductionRate, powerConsumptionRate, storedPower, batterySize,
    availableMatter, acquiredMatter, processedMatter, harvesterRate, wireDroneRate,
    harvesterFlag, harvesterLevel, harvesterCost,
    wireDroneFlag, wireDroneLevel, wireDroneCost,
    factoryFlag, factoryLevel, factoryCost, factoryRate, powMod,
  } = state.earth
  return humanFlag
    ? {}
    : {
      earth: {
        ...(powerGridFlag && !spaceFlag && { factoryDronePerformance: powMod }),
        ...(tothFlag && powerGridFlag && { farmLevel, farmCost, farmRate, batteryLevel, batteryCost, powerProductionRate, powerConsumptionRate, storedPower, batterySize }),
        ...(wireProductionFlag && { availableMatter, acquiredMatter, processedMatter, harvesterRate, wireDroneRate }),
        ...(harvesterFlag && { harvesterLevel, harvesterCost }),
        ...(wireDroneFlag && { wireDroneLevel, wireDroneCost }),
        ...(factoryFlag && { factoryLevel, factoryCost, factoryRate }),
      }
    }
}

function spaceStateFor(state: GameState): Pick<AgentState, 'space'> {
  const {
    totalMatter, foundMatter, probeCount, probeLaunchLevel, probeDescendents, probeCost, probeSpeed,
    probeNav, probeRep, probeHaz, probeFac, probeHarv, probeWire, probeCombat,
    probeTrust, probeUsedTrust, probeTrustCost, maxTrust,
    honor, maxTrustCost, probesLostHaz, probesLostDrift, probesLostCombat, drifterCount, activeBattle, battleFlag,
  } = state.space
  const spaceExplorationPercent = Math.round((foundMatter / totalMatter) * 100 * 1e12) / 1e12
  return state.earth.spaceFlag
    ? {
      space: {
        spaceExplorationPercent, probeCount, probesLaunched: probeLaunchLevel, probeDescendents, probeCost,
        probeDistributionSpeed: probeSpeed, probeDistributionExploration: probeNav,
        probeDistributionSelfReplication: probeRep, probeDistributionHazardRemediation: probeHaz,
        probeDistributionFactory: probeFac, probeDistributionHarvester: probeHarv, probeDistributionWireDrone: probeWire,
        probeTrust, probeTrustCost, probeUsedTrust, maxTrust,
        probesLostToHazards: probesLostHaz, probesLostToValueDrift: probesLostDrift,
        ...(probesLostCombat > 0 && { probesLostToCombat: probesLostCombat }),
        ...(state.projects.project131 && { probeDistributionCombat: probeCombat }),
        ...(state.projects.project121 && { honor, maxTrustCost }),
        ...(battleFlag && { drifterCount, activeBattle: {
          name: activeBattle!.name,
          clipProbes: activeBattle!.leftShips,
          drifterProbes: activeBattle!.rightShips,
          startingClipProbes: activeBattle!.startingLeftShips,
          startingDrifterProbes: activeBattle!.startingRightShips,
        }}),
      }
    }
    : {}
}

function projectStateFor(state: GameState): Pick<AgentState, 'projects'> {
  const fulfilledProjects = Object.fromEntries(
    Object.entries(state.projects).filter(([_id, completed]) => completed)
  ) as Record<ProjectId, boolean>
  return Object.keys(fulfilledProjects).length > 0 ? { projects: fulfilledProjects } : {}
}

export function toAgentState(state: GameState): AgentState {
  const { elapsedMs, lastTickProduction, lastTickSales, lastTickRevenue } = state

  return {
    elapsedMs, lastTickProduction, lastTickSales, lastTickRevenue,
    ...productionStateFor(state),
    ...economyStateFor(state),
    ...computeStateFor(state),
    ...investmentStateFor(state),
    ...strategyStateFor(state),
    ...earthStateFor(state),
    ...projectStateFor(state),
    ...spaceStateFor(state),
  }
}

type ActionDescriptor = {
  isVisible: (s: GameState) => boolean
  canActivate: (s: GameState) => boolean
  actions: (s: GameState) => PromptAction[]
}
const ACTION_REGISTRY: ActionDescriptor[] = [
  {
    isVisible: () => true,
    canActivate: (s) => s.production.wire > 0 && s.earth.humanFlag,
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
    isVisible: (s) => s.earth.spaceFlag,
    canActivate: (s) => s.production.unusedClips >= s.space.probeCost,
    actions: () => [{ type: 'launchProbe' }],
  },
  {
    isVisible: (s) => s.earth.spaceFlag,
    canActivate: (s) => s.strategy.yomi >= s.space.probeTrustCost && s.space.probeTrust < s.space.maxTrust,
    actions: () => [{ type: 'increaseProbeTrust' }],
  },
  {
    isVisible: (s) => s.earth.spaceFlag,
    canActivate: (s) => s.projects.project121 && s.space.honor >= s.space.maxTrustCost,
    actions: () => [{ type: 'increaseMaxTrust' }],
  },
  {
    isVisible: (s) => s.earth.spaceFlag,
    canActivate: (s) => s.strategy.yomi >= s.space.probeTrustCost && s.space.probeTrust < s.space.maxTrust,
    actions: (s) => (
      (['speed', 'exploration', 'self_replication', 'hazard_remediation', 'factory', 'harvester', 'wire_drone', 'combat'] as ProbeTrustTarget[])
        .map(target => ({ type: 'assignProbeTrust' as const, target }))
    ),
  },
  {
    isVisible: (s) => s.earth.humanFlag,
    canActivate: (s) => s.production.funds >= s.economy.adCost,
    actions: () => [{ type: 'buyMarketing' }],
  },
  {
    isVisible: areAutoClippersVisible,
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
        (['low', 'med', 'hi'] as const)
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
  {
    isVisible: (s) => s.strategy.autoTourneyEnabled,
    canActivate: (s) => true,
    actions: () => [{ type: 'toggleAutoTourney' }],
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

function description(text: string) {
  return `<${text}>` as Description
}
export function getActions(state: GameState): AgentActions {
  const descriptors = getActionDescriptors(state).filter(d => d.isVisible(state))
  return {
    available: [{ type: 'wait', turns: description('a number between 1 and 30') }, ...descriptors.filter(d => d.canActivate(state)).flatMap(d => d.actions(state))],
    unavailable: descriptors.filter(d => !d.canActivate(state)).flatMap(d => d.actions(state)),
  }
}

export function createAgentPrompt(state: GameState): AgentPrompt {
  return { state: toAgentState(state), actions: getActions(state) }
}

export function toGameActions(action: AgentAction, state: GameState): GameAction[] {
  switch (action.type) {
    case 'wait':
      return []
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
    case 'assignProbeTrust': {
      const agent2GameTarget: Record<ProbeTrustTarget, Extract<GameAction, { type: 'assignProbeTrust' }>['target']> = {
        speed: 'speed',
        exploration: 'nav',
        self_replication: 'rep',
        hazard_remediation: 'haz',
        factory: 'fac',
        harvester: 'harv',
        wire_drone: 'wire',
        combat: 'combat',
      }
      return [{ type: 'assignProbeTrust', target: agent2GameTarget[action.target] }]
    }
    default:
      return [action] as GameAction[]
  }
}

export function actionDuration(action: AgentAction): number {
  switch (action.type) {
    case 'makeClip':
    case 'raisePrice':
    case 'lowerPrice':
    case 'increaseProbeTrust':
    case 'assignProbeTrust':
      return 100
    case 'wait':
      return action.turns * 1_000
    default:
      return 1_000
  }
}
