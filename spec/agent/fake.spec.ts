import { describe, expect, it } from "vitest"
import { createInitialGameState, GameState } from "paperclips-remake"
import createFakeAgent from "@/agent/fake"
import { AgentAction } from "@/types"
import { getActions, toAgentState } from "@/agent-adapter"
import { applyComputeState, applyExpansionState } from "../helper"

describe('fake agent', () => {
  const makeClip: AgentAction = { type: 'makeClip' }
  const buyWire: AgentAction = { type: 'buyWire' }
  const buyAutoClipper: AgentAction = { type: 'buyAutoClipper' }
  const addProcessor: AgentAction = { type: 'addProcessor' }
  const addMemory: AgentAction = { type: 'addMemory' }
  const chooseA100: AgentAction = { type: 'chooseStrategy', strategy: 'A100' }
  const lowerPrice: AgentAction = { type: 'lowerPrice' }
  const raisePrice: AgentAction = { type: 'raisePrice' }
  const runTournament: AgentAction = { type: 'runTournament' }
  const buyFarm: AgentAction = { type: 'buyFarm' }
  const buyHarvester: AgentAction = { type: 'buyHarvester' }
  const buyWireDrone: AgentAction = { type: 'buyWireDrone' }
  const buyFactory: AgentAction = { type: 'buyFactory' }
  const buyBattery: AgentAction = { type: 'buyBattery' }
  const wait: AgentAction = { type: 'wait', turns: 1 }

  it('completes project2 (wire begging) when it is available', async () => {
    const state = createInitialGameState()
    const { maker } = createFakeAgent()

    const action: AgentAction = {
      type: 'completeProject',
      projectId: 'project2',
      title: 'Wire Begging',
      description: 'Beg for wire',
    }

    const result = await maker({
      state: toAgentState(state),
      actions: {
        available: [action],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(action)
  })

  it('adds a processor when fewer than 6 are owned', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      compute: { ...initialState.compute, unlocked: true, processors: 5 },
    })
    const { maker } = createFakeAgent()

    const result = await maker({
      state,
      actions: {
        available: [wait, addProcessor],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(addProcessor)
  })

  it('adds memory when 6 or more processors are owned', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      compute: { ...initialState.compute, unlocked: true, processors: 6 },
    })
    const { maker } = createFakeAgent()

    const result = await maker({
      state,
      actions: {
        available: [addMemory],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(addMemory)
  })

  const buyMarketing: AgentAction = { type: 'buyMarketing' }

  it('buys marketing when clip price is at minimum', async () => {
    const initialState = createInitialGameState()
    const { maker } = createFakeAgent()
    const state = {
      ...initialState,
      economy: { ...initialState.economy, clipPrice: 0.01 }
    }
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, buyMarketing], unavailable: [] }
    })
    expect(action).toEqual(buyMarketing)
  })

  it('chooses A100 strategy when available', async () => {
    const initialState = createInitialGameState()
    const { maker } = createFakeAgent()

    const result = await maker({
      state: toAgentState(initialState),
      actions: {
        available: [chooseA100, makeClip],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(chooseA100)
  })

  it('buys an auto clipper when under 75 and funds allow', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      production: {
        ...initialState.production,
        autoClippers: 74,
        autoClipperCost: 10,
        funds: 200,
      },
      economy: {
        ...initialState.economy,
        wireCost: 100,
      },
    })
    const { maker } = createFakeAgent()

    const result = await maker({
      state,
      actions: {
        available: [buyAutoClipper],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(buyAutoClipper)
  })

  it('makes a clip when no other actions are available', async () => {
    const initialState = createInitialGameState()
    const { maker } = createFakeAgent()

    const result = await maker({
      state: toAgentState(initialState),
      actions: {
        available: [makeClip, buyWire],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(makeClip)
  })

  it('buys wire when wire supply is below demand', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      production: {
        ...initialState.production,
        wire: 99,
      },
      economy: {
        ...initialState.economy,
        demand: 100,
      },
    })
    const { maker } = createFakeAgent()

    const result = await maker({
      state,
      actions: {
        available: [buyWire, makeClip],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(buyWire)
  })

  it('buys wire when it is cheap', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      economy: {
        ...initialState.economy,
        wireCost: 16,
      },
    })
    const { maker } = createFakeAgent()

    const { action } = await maker({
      state,
      actions: {
        available: [makeClip, buyWire],
        unavailable: [],
      },
    })

    expect(action).toEqual(buyWire)
  })

  it('waits when no actions are available', async () => {
    const initialState = createInitialGameState()
    const { maker } = createFakeAgent()

    const result = await maker({
      state: toAgentState(initialState),
      actions: {
        available: [],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(wait)
  })

  it('lowers price when unsold inventory exceeds 10 ticks of demand', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      production: {
        ...initialState.production,
        unsoldClips: 1001,
      },
      economy: {
        ...initialState.economy,
        demand: 100,
      },
    })
    const { maker } = createFakeAgent()

    const result = await maker({
      state,
      actions: {
        available: [lowerPrice, buyWire],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(lowerPrice)
  })

  it('raises price when unsold inventory is below 3 ticks of demand', async () => {
    const initialState = createInitialGameState()
    const state = toAgentState({
      ...initialState,
      production: {
        ...initialState.production,
        unsoldClips: 299,
      },
      economy: {
        ...initialState.economy,
        demand: 100,
      },
    })
    const { maker } = createFakeAgent()

    const result = await maker({
      state,
      actions: {
        available: [raisePrice, buyWire],
        unavailable: [],
      },
    })

    expect(result.action).toEqual(raisePrice)
  })

  it('runs tournament when available and creativity is above floor and ops are above 90%', async () => {
    const { maker } = createFakeAgent()
    const state = applyComputeState({ compute: { creativity: 1000, operations: 90000, memory: 100 } })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, runTournament], unavailable: [] }
    })
    expect(action).toEqual(runTournament)
  })

  it('does not run tournament when creativity is below compute phase floor', async () => {
    const { maker } = createFakeAgent()
    const state = applyComputeState({ compute: { creativity: 0 } })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, runTournament], unavailable: [] }
    })
    expect(action).not.toEqual(runTournament)
  })

  it('does not run tournament when ops are below 90%', async () => {
    const { maker } = createFakeAgent()
    const state = applyComputeState({ compute: { creativity: 1000, operations: 89999, memory: 100 } })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, runTournament], unavailable: [] }
    })
    expect(action).not.toEqual(runTournament)
  })

  const hypnoDrones: AgentAction = { type: 'completeProject', projectId: 'project70', title: 'HypnoDrones', description: 'Unlock the final human-to-post-human transition project.' }

  it('does not run tournament when HypnoDrones is unavailable and memory is sufficient', async () => {
    const { maker } = createFakeAgent()
    const state = applyComputeState({ compute: { creativity: 1000, memory: 70 } })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, runTournament], unavailable: [hypnoDrones] }
    })
    expect(action).not.toEqual(runTournament)
  })

  it('does not run tournament when creativity is below expansion floor', async () => {
    const { maker } = createFakeAgent()
    const state = applyExpansionState({ compute: { creativity: 5000 } })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, runTournament], unavailable: [] }
    })
    expect(action).not.toEqual(runTournament)
  })

  it('buys farm when next purchase would exceed power production', async () => {
    const { maker } = createFakeAgent()
    const state = applyExpansionState({
      earth: {
        tothFlag: true, powerGridFlag: true, harvesterFlag: true, wireDroneFlag: true,
        powerProductionRate: 10,
        powerConsumptionRate: 10,
      }
    })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, buyFarm, buyHarvester], unavailable: [] }
    })
    expect(action).toEqual(buyFarm)
  })

  it('buys wire drone when wire drone to harvester ratio is below 0.809', async () => {
    const { maker } = createFakeAgent()
    const state = applyExpansionState({
      earth: {
        tothFlag: true, powerGridFlag: true, harvesterFlag: true, wireDroneFlag: true,
        powerProductionRate: 100,
        harvesterLevel: 10, wireDroneLevel: 0
      }
    })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, buyWireDrone, buyHarvester], unavailable: [] }
    })
    expect(action).toEqual(buyWireDrone)
  })
  it('buys factory when ratio is in range and wire is accumulating', async () => {
    const { maker } = createFakeAgent()
    const state = applyExpansionState({
      earth: {
        tothFlag: true, powerGridFlag: true, harvesterFlag: true, wireDroneFlag: true,
        powerProductionRate: 100,
        harvesterLevel: 10,
        wireDroneLevel: 16,
        nanoWire: 1_000_000,
        acquiredMatter: 0,
      }
    })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, buyFactory, buyHarvester, buyWireDrone], unavailable: [] }
    })
    expect(action).toEqual(buyFactory)
  })

  it('buys battery when storage is at capacity', async () => {
    const { maker } = createFakeAgent()
    const state = applyExpansionState({
      earth: {
        tothFlag: true, powerGridFlag: true, harvesterFlag: true, wireDroneFlag: true,
        storedPower: 40_000,
        batteryLevel: 4,
      }
    })
    const { action } = await maker({
      state: toAgentState(state),
      actions: { available: [wait, buyBattery, buyHarvester], unavailable: [] }
    })
    expect(action).toEqual(buyBattery)
  })
})
