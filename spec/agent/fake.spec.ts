import { describe, expect, it } from "vitest"
import { createInitialGameState } from "paperclips-remake"
import createFakeAgent from "@/agent/fake"
import type { AgentAction } from "@/types"
import { applyGameState, withComputeUnlocked, withCreativity, withExpansion, withIndustryPhase } from "../helper"

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
  const dummy = { type: 'dummy' } as unknown as AgentAction

  it('completes project2 (wire begging) when it is available', async () => {
    const { play } = createFakeAgent().createPlayer([])

    const project2: AgentAction = {
      type: 'completeProject',
      projectId: 'project2',
      title: 'Wire Begging',
      description: 'Beg for wire',
      cost: { amount: 1, unit: 'trust' },
    }

    const { plan } = await play({
      state: createInitialGameState(),
      actions: {
        available: [project2],
        unavailable: [],
      },
    })

    expect(plan).toEqual([project2])
  })

  it('adds a processor when fewer than 5 are owned', async () => {
    const state = applyGameState(withComputeUnlocked(), { compute: { processors: 4 } })
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state,
      actions: {
        available: [dummy, addProcessor, addMemory],
        unavailable: [],
      },
    })

    expect(plan).toEqual([addProcessor])
  })

  it('adds memory when 6 or more processors are owned', async () => {
    const state = applyGameState(withComputeUnlocked(), { compute: { processors: 6 } })
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state,
      actions: {
        available: [dummy, addProcessor, addMemory],
        unavailable: [],
      },
    })

    expect(plan).toEqual([addMemory])
  })

  const buyMarketing: AgentAction = { type: 'buyMarketing' }

  it('buys marketing when clip price is at minimum', async () => {
    const state = applyGameState({ economy: { clipPrice: 0.01 } })
    const { play } = createFakeAgent().createPlayer([])
    const { plan } = await play({
      state,
      actions: { available: [dummy, buyMarketing], unavailable: [] }
    })
    expect(plan).toEqual([buyMarketing])
  })

  it('chooses A100 strategy when available', async () => {
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state: createInitialGameState(),
      actions: {
        available: [chooseA100, makeClip],
        unavailable: [],
      },
    })

    expect(plan).toEqual([chooseA100])
  })

  it('buys an auto clipper when under 75 and funds allow', async () => {
    const state = applyGameState({
      production: {
        autoClippers: 74,
        autoClipperCost: 10,
        funds: 200,
      },
      economy: {
        wireCost: 100,
      },
    })
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state,
      actions: {
        available: [buyAutoClipper],
        unavailable: [],
      },
    })

    expect(plan).toEqual([buyAutoClipper])
  })

  it('makes a clip when no other actions are available', async () => {
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state: createInitialGameState(),
      actions: {
        available: [makeClip, buyWire],
        unavailable: [],
      },
    })

    expect(plan).toEqual([makeClip])
  })

  it('buys wire when wire supply is below demand', async () => {
    const state = applyGameState({
      production: {
        wire: 99,
      },
      economy: {
        demand: 100,
      },
    })
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state,
      actions: {
        available: [buyWire, makeClip],
        unavailable: [],
      },
    })

    expect(plan).toEqual([buyWire])
  })

  it('buys wire when it is cheap', async () => {
    const state = applyGameState({
      economy: {
        wireCost: 16,
      },
    })
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state,
      actions: {
        available: [dummy, makeClip, buyWire],
        unavailable: [],
      },
    })

    expect(plan).toEqual([buyWire])
  })

  it('waits when no actions are available', async () => {
    const { play } = createFakeAgent().createPlayer([])

    const { plan } = await play({
      state: createInitialGameState(),
      actions: {
        available: [],
        unavailable: [],
      },
    })

    expect(plan).toEqual([wait])
  })

  it('lowers price when unsold inventory exceeds 90 ticks of demand', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withIndustryPhase(), {
      production: {
        unsoldClips: 9_001,
      },
      economy: {
        demand: 100,
      },
    })

    const { plan } = await play({
      state,
      actions: {
        available: [dummy, lowerPrice, buyWire],
        unavailable: [],
      },
    })

    expect(plan).toEqual([lowerPrice])
  })

  it('raises price when unsold inventory is below 45/2 ticks of demand', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withIndustryPhase(), {
      production: {
        autoClippers: 1,
        unsoldClips: 110,
      },
      economy: {
        demand: 5,
      },
    })

    const { plan } = await play({
      state,
      actions: {
        available: [dummy, raisePrice, buyWire],
        unavailable: [],
      },
    })

    expect(plan).toEqual([raisePrice])
  })

  it('runs tournament when available and creativity is above floor and ops are above 90%', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withCreativity(), { compute: { creativity: 1000, operations: 90000, memory: 100 } })
    const { plan } = await play({
      state,
      actions: { available: [dummy, runTournament], unavailable: [] }
    })
    expect(plan).toEqual([runTournament])
  })

  it('does not run tournament when creativity is below compute phase floor', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withComputeUnlocked(), { compute: { creativity: 0 } })
    const { plan } = await play({
      state,
      actions: { available: [dummy, runTournament], unavailable: [] }
    })
    expect(plan).not.toEqual([runTournament])
  })

  it('does not run tournament when ops are below 90%', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withComputeUnlocked(), { compute: { creativity: 1000, operations: 89999, memory: 100 } })
    const { plan } = await play({
      state,
      actions: { available: [dummy, runTournament], unavailable: [] }
    })
    expect(plan).not.toEqual([runTournament])
  })

  const hypnoDrones: AgentAction = { type: 'completeProject', projectId: 'project70', title: 'HypnoDrones', description: 'Unlock the final human-to-post-human transition project.', cost: { amount: 70_000, unit: 'ops' } }

  it('does not run tournament when HypnoDrones is unavailable and memory is sufficient', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withComputeUnlocked(), { compute: { creativity: 1000, memory: 70 } })
    const { plan } = await play({
      state,
      actions: { available: [dummy, runTournament], unavailable: [hypnoDrones] }
    })
    expect(plan).not.toEqual([runTournament])
  })

  it('does not run tournament when creativity is below expansion floor', async () => {
    const { play } = createFakeAgent().createPlayer([])
    const state = applyGameState(withExpansion(), { compute: { creativity: 5000 } })
    const { plan } = await play({
      state,
      actions: { available: [dummy, runTournament], unavailable: [] }
    })
    expect(plan).not.toEqual([runTournament])
  })

  it('buys farm when next purchase would exceed power production', async () => {
    const { play } = createFakeAgent().createPlayer([])
    await play({ state: applyGameState(withExpansion()), actions: { available: [], unavailable: [] } })
    const state = applyGameState(withExpansion(), {
      earth: {
        tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
        powerProductionRate: 10,
        powerConsumptionRate: 10,
      }
    })
    const { plan } = await play({
      state,
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    expect(plan).toEqual([buyFarm])
  })

  it('buys a farm when the power production rate is lower than the consumption rate', async () => {
    const { play } = createFakeAgent().createPlayer([])
    await play({ state: applyGameState(withExpansion()), actions: { available: [], unavailable: [] } })
    const state = applyGameState(withExpansion(), {
      production: {
        wire: 100,
      },
      earth: {
        tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
        farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
        powerProductionRate: 10,
        powerConsumptionRate: 100,
      },
    })
    const { plan } = await play({
      state,
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    expect(plan).toEqual([buyFarm])
  })

  it('buys battery when storage is at capacity and factory purchase is not held up for long', async () => {
    const { play } = createFakeAgent().createPlayer([])
    await play({ state: applyGameState(withExpansion()), actions: { available: [], unavailable: [] } })
    const state = applyGameState(withExpansion(), {
      lastTickProduction: 100000000,
      production: {
        unusedClips: 100000000,
        wire: 100,
      },
      earth: {
        tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
        farmLevel: 1, batteryLevel: 4, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
        powerProductionRate: 200,
        powerConsumptionRate: 100,
        storedPower: 40_000,
      }
    })
    const { plan } = await play({
      state,
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    expect(plan).toEqual([buyBattery])
  })

  it('buys a harvester when acquired matter is trending downward', async () => {
    const { play } = createFakeAgent().createPlayer([])
    await play({ state: applyGameState(withExpansion()), actions: { available: [], unavailable: [] } })
    await play({
      state: applyGameState(withExpansion(), {
        production: {
          wire: 100,
        },
        earth: {
          tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
          farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
          powerProductionRate: 200,
          powerConsumptionRate: 100,
          acquiredMatter: 5,
        }
      }),
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    const { plan } = await play({
      state: applyGameState(withExpansion(), {
        production: {
          wire: 100,
        },
        earth: {
          tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
          farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
          powerProductionRate: 200,
          powerConsumptionRate: 100,
          acquiredMatter: 4,
        }
      }),
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    expect(plan).toEqual([buyHarvester])
  })
  it('buys a wire drone when wire is trending downward', async () => {
    const { play } = createFakeAgent().createPlayer([])
    await play({ state: applyGameState(withExpansion()), actions: { available: [], unavailable: [] } })
    await play({
      state: applyGameState(withExpansion(), {
        production: {
          wire: 200,
        },
        earth: {
          tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
          farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
          powerProductionRate: 200,
          powerConsumptionRate: 100,
          acquiredMatter: 100,
        }
      }),
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    const { plan } = await play({
      state: applyGameState(withExpansion(), {
        production: {
          wire: 100,
        },
        earth: {
          tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
          farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
          powerProductionRate: 200,
          powerConsumptionRate: 100,
          acquiredMatter: 100,
        }
      }),
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    expect(plan).toEqual([buyWireDrone])
  })

  it('buys a factory when wire is trending upward', async () => {
    const { play } = createFakeAgent().createPlayer([])
    await play({ state: applyGameState(withExpansion()), actions: { available: [], unavailable: [] } })
    await play({
      state: applyGameState(withExpansion(), {
        production: {
          wire: 100,
        },
        earth: {
          tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
          farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
          powerProductionRate: 200,
          powerConsumptionRate: 100,
          acquiredMatter: 100,
        }
      }),
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    const { plan } = await play({
      state: applyGameState(withExpansion(), {
        production: {
          wire: 200,
        },
        earth: {
          tothFlag: true, powerGridFlag: true, wireProductionFlag: true, harvesterFlag: true, wireDroneFlag: true, factoryFlag: true,
          farmLevel: 1, batteryLevel: 1, harvesterLevel: 1, wireDroneLevel: 1, factoryLevel: 1,
          powerProductionRate: 200,
          powerConsumptionRate: 100,
          acquiredMatter: 100,
        }
      }),
      actions: { available: [dummy, buyFarm, buyBattery, buyHarvester, buyWireDrone, buyFactory], unavailable: [] }
    })
    expect(plan).toEqual([buyFactory])
  })
})
