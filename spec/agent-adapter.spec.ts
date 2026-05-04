import { describe, it, expect } from "vitest"
import { createInitialGameState, type GamePhase, type GameState } from "paperclips-remake"
import { getActions, toAgentState, toGameAction } from "@/agent-adapter"

describe('toAgentState', () => {
  it('does not expose internal implementation details to the agent', () => {
    const state = createInitialGameState()
    const agentState = toAgentState(state)

    expect(agentState).not.toHaveProperty('version')
    expect(agentState).not.toHaveProperty('paused')
    expect(agentState).not.toHaveProperty('prestige')
    expect(agentState).not.toHaveProperty('wirePurchased')
    expect(agentState).not.toHaveProperty('lastTickProduction')
    expect(agentState).not.toHaveProperty('lastTickSales')
    expect(agentState).not.toHaveProperty('lastTickRevenue')
    expect(agentState).not.toHaveProperty('lastAction')
    expect(agentState).not.toHaveProperty('earth')
  })

  it('only exposes unlockable subsystems when they are unlocked', () => {
    const initialState = createInitialGameState()

    const allLocked = {
      ...initialState,
      compute: { ...initialState.compute, unlocked: false },
      investment: { ...initialState.investment, unlocked: false },
      strategy: { ...initialState.strategy, unlocked: false },
    }
    const agentStateLocked = toAgentState(allLocked)
    expect(agentStateLocked).not.toHaveProperty('compute')
    expect(agentStateLocked).not.toHaveProperty('investment')
    expect(agentStateLocked).not.toHaveProperty('strategy')

    const allUnlocked = {
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
})

describe('getActions', () => {
  it('can make a clip at game start', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    expect(actions.available).toContainEqual({type: 'makeClip'})
    expect(actions.unavailable).not.toContainEqual({type: 'makeClip'})
  })

  it('does not show buyAutoClipper in boot phase', () => {
    const state = createInitialGameState()
    const actions = getActions(state)
    const allActionTypes = [...actions.available, ...actions.unavailable].map(a => a.type)
    expect(allActionTypes).not.toContain('buyAutoClipper')
  })

  it('shows buyAutoClipper as unavailable in industry phase when funds are insufficient', () => {
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
})

// TODO we have other actions to manage here before we're done
describe('toGameAction', () => {
  it('fills in the wire amount for buyWire', () => {
    const initialState = createInitialGameState()
    const gameAction = toGameAction({ type: 'buyWire' }, initialState)
    expect(gameAction).toEqual({ type: 'buyWire', amount: initialState.economy.wireSupply })
  })
})
