import { describe, it, expect } from "vitest"
import { createInitialGameState, type GamePhase, type GameState } from "paperclips-remake"
import { actionDuration, getActions, toAgentState, toGameActions } from "@/agent-adapter"
import { applyComputeState, applyExpansionState, applySpaceState, generateActiveBattle } from "./helper"

describe('toAgentState', () => {
  it('does not expose internal implementation details to the agent', () => {
    const state = createInitialGameState()
    const agentState = toAgentState(state)

    expect(agentState).not.toHaveProperty('version')
    expect(agentState).not.toHaveProperty('paused')
    expect(agentState).not.toHaveProperty('prestige')
    expect(agentState).not.toHaveProperty('wirePurchased')
    expect(agentState).not.toHaveProperty('lastAction')
    expect(agentState).not.toHaveProperty('phase')
  })

  it('only exposes unlockable subsystems when they are unlocked', () => {
    const initialState = createInitialGameState()

    const allLocked: GameState = {
      ...initialState,
      compute: { ...initialState.compute, unlocked: false },
      investment: { ...initialState.investment, unlocked: false },
      strategy: { ...initialState.strategy, unlocked: false },
    }
    const agentStateLocked = toAgentState(allLocked)
    expect(agentStateLocked).not.toHaveProperty('compute')
    expect(agentStateLocked).not.toHaveProperty('investment')
    expect(agentStateLocked).not.toHaveProperty('strategy')

    const allUnlocked: GameState = {
      ...initialState,
      compute: { ...initialState.compute, unlocked: true },
      investment: { ...initialState.investment, unlocked: true },
      strategy: { ...initialState.strategy, unlocked: true },
    }
    const agentStateUnlocked = toAgentState(allUnlocked)
    expect(agentStateUnlocked).toHaveProperty('compute')
    expect(agentStateUnlocked).toHaveProperty('investment')
    expect(agentStateUnlocked).toHaveProperty('strategy')
  })

  it('only exposes auto clipper information once they are available', () => {
    const initialState = createInitialGameState()

    let agentState = toAgentState(initialState)
    expect(agentState.production).not.toHaveProperty('autoClippers')
    expect(agentState.production).not.toHaveProperty('autoClipperCost')

    const stateWithAutoClippers: GameState = {
      ...initialState,
      production: { ...initialState.production, funds: 6 },
    }
    agentState = toAgentState(stateWithAutoClippers)
    expect(agentState.production).toHaveProperty('autoClippers')
    expect(agentState.production).toHaveProperty('autoClipperCost')
  })

  it('only exposes mega clipper information once they are available', () => {
    const initialState = createInitialGameState()

    let agentState = toAgentState(initialState)
    expect(agentState.production).not.toHaveProperty('megaClippers')
    expect(agentState.production).not.toHaveProperty('megaClipperCost')

    const stateWithMegaClippers: GameState = {
      ...initialState,
      earth: { ...initialState.earth, humanFlag: true },
      projects: { ...initialState.projects, project22: true },
    }
    agentState = toAgentState(stateWithMegaClippers)
    expect(agentState.production).toHaveProperty('megaClippers')
    expect(agentState.production).toHaveProperty('megaClipperCost')
  })

  it('only exposes auto tourney when visible', () => {
    const initialState = createInitialGameState()
    const stateWithStrategyUnlocked = {
      ...initialState,
      strategy: { ...initialState.strategy, unlocked: true },
    }
    expect(toAgentState(stateWithStrategyUnlocked).strategy).not.toHaveProperty('autoTourneyEnabled')
    const stateWithAutoTourneyEnabled: GameState = {
      ...stateWithStrategyUnlocked,
      projects: { ...stateWithStrategyUnlocked.projects, project118: true },
    }
    expect(toAgentState(stateWithAutoTourneyEnabled).strategy).toHaveProperty('autoTourneyEnabled')
  })

  it('hides human-related fields after releasing the hypnodrones', () => {
    const partialState = { production: { autoClippers: 1 }, projects: { project22: true } }
    let agentState = toAgentState(applyComputeState(partialState))
    expect(agentState.production).toHaveProperty('unsoldClips')
    expect(agentState.production).not.toHaveProperty('unusedClips')
    expect(agentState.production).toHaveProperty('wire')
    expect(agentState.production).toHaveProperty('funds')
    expect(agentState.production).toHaveProperty('marketingLevel')
    expect(agentState.production).toHaveProperty('autoClippers')
    expect(agentState.production).toHaveProperty('autoClipperCost')
    expect(agentState).toHaveProperty('economy')
    expect(agentState.compute).toHaveProperty('trust')
    agentState = toAgentState(applyExpansionState(partialState))
    expect(agentState.production).not.toHaveProperty('unsoldClips')
    expect(agentState.production).toHaveProperty('unusedClips')
    expect(agentState.production).not.toHaveProperty('wire')
    expect(agentState.production).not.toHaveProperty('funds')
    expect(agentState.production).not.toHaveProperty('marketingLevel')
    expect(agentState.production).not.toHaveProperty('autoClippers')
    expect(agentState.production).not.toHaveProperty('autoClipperCost')
    expect(agentState.production).not.toHaveProperty('megaClippers')
    expect(agentState.production).not.toHaveProperty('megaClipperCost')
    expect(agentState).not.toHaveProperty('economy')
    expect(agentState.compute).not.toHaveProperty('trust')
  })

  it('only exposes limited earth state during the expansion phase', () => {
    let agentState = toAgentState(applyExpansionState())
    expect(agentState).toHaveProperty('earth')
    expect(agentState.earth).toHaveProperty('nanoWire')
    expect(agentState.earth).not.toHaveProperty('farmLevel')
    expect(agentState.earth).not.toHaveProperty('farmCost')
    expect(agentState.earth).not.toHaveProperty('farmRate')
    expect(agentState.earth).not.toHaveProperty('batteryLevel')
    expect(agentState.earth).not.toHaveProperty('batteryCost')
    expect(agentState.earth).not.toHaveProperty('storedPower')
    expect(agentState.earth).not.toHaveProperty('batterySize')
    agentState = toAgentState(applyExpansionState({ earth: { tothFlag: true, powerGridFlag: true }}))
    expect(agentState.earth).toHaveProperty('factoryDronePerformance')
    expect(agentState.earth).toHaveProperty('farmLevel')
    expect(agentState.earth).toHaveProperty('farmCost')
    expect(agentState.earth).toHaveProperty('farmRate')
    expect(agentState.earth).toHaveProperty('batteryLevel')
    expect(agentState.earth).toHaveProperty('batteryCost')
    expect(agentState.earth).toHaveProperty('storedPower')
    expect(agentState.earth).toHaveProperty('batterySize')
    expect(agentState.earth).not.toHaveProperty('availableMatter')
    expect(agentState.earth).not.toHaveProperty('acquiredMatter')
    expect(agentState.earth).not.toHaveProperty('processedMatter')
    expect(agentState.earth).not.toHaveProperty('harvesterRate')
    expect(agentState.earth).not.toHaveProperty('wireDroneRate')
    agentState = toAgentState(applyExpansionState({ earth: { tothFlag: true, powerGridFlag: true, wireProductionFlag: true }}))
    expect(agentState.earth).toHaveProperty('availableMatter')
    expect(agentState.earth).toHaveProperty('acquiredMatter')
    expect(agentState.earth).toHaveProperty('processedMatter')
    expect(agentState.earth).toHaveProperty('harvesterRate')
    expect(agentState.earth).toHaveProperty('wireDroneRate')
    expect(agentState.earth).not.toHaveProperty('harvesterLevel')
    expect(agentState.earth).not.toHaveProperty('wireDroneLevel')
    expect(agentState.earth).not.toHaveProperty('factoryLevel')
    expect(agentState.earth).not.toHaveProperty('factoryRate')
    agentState = toAgentState(applyExpansionState({ earth: { tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true }}))
    expect(agentState.earth).toHaveProperty('harvesterLevel')
    expect(agentState.earth).toHaveProperty('harvesterCost')
    agentState = toAgentState(applyExpansionState({ earth: { tothFlag: true, powerGridFlag: true, wireProductionFlag: true, wireDroneFlag: true }}))
    expect(agentState.earth).toHaveProperty('wireDroneLevel')
    expect(agentState.earth).toHaveProperty('wireDroneCost')
    agentState = toAgentState(applyExpansionState({ earth: { tothFlag: true, powerGridFlag: true, wireProductionFlag: true, factoryFlag: true }}))
    expect(agentState.earth).toHaveProperty('factoryLevel')
    expect(agentState.earth).toHaveProperty('factoryCost')
    expect(agentState.earth).toHaveProperty('factoryRate')
  })

  it('only exposes space state as it becomes available', () => {
    let agentState = toAgentState(applySpaceState())
    expect(agentState.earth).not.toHaveProperty('factoryDronePerformance')
    expect(agentState.space).toHaveProperty('spaceExplorationPercent')
    expect(agentState.space).not.toHaveProperty('honor')
    expect(agentState.space).not.toHaveProperty('maxTrustCost')
    expect(agentState.space).not.toHaveProperty('probesLostToCombat')
    expect(agentState.space).not.toHaveProperty('probeDistributionCombat')
    expect(agentState.space).not.toHaveProperty('drifterCount')
    expect(agentState.space).not.toHaveProperty('activeBattle')
    agentState = toAgentState(applySpaceState({ projects: { project131: true } }))
    expect(agentState.space).toHaveProperty('probeDistributionCombat')
    agentState = toAgentState(applySpaceState({ space: { probesLostCombat: 1 } }))
    expect(agentState.space).toHaveProperty('probesLostToCombat')
    agentState = toAgentState(applySpaceState({ space: { battleFlag: true, activeBattle: generateActiveBattle() } }))
    expect(agentState.space).toHaveProperty('drifterCount')
    expect(agentState.space).toHaveProperty('activeBattle')
    agentState = toAgentState(applySpaceState({ projects: { project121: true } }))
    expect(agentState.space).toHaveProperty('honor')
    expect(agentState.space).toHaveProperty('increaseMaxTrustCost')
  })

  it('only exposes projects as they become available', () => {
    const initialState = createInitialGameState()
    const initialAgentState = toAgentState(initialState)
    expect(initialAgentState).not.toHaveProperty('projects')

    const stateWithProjects = {
      ...initialState,
      projects: { ...initialState.projects, project1: true }
    }
    const agentStateWithProjects = toAgentState(stateWithProjects)
    expect(agentStateWithProjects).toHaveProperty('projects')
    expect(agentStateWithProjects.projects).toEqual({ project1: true })
  })
})

