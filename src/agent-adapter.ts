import { getWireBatchCost, getActiveProjects, canAllocateTrust, canCreateTournament, canRunTournament, type GameAction, type GameState, type InvestmentRiskMode, getBatteryCost, getDroneCost, getFarmCost } from "paperclips-remake"
import type { AgentAction, AgentActions, AgentPrompt, Description, PromptAction, ProbeTrustTarget } from "./types"
import { areAutoClippersVisible, areMegaClippersVisible } from "./domain"

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
    isVisible: (s) => s.projects.project50.completed && s.compute.qChips.some(c => c.active),
    canActivate: () => true,
    actions: () => [{ type: 'quantumCompute' }]
  },
  {
    isVisible: (s) => !!s.compute.swarmFlag,
    canActivate: () => true,
    actions: () => [{ type: 'setSwarmComputingBalance', workThinkBalance: description('integer(0-100)') }]
  },
  {
    isVisible: (s) => !!s.compute.boredomFlag,
    canActivate: (s) => s.compute.creativity >= s.compute.entertainCost,
    actions: () => [{ type: 'entertainSwarm' }]
  },
  {
    isVisible: (s) => !!s.compute.disorgFlag,
    canActivate: (s) => s.strategy.yomi >= s.compute.synchCost,
    actions: () => [{ type: 'synchronizeSwarm' }]
  },
  {
    isVisible: (s) => s.earth.factoryFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.production.unusedClips >= s.earth.factoryCost,
    actions: () => [{ type: 'buyFactory' }],
  },
  {
    isVisible: (s) => s.earth.factoryFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.earth.factoryLevel > 0,
    actions: () => [{ type: 'disassembleFactories' }],
  },
  ...(([1, 10, 100, 1000] as const).map((quantity): ActionDescriptor => ({
    isVisible: (s) => s.earth.harvesterFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.production.unusedClips >= getDroneCost(s.earth.harvesterLevel, quantity),
    actions: () => [{ type: 'buyHarvester', quantity }],
  }))),
  {
    isVisible: (s) => s.earth.harvesterFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.earth.harvesterLevel > 0,
    actions: () => [{ type: 'disassembleHarvesters' }],
  },
  ...(([1, 10, 100, 1000] as const).map((quantity): ActionDescriptor => ({
    isVisible: (s) => s.earth.wireDroneFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.production.unusedClips >= getDroneCost(s.earth.wireDroneLevel, quantity),
    actions: () => [{ type: 'buyWireDrone', quantity }],
  }))),
  {
    isVisible: (s) => s.earth.wireDroneFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.earth.wireDroneLevel > 0,
    actions: () => [{ type: 'disassembleWireDrones' }],
  },
  ...(([1, 10, 100] as const).map((quantity): ActionDescriptor => ({
    isVisible: (s) => s.earth.powerGridFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.production.unusedClips >= getFarmCost(s.earth.farmLevel, quantity),
    actions: () => [{ type: 'buyFarm', quantity }],
  }))),
  {
    isVisible: (s) => s.earth.powerGridFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.earth.farmLevel > 0,
    actions: () => [{ type: 'disassembleFarms' }],
  },
  ...(([1, 10, 100] as const).map((quantity): ActionDescriptor => ({
    isVisible: (s) => s.earth.powerGridFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.production.unusedClips >= getBatteryCost(s.earth.batteryLevel, quantity),
    actions: () => [{ type: 'buyBattery', quantity }],
  }))),
  {
    isVisible: (s) => s.earth.powerGridFlag && !s.earth.spaceFlag,
    canActivate: (s) => s.earth.batteryLevel > 0,
    actions: () => [{ type: 'disassembleBatteries' }],
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
    canActivate: (s) => s.projects.project121.completed && s.space.honor >= s.space.maxTrustCost,
    actions: () => [{ type: 'increaseMaxTrust' }],
  },
  {
    isVisible: (s) => s.earth.spaceFlag,
    canActivate: (s) => s.strategy.yomi >= s.space.probeTrustCost && s.space.probeUsedTrust < s.space.probeTrust,
    actions: (s) => (
      (['speed', 'exploration', 'self_replication', 'hazard_remediation', 'factory', 'harvester', 'wire_drone'] as ProbeTrustTarget[])
        .map(target => ({ type: 'allocateProbeTrust' as const, target }))
    ),
  },
  {
    isVisible: (s) => s.earth.spaceFlag && s.projects.project131.completed,
    canActivate: (s) => s.strategy.yomi >= s.space.probeTrustCost && s.space.probeUsedTrust < s.space.probeTrust && s.projects.project131.completed,
    actions: (s) => [{ type: 'allocateProbeTrust' as const, target: 'combat' }],
  },
  ...(['speed', 'exploration', 'self_replication', 'hazard_remediation', 'factory', 'harvester', 'wire_drone', 'combat'] as ProbeTrustTarget[]).map((target): ActionDescriptor => ({
    isVisible: (s) => s.earth.spaceFlag && (target !== 'combat' || s.projects.project131.completed),
    canActivate: (s) => {
      const currentTargetTrust = {
        speed: s.space.probeSpeed,
        exploration: s.space.probeNav,
        self_replication: s.space.probeRep,
        hazard_remediation: s.space.probeHaz,
        factory: s.space.probeFac,
        harvester: s.space.probeHarv,
        wire_drone: s.space.probeWire,
        combat: s.space.probeCombat,
      }[target]
      return s.earth.spaceFlag && currentTargetTrust > 0 && (target !== 'combat' || s.projects.project131.completed)
    },
    actions: (s) => [{ type: 'deallocateProbeTrust' as const, target }],
  })),
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
    isVisible: areMegaClippersVisible,
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
    canActivate: (s) => canCreateTournament(s),
    actions: () => [{ type: 'createNewTournament' }],
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

  return [
    ...ACTION_REGISTRY,
    ...projectDescriptors.map(d => (
      { ...d, isVisible() { return state.compute.unlocked && d.isVisible() } }
    ))
  ]
}

