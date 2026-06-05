import { describe, it, expect } from "vitest"
import { createInitialGameState, type GamePhase, type GameState } from "paperclips-remake"
import { actionDuration, getActions, toGameActions } from "@/agent-adapter"
import { applyGameState, withComputeUnlocked, withExpansion, withHarvesting, withIndustryPhase, withInvestingUnlocked, withMegaClippersEnabled, withSpacePhase, withStrategicModeling } from "./helper"

describe('getActions', () => {
  it('always includes waiting as a posibility', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available).toContainEqual({ type: 'wait', turns: '<integer(1-30)>' })
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
    const state = applyGameState(initialGameState, withIndustryPhase(), {
      production: { funds: initialGameState.production.autoClipperCost - 0.01 },
    })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyAutoClipper')
    expect(actions.available.map(a => a.type)).not.toContain('buyAutoClipper')
  })
  it('shows buyAutoClipper as available in industry phase when funds are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state = applyGameState(initialGameState, withIndustryPhase(), {
      production: { funds: initialGameState.production.autoClipperCost + 0.01 },
    })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyAutoClipper')
    expect(actions.available.map(a => a.type)).toContain('buyAutoClipper')
  })

  it('shows makeClip as unavailable when there is no wire', () => {
    const state = applyGameState({ production: { wire: 0 } })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('makeClip')
    expect(actions.available.map(a => a.type)).not.toContain('makeClip')
  })

  it('shows buyWire as unavailable when funds are insufficient', () => {
    const state = applyGameState({ production: { funds: 0 } })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyWire')
    expect(actions.available.map(a => a.type)).not.toContain('buyWire')
  })

  it('shows buyWire as available when funds are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state = applyGameState(initialGameState, withIndustryPhase(), {
      earth: { humanFlag: true },
      production: { funds: initialGameState.economy.wireCost + 0.01 },
    })
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('buyWire')
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyWire')
  })

  it('does not show buyWire at all in expansion phase', () => {
    const state = applyGameState(withExpansion())
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

  it('shows no completeProject actions when compute is not enabled yet', () => {
    const state = applyGameState({ production: { autoClippers: 1 } })
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).not.toContain('completeProject')
    expect(actions.unavailable.map(a => a.type)).not.toContain('completeProject')
  })

  it('shows completeProject as unavailable when a project is visible but not activatable', () => {
    const state = applyGameState(withComputeUnlocked(), {
      production: { autoClippers: 1 },
      compute: { operations: 0 },
    })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('completeProject')
    expect(actions.available.map(a => a.type)).not.toContain('completeProject')
  })

  it('shows completeProject as available when a project is visible and activatable', () => {
    const state = applyGameState(withComputeUnlocked(), {
      production: { autoClippers: 1 },
      compute: { operations: 750 },
    })
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('completeProject')
    expect(actions.unavailable.map(a => a.type)).not.toContain('completeProject')
  })

  it('shows addProcessor/addMemory as unavailable when compute is unlocked but ops are insufficient', () => {
    const state = applyGameState(withComputeUnlocked(), { compute: { operations: 0 } })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('addProcessor')
    expect(actions.unavailable.map(a => a.type)).toContain('addMemory')
    expect(actions.available.map(a => a.type)).not.toContain('addProcessor')
    expect(actions.available.map(a => a.type)).not.toContain('addMemory')
  })

  it('shows addProcessor/addMemory as available when compute is unlocked and trust is sufficient', () => {
    const state = applyGameState(withComputeUnlocked(), {
      compute: { trust: 3, processors: 1, memory: 1, swarmGifts: 0 },
    })
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('addProcessor')
    expect(actions.available.map(a => a.type)).toContain('addMemory')
    expect(actions.unavailable.map(a => a.type)).not.toContain('addProcessor')
    expect(actions.unavailable.map(a => a.type)).not.toContain('addMemory')
  })

  it('shows chooseInvestmentRisk actions for each non-selected investment risk when investment is unlocked', () => {
    const state = applyGameState(withInvestingUnlocked(), { investment: { riskMode: 'med' } })
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
    const state = applyGameState(withStrategicModeling(), {
      strategy: {
        strategies: ['RANDOM', 'A100', 'B100'],
        selectedStrategy: 'RANDOM',
      }
    })
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
    const state = applyGameState(withStrategicModeling(), {
      strategy: { tourneyCost: 1000 },
      compute: { operations: 0 },
    })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('runTournament')
    expect(actions.available.map(a => a.type)).not.toContain('runTournament')
  })

  it('shows runTournament as available when strategy is unlocked and ops are sufficient', () => {
    const state = applyGameState(withStrategicModeling(), {
      strategy: { tourneyCost: 1000 },
      compute: { operations: 1000 },
    })
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
    const state = applyGameState(withMegaClippersEnabled(), { production: { funds: 0 } })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyMegaClipper')
    expect(actions.available.map(a => a.type)).not.toContain('buyMegaClipper')
  })

  it('shows buyMegaClipper as available when project22 is completed and funds are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state = applyGameState(withMegaClippersEnabled(), {
      production: {
        autoClippers: 75,
        funds: initialGameState.production.megaClipperCost + 0.01,
      },
    })
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
    const state = applyGameState(withExpansion(), { earth: { harvesterFlag: false } })
    const actions = getActions(state)
    const allActionTypes = [...actions.available, ...actions.unavailable].map(a => a.type)
    expect(allActionTypes).not.toContain('buyHarvester')
  })

  it('shows buyHarvester as unavailable in expansion phase when clips are insufficient', () => {
    const state = applyGameState(withHarvesting(), {
      production: { unusedClips: 0 },
    })
    const actions = getActions(state)
    expect(actions.unavailable.map(a => a.type)).toContain('buyHarvester')
    expect(actions.available.map(a => a.type)).not.toContain('buyHarvester')
  })

  it('shows buyHarvester as available in expansion phase when clips are sufficient', () => {
    const initialGameState = createInitialGameState()
    const state = applyGameState(withHarvesting(), {
      production: { unusedClips: initialGameState.earth.harvesterCost + 1 },
    })
    const actions = getActions(state)
    expect(actions.available.map(a => a.type)).toContain('buyHarvester')
    expect(actions.unavailable.map(a => a.type)).not.toContain('buyHarvester')
  })

  it('does not show buyHarvester in space phase', () => {
    const state = applyGameState(withHarvesting(), withSpacePhase())
    const actions = getActions(state)
    const allActionTypes = [...actions.available, ...actions.unavailable].map(a => a.type)
    expect(allActionTypes).not.toContain('buyHarvester')
  })

  it('classifies deallocation actions as available or unavailable depending on their amounts', () => {
    const spaceState = applyGameState(withSpacePhase(), {
      space: {
        maxTrust: 8,
        probeUsedTrust: 4,
        probeSpeed: 1,
        probeRep: 1,
        probeFac: 1,
        probeWire: 1,
        probeCombat: 1,
      },
      projects: {
        project131: true,
      },
    })
    const actions = getActions(spaceState)
    expect(actions.available.filter(a => a.type === 'deallocateProbeTrust').map(a => a.target)).toEqual(['speed', 'self_replication', 'factory', 'wire_drone', 'combat'])
    expect(actions.unavailable.filter(a => a.type === 'deallocateProbeTrust').map(a => a.target)).toEqual(['exploration', 'hazard_remediation', 'harvester'])
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
    const gameActions = toGameActions({
      type: 'completeProject',
      projectId: 'project1',
      title: 'Improved AutoClippers',
      description: 'Upgrade AutoClippers with a 25% boost.',
      cost: { amount: 750, unit: 'ops' },
    }, applyGameState(withComputeUnlocked()))
    expect(gameActions).toContainEqual({ type: 'completeProject', projectId: 'project1' })
  })

  it('converts chooseInvestmentRisk to the correct number of cycleInvestmentRisk actions', () => {
    const state = applyGameState(withInvestingUnlocked(), { investment: { riskMode: 'med' } })
    const actions = toGameActions({ type: 'chooseInvestmentRisk', mode: 'low' }, state)
    expect(actions).toEqual([
      { type: 'cycleInvestmentRisk' }, // med -> hi
      { type: 'cycleInvestmentRisk' }, // hi -> low
    ])
  })

  it('converts chooseStrategy to the correct number of cycleStrategySelection actions', () => {
    const state = applyGameState({
      strategy: {
        strategies: ['RANDOM', 'A100', 'B100'],
        selectedStrategy: 'B100',
      },
    })
    const actions = toGameActions({ type: 'chooseStrategy', strategy: 'RANDOM' }, state)
    expect(actions).toEqual([
      { type: 'cycleStrategySelection' }, // B100 -> NONE
      { type: 'cycleStrategySelection' }, // NONE -> RANDOM
    ])
  })

  it('increments the set price when price is raised', () => {
    const state = applyGameState({ economy: { clipPrice: 0.5 } })
    const actions = toGameActions({ type: 'raisePrice' }, state)
    expect(actions).toContainEqual({ type: 'setPrice', price: 0.51 })
  })

  it('decrements the set price when price is lowered', () => {
    const state = applyGameState({ economy: { clipPrice: 0.5 } })
    const actions = toGameActions({ type: 'lowerPrice' }, state)
    expect(actions).toContainEqual({ type: 'setPrice', price: 0.49 })
  })

  it('translates probe trust allocation targets', () => {
    const spaceState = applyGameState(withSpacePhase())
    let actions = toGameActions({ type: 'allocateProbeTrust', target: 'speed' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'speed' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'exploration' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'nav' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'self_replication' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'rep' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'hazard_remediation' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'haz' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'factory' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'fac' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'harvester' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'harv' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'wire_drone' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'wire' })
    actions = toGameActions({ type: 'allocateProbeTrust', target: 'combat' }, spaceState)
    expect(actions).toContainEqual({ type: 'allocateProbeTrust', target: 'combat' })
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