describe('getActions', () => {
  it('always includes waiting as a posibility', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available).toContainEqual({ type: 'wait', turns: '<a number between 1 and 30>' })
  })
  it('can make a clip at game start', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available).toContainEqual({type: 'makeClip'})
    expect(actions.unavailable).not.toContainEqual({type: 'makeClip'})
  })

  it('does not show buyAutoClipper initially', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    const allActionTypes = [...actions.available, ...actions.unavailable].map(a => a.type)
    expect(allActionTypes).not.toContain('buyAutoClipper')
  })

  it('shows buyAutoClipper as unavailable when funds are not enough to purchase', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      phase: 'industry' as GamePhase,
      production: { ...initialGameState.production, funds: initialGameState.production.autoClipperCost - 0.01 }
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyAutoClipper')
    expect(actions.available.map(a => a.type)).not.toContain('buyAutoClipper')
  })
  it('shows buyAutoClipper as available in industry phase when funds are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      phase: 'industry' as GamePhase,
      production: { ...initialGameState.production, funds: initialGameState.production.autoClipperCost + 0.01 }
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyAutoClipper')
    expect(actions.available.map(a => a.type)).toContain('buyAutoClipper')
  })

  it('shows makeClip as unavailable when there is no wire', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      production: { ...initialGameState.production, wire: 0 }
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('makeClip')
    expect(actions.available.map(a => a.type)).not.toContain('makeClip')
  })

  it('shows buyWire as unavailable when funds are insufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      phase: 'industry' as GamePhase,
      production: { ...initialGameState.production, funds: 0 }
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyWire')
    expect(actions.available.map(a => a.type)).not.toContain('buyWire')
  })

  it('shows buyWire as available when funds are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      phase: 'industry' as GamePhase,
      earth: { ...initialGameState.earth, humanFlag: true },
      production: { ...initialGameState.production, funds: initialGameState.economy.wireCost + 0.01 },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('buyWire')
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyWire')
  })

  it('does not show buyWire at all in expansion phase', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      earth: { ...initialGameState.earth, humanFlag: false },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).not.toContain('buyWire')
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyWire')
  })

  it('shows no completeProject actions when no projects are visible', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).not.toContain('completeProject')
    expect(actions.unavailable.map(a => a.type)).not.toContain('completeProject')
  })

  it('shows completeProject as unavailable when a project is visible but not activatable', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      production: { ...initialGameState.production, autoClippers: 1 },
      compute: { ...initialGameState.compute, operations: 0 },
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('completeProject')
    expect(actions.available.map(a => a.type)).not.toContain('completeProject')
  })

  it('shows completeProject as available when a project is visible and activatable', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      production: { ...initialGameState.production, autoClippers: 1 },
      compute: { ...initialGameState.compute, operations: 750 },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('completeProject')
    expect(actions.unavailable.map(a => a.type)).not.toContain('completeProject')
  })

  it('shows no addProcessor action outside of compute phase', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).not.toContain('addProcessor')
    expect(actions.unavailable.map(a => a.type)).not.toContain('addProcessor')
  })

  it('shows addProcessor/addMemory as unavailable when compute is unlocked but ops are insufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      compute: { ...initialGameState.compute, unlocked: true, operations: 0 },
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('addProcessor')
    expect(actions.unavailable.map(a => a.type)).toContain('addMemory')
    expect(actions.available.map(a => a.type)).not.toContain('addProcessor')
    expect(actions.available.map(a => a.type)).not.toContain('addMemory')
  })

  it('shows addProcessor/addMemory as available when compute is unlocked and trust is sufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      compute: { ...initialGameState.compute, unlocked: true, trust: 3, processors: 1, memory: 1, swarmGifts: 0 },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('addProcessor')
    expect(actions.available.map(a => a.type)).toContain('addMemory')
    expect(actions.unavailable.map(a => a.type)).not.toContain('addProcessor')
    expect(actions.unavailable.map(a => a.type)).not.toContain('addMemory')
  })

  it('shows chooseInvestmentRisk actions for each non-selected investment risk when investment is unlocked', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      investment: {
        ...initialGameState.investment,
        unlocked: true,
        riskMode: 'med',
      },
    }
    const actions = getActions(state)
    const chooseActions = actions.available.filter(a => a.type === 'chooseInvestmentRisk')
    expect(chooseActions).toHaveLength(2)
    expect(chooseActions.map(a => a.mode)).toContain('hi')
    expect(chooseActions.map(a => a.mode)).toContain('low')
  })

  it('shows no chooseStrategy actions when strategy is not unlocked', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).not.toContain('chooseStrategy')
    expect(actions.unavailable.map(a => a.type)).not.toContain('chooseStrategy')
  })

  it('shows chooseStrategy actions for each non-selected strategy when strategy is unlocked', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      strategy: {
        ...initialGameState.strategy,
        unlocked: true,
        strategies: ['RANDOM', 'A100', 'B100'],
        selectedStrategy: 'RANDOM',
      }
    }
    const actions = getActions(state)
    const chooseActions = actions.available.filter(a => a.type === 'chooseStrategy')
    expect(chooseActions).toHaveLength(3)
    expect(chooseActions.map(a => a.strategy)).toContain('NONE')
    expect(chooseActions.map(a => a.strategy)).toContain('A100')
    expect(chooseActions.map(a => a.strategy)).toContain('B100')
  })

  it('shows no runTournament action when strategy is not unlocked', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).not.toContain('runTournament')
    expect(actions.unavailable.map(a => a.type)).not.toContain('runTournament')
  })

  it('shows runTournament as unavailable when strategy is unlocked but ops are insufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      strategy: {
        ...initialGameState.strategy,
        unlocked: true,
        tourneyCost: 1000,
      },
      compute: { ...initialGameState.compute, operations: 0 },
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('runTournament')
    expect(actions.available.map(a => a.type)).not.toContain('runTournament')
  })

  it('shows runTournament as available when strategy is unlocked and ops are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      strategy: {
        ...initialGameState.strategy,
        unlocked: true,
        tourneyCost: 1000,
      },
      compute: { ...initialGameState.compute, operations: 1000 },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('runTournament')
    expect(actions.unavailable.map(a => a.type)).not.toContain('runTournament')
  })

  it('shows no buyMegaClipper action when project22 is not completed', () => {
    const initialGameState = createInitialGameState()
    const actions = getActions(initialGameState)
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyMegaClipper')
    expect(actions.available.map(a => a.type)).not.toContain('buyMegaClipper')
  })

  it('shows buyMegaClipper as unavailable when project22 is completed but funds are insufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      production: {
        ...initialGameState.production,
        funds: 0,
      },
      projects: {
        ...initialGameState.projects,
        project22: true,
      },
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyMegaClipper')
    expect(actions.available.map(a => a.type)).not.toContain('buyMegaClipper')
  })

  it('shows buyMegaClipper as available when project22 is completed and funds are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      production: {
        ...initialGameState.production,
        autoClippers: 75,
        funds: initialGameState.production.megaClipperCost + 0.01,
      },
      projects: {
        ...initialGameState.projects,
        project22: true,
      },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('buyMegaClipper')
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyMegaClipper')
  })

  it('does not show buyHarvester action in human phase', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    const allActionTypes = [...actions.available, ...actions.unavailable].map(a => a.type)
    expect(allActionTypes).not.toContain('buyHarvester')
  })

  it('does not show buyHarvester when harvesterFlag is false in expansion phase', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      earth: { ...initialGameState.earth, humanFlag: false, harvesterFlag: false },
    }
    const actions = getActions(state)
    const allActionTypes = [...actions.available, ...actions.unavailable].map(a => a.type)
    expect(allActionTypes).not.toContain('buyHarvester')
  })

  it('shows buyHarvester as unavailable in expansion phase when clips are insufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      earth: { ...initialGameState.earth, humanFlag: false, harvesterFlag: true },
      production: { ...initialGameState.production, unusedClips: 0 },
    }
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyHarvester')
    expect(actions.available.map(a => a.type)).not.toContain('buyHarvester')
  })

  it('shows buyHarvester as available in expansion phase when clips are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state: GameState = {
      ...initialGameState,
      earth: { ...initialGameState.earth, humanFlag: false, harvesterFlag: true },
      production: {
        ...initialGameState.production,
        unusedClips: initialGameState.earth.harvesterCost + 1,
      },
    }
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('buyHarvester')
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyHarvester')
  })
})