function description(text: string) {
  return `<${text}>` as Description
}
export function getActions(state: GameState): AgentActions {
  const descriptors = getActionDescriptors(state).filter(d => d.isVisible(state))
  return {
    available: [{ type: 'wait', turns: description('integer(1-30)') }, ...descriptors.filter(d => d.canActivate(state)).flatMap(d => d.actions(state))],
    unavailable: descriptors.filter(d => !d.canActivate(state)).flatMap(d => d.actions(state)),
  }
}

export function createAgentPrompt(state: GameState): AgentPrompt {
  return { state, actions: getActions(state) }
}

const gameStateProbeTrust: Record<ProbeTrustTarget, Extract<GameAction, { type: 'allocateProbeTrust' }>['target']> = {
  speed: 'speed',
  exploration: 'nav',
  self_replication: 'rep',
  hazard_remediation: 'haz',
  factory: 'fac',
  harvester: 'harv',
  wire_drone: 'wire',
  combat: 'combat',
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
    case 'disassembleHarvesters':
      return [{ type: 'rebootHarvesters' }]
    case 'disassembleWireDrones':
      return [{ type: 'rebootWireDrones' }]
    case 'disassembleFactories':
      return [{ type: 'rebootFactories' }]
    case 'disassembleFarms':
      return [{ type: 'rebootFarms' }]
    case 'disassembleBatteries':
      return [{ type: 'rebootBatteries' }]
    case 'allocateProbeTrust': {
      return [{ type: 'allocateProbeTrust', target: gameStateProbeTrust[action.target] }]
    }
    case 'deallocateProbeTrust': {
      return [{ type: 'deallocateProbeTrust', target: gameStateProbeTrust[action.target] }]
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
    case 'allocateProbeTrust':
    case 'deallocateProbeTrust':
    case 'quantumCompute':
      return 100
    case 'wait':
      return action.turns * 1_000
    default:
      return 1_000
  }
}