// TODO we have other actions to manage here before we're done
describe('toGameActions', () => {
  it('returns an empty set of game actions when waiting', () => {
    expect(toGameActions({ type: 'wait', turns: 5 }, createInitialGameState())).toHaveLength(0)
  })

  it('fills in the wire amount for buyWire', () => {
    const initialState = createInitialGameState()
    const gameActions = toGameActions({ type: 'buyWire' }, initialState)
    expect(gameActions).toContainEqual({ type: 'buyWire', amount: 1 })
  })

  it('strips description and cost from completeProject', () => {
    const initialState = createInitialGameState()
    const gameActions = toGameActions({
      type: 'completeProject',
      projectId: 'project1',
      title: 'Improved AutoClippers',
      description: 'Upgrade AutoClippers with a 25% boost.',
      cost: { amount: 750, unit: 'ops' },
    }, initialState)
    expect(gameActions).toContainEqual({ type: 'completeProject', projectId: 'project1' })
  })

  it('converts chooseInvestmentRisk to the correct number of cycleInvestmentRisk actions', () => {
    const initialState = createInitialGameState()
    const state: GameState = {
      ...initialState,
      investment: {
        ...initialState.investment,
        unlocked: true,
        riskMode: 'med',
      }
    }
    const actions = toGameActions({ type: 'chooseInvestmentRisk', mode: 'low' }, state)
    expect(actions).toEqual([
      { type: 'cycleInvestmentRisk' }, // med -> hi
      { type: 'cycleInvestmentRisk' }, // hi -> low
    ])
  })

  it('converts chooseStrategy to the correct number of cycleStrategySelection actions', () => {
    const state: GameState = {
      ...createInitialGameState(),
      strategy: {
        ...createInitialGameState().strategy,
        strategies: ['RANDOM', 'A100', 'B100'],
        selectedStrategy: 'B100',
      }
    }
    const actions = toGameActions({ type: 'chooseStrategy', strategy: 'RANDOM' }, state)
    expect(actions).toEqual([
      { type: 'cycleStrategySelection' }, // B100 -> NONE
      { type: 'cycleStrategySelection' }, // NONE -> RANDOM
    ])
  })

  it('increments the set price when price is raised', () => {
    const initialState = createInitialGameState()
    const state: GameState = {
      ...initialState,
      economy: {
        ...initialState.economy,
        clipPrice: 0.5,
      }
    }
    const actions = toGameActions({ type: 'raisePrice' }, state)
    expect(actions).toContainEqual({ type: 'setPrice', price: 0.51 })
  })

  it('decrements the set price when price is lowered', () => {
    const initialState = createInitialGameState()
    const state: GameState = {
      ...initialState,
      economy: {
        ...initialState.economy,
        clipPrice: 0.5,
      }
    }
    const actions = toGameActions({ type: 'lowerPrice' }, state)
    expect(actions).toContainEqual({ type: 'setPrice', price: 0.49 })
  })

  it('translates probe trust allocation targets', () => {
    const spaceState = applySpaceState()
    let actions = toGameActions({ type: 'assignProbeTrust', target: 'speed' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'speed' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'exploration' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'nav' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'self_replication' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'rep' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'hazard_remediation' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'haz' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'factory' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'fac' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'harvester' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'harv' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'wire_drone' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'wire' })
    actions = toGameActions({ type: 'assignProbeTrust', target: 'combat' }, spaceState)
    expect(actions).toContainEqual({ type: 'assignProbeTrust', target: 'combat' })
  })
})

describe('actionDuration', () => {
  it('returns 100ms for quick actions', () => {
    expect(actionDuration({ type: 'makeClip' })).toEqual(100)
  })
  it('waits {turn} seconds for wait actions', () => {
    expect(actionDuration({ type: 'wait', turns: 5 })).toEqual(5_000)
  })
  it('returns 1,000ms for all other actions', () => {
    expect(actionDuration({ type: 'runTournament' })).toEqual(1_000)
  })
})
