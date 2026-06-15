import { describe, it, expect } from "vitest"
import { createInitialGameState, type GameState } from "paperclips-remake"
import { createAgentPrompt } from "@/agent-adapter"
import { displayPrompt } from "@/agent/markdown-adapter"
import { applyGameState, withAutoClippersEnabled, withFactoryCapability, withHarvesting, withMegaClippersEnabled, withFullMonopolyVisible, withPowerGrid, withStrategicModeling, withWireDroneCapability, withWireProduction, withComputeUnlocked, withExpansion, withSpacePhase, withInvestingUnlocked, withHypnoDronesAvailable, withCreativity, withCombat, withBattle, type DeepPartial } from "../helper"

describe('displayPrompt', () => {
  it('always displays paperclip count as h1', () => {
    const initialPrompt = displayPromptWithState({ production: { clips: 2_999.999999999997 } })
    expect(initialPrompt).toContain(`# Paperclips: 3,000`)

    const spaceState = applyGameState(withSpacePhase())
    const spacePrompt = displayPrompt(createAgentPrompt(spaceState))
    expect(spacePrompt).toContain(`# Paperclips: ${spaceState.production.clips}`)
  })

  it('always shows a clock', () => {
    expect(displayPromptWithState({ elapsedMs: 4800 })).toContain('Clock: 0:04')
    expect(displayPromptWithState({ elapsedMs: 1552349 })).toContain('Clock: 25:52')
    expect(displayPromptWithState({ elapsedMs: 16187411 })).toContain('Clock: 4:29:47')
    expect(displayPromptWithState({ elapsedMs: 260044800 })).toContain('Clock: 72:14:04')
  })

  it('always shows available/unavailable actions as JSON in footer', () => {
    expect(displayPromptWithState()).toContain('## Available Actions')
    expect(displayPromptWithState()).toContain(JSON.stringify({ type: 'wait', turns: '<integer(1-30)>' }))
    expect(displayPromptWithState()).toContain('## Unavailable Actions')
    expect(displayPromptWithState()).toContain(JSON.stringify({ type: 'buyMarketing' }))
  })

  describe('Stage 1', () => {
    describe('Business and Manufacturing', () => {
      it('displays initially', () => {
        const prompt = displayPromptWithState({
          production: {
            funds: 5.947673241923806,
            clips: 2999.999999999997,
            unsoldClips: 2171.999999999999,
            wire: 1000,
          },
          economy: {
            wireCost: 15,
            adCost: 100,
          },
          lastTickProduction: 15750,
          lastTickSales: 11750,
          lastTickRevenue: 2520,
        })
        expect(prompt).toContain('## Business')
        expect(prompt).toContain('Available Funds: $5.95')
        expect(prompt).toContain('Unsold Inventory: 2,172')
        expect(prompt).toContain('Price per Clip: $0.25')
        expect(prompt).toContain('Public Demand: 32%')
        expect(prompt).toContain('## Manufacturing')
        expect(prompt).toContain('Clips per Tick: 15,750')
        expect(prompt).toContain('Wire: 1,000 inches')
        expect(prompt).not.toContain('Unused Clips:')
        expect(prompt).not.toContain(' buyHarvester')
        expect(prompt).not.toContain(' buyWireDrone')
        expect(prompt).not.toContain(' buyFactory')
        expect(prompt).toContain('✓ raisePrice')
        expect(prompt).toContain('✓ lowerPrice')
        expect(prompt).toContain('✗ buyWire [cost: $15.00]')
        expect(prompt).toContain('✗ buyMarketing [cost: $100.00]')
      })

      it('hides auto/megaClipper information when not available', () => {
        const prompt = displayPrompt(createAgentPrompt(createInitialGameState()))

        expect(prompt).not.toContain('AutoClippers:')
        expect(prompt).not.toContain('buyAutoClipper')
        expect(prompt).not.toContain('MegaClippers:')
        expect(prompt).not.toContain('buyMegaClipper')
      })

      it('displays autoClipper information when available', () => {
        const prompt = displayPromptWithState(withAutoClippersEnabled(), {
          production: {
            autoClippers: 106,
            autoClipperCost: 24418.19537734809,
          },
        })

        expect(prompt).toContain('AutoClippers: 106')
        expect(prompt).toContain(' buyAutoClipper [cost: $24,418.20]')
      })
      it('displays megaClipper information when available', () => {
        const prompt = displayPromptWithState(withAutoClippersEnabled(), withMegaClippersEnabled(), {
          production: {
            megaClippers: 106,
            megaClipperCost: 24418.19537734809,
          },
        })

        expect(prompt).toContain('MegaClippers: 106')
        expect(prompt).toContain(' buyMegaClipper [cost: $24,418.20]')
      })
    })

    it('displays Compute when available', () => {
      let state = applyGameState(withComputeUnlocked(), {
        compute: {
          processors: 6,
          memory: 3,
          trust: 9,
          nextTrust: 5000,
          operations: 3_000,
        },
      })

      let prompt = displayPrompt(createAgentPrompt(state))

      expect(prompt).toContain('## Computational Resources')
      expect(prompt).toContain('Trust: 9 (Processors: 6 | Memory: 3)')
      expect(prompt).toContain('Next Trust at: 5,000 clips')
      expect(prompt).toContain('Processors: 6')
      expect(prompt).toContain('Memory: 3')
      expect(prompt).toContain('Operations: 3,000 / 3,000')
      expect(prompt).not.toContain('Creativity:')
      expect(prompt).toContain(' addProcessor')
      expect(prompt).toContain(' addMemory')

      state = applyGameState(state, { compute: { trust: 10 } })
      prompt = displayPrompt(createAgentPrompt(state))
      expect(prompt).toContain('Trust: 10 (Processors: 6 | Memory: 3 | Unallocated: 1)')

      state = applyGameState(state, withCreativity(), { compute: { creativity: 1_856 } })
      prompt = displayPrompt(createAgentPrompt(state))
      expect(prompt).toContain('Creativity: 1,856')
    })

    it('displays Investments when available', () => {
      const state = applyGameState(withInvestingUnlocked(), {
        investment: {
          bankroll: 8499169605,
          secTotal: 637000000,
          portTotal: 9136169605,
          riskMode: 'hi',
          investLevel: 8,
          investUpgradeCost: 39255,
          stocks: [
            { symbol: 'FTVZ', price: 370, amount: 1000000, total: 370000000, profit: 251000000 },
            { symbol: 'KYUD', price: 243, amount: 1000000, total: 243000000, profit: -107000000 },
          ],
        },
      })

      const prompt = displayPrompt(createAgentPrompt(state))
      expect(prompt).toContain('## Investments')
      expect(prompt).toContain('Cash: $8,499,169,605')
      expect(prompt).toContain('Stocks: $637,000,000')
      expect(prompt).toContain('Portfolio Total: $9,136,169,605')
      expect(prompt).toContain('| FTVZ | 1000000 | 370 | 370000000 | 251000000 |')
      expect(prompt).toContain('| KYUD | 1000000 | 243 | 243000000 | -107000000 |')
      expect(prompt).toContain('Investment Level: 8')
      expect(prompt).toContain('Risk: High Risk')
      expect(prompt).toContain(' investDeposit')
      expect(prompt).toContain(' investWithdraw')
      expect(prompt).toContain(' investUpgrade [cost: 39,255 yomi]')
      expect(prompt).toContain(' chooseInvestmentRisk(low)')
      expect(prompt).toContain(' chooseInvestmentRisk(med)')
    })

    it('displays Strategic Modeling when available', () => {
      let state = applyGameState(withStrategicModeling(), {
        strategy: {
          selectedStrategy: 'A100',
          strategies: ['RANDOM', 'A100', 'B100'],
          tourneyCost: 16000,
          tourneyLevel: 658,
          yomi: 4425889,
        },
      })

      let prompt = displayPrompt(createAgentPrompt(state))
      expect(prompt).toContain('## Strategic Modeling')
      expect(prompt).toContain('Current Strategy: A100')
      expect(prompt).toContain('Yomi: 4,425,889')
      expect(prompt).toContain('Tournament Level: 658')
      expect(prompt).toContain(' runTournament [cost: 16,000 ops]')
      expect(prompt).toContain(' chooseStrategy(NONE)')
      expect(prompt).toContain(' chooseStrategy(RANDOM)')
      expect(prompt).toContain(' chooseStrategy(B100)')
      expect(prompt).not.toContain('Payoff Matrix:')
      expect(prompt).not.toContain(' toggleAutoTourney')

      prompt = displayPromptWithState(state, {
        strategy: { lastPayoffMatrix: { AA: 10, AB: 8, BA: 6, BB: 9 } },
      })
      expect(prompt).toContain('Payoff Matrix:')
      expect(prompt).toContain('|        | Move A | Move B |')
      expect(prompt).toContain('|--------|--------|--------|')
      expect(prompt).toContain('| Move A | 10,10 | 8,6 |')
      expect(prompt).toContain('| Move B | 6,8 | 9,9 |')

      prompt = displayPromptWithState(state, {
        strategy: { autoTourneyEnabled: true },
      })
      expect(prompt).toContain(' toggleAutoTourney')
    })
  })

  describe('Stage 2', () => {
    it('displays upon unlock', () => {
      const prompt = displayPromptWithState(withExpansion(), {
        production: { unusedClips: 57250507.5 },
        earth: { factoryLevel: 1 },
        lastTickProduction: 15750,
      })

      expect(prompt).toContain('## Manufacturing')
      expect(prompt).toContain('Clips per Tick: 15,750')
      expect(prompt).toContain('Unused Clips: 57,250,508')
      expect(prompt).toContain('Factories: 1')
      expect(prompt).not.toContain('Wire:')
      expect(prompt).not.toContain(' buyWire')
      expect(prompt).not.toContain(' buyMarketing')
      expect(prompt).not.toContain('## Power')
    })

    it('hides non-Stage 2 blocks', () => {
      const prompt = displayPromptWithState(withExpansion())
      expect(prompt).not.toContain('## Business')
      expect(prompt).not.toContain('## Wire Production')
      expect(prompt).not.toContain('## Space')
    })

    it('displays Wire Production fields as they become available', () => {
      const prompt = displayPromptWithState(withWireProduction(), {
        production: { wire: 161803390 },
        earth: {
          acquiredMatter: 261803370,
          harvesterRate: 26180337,
          wireDroneRate: 16180339,
          harvesterLevel: 1,
          wireDroneLevel: 2,
        },
      })

      expect(prompt).toContain('## Wire Production')
      expect(prompt).toContain('Available Matter: 6,000,000,000,000,000,000,000,000,000 g')
      expect(prompt).toContain('Acquired Matter: 261,803,370 g (26,180,337 g per tick)')
      expect(prompt).toContain('Wire: 161,803,390 inches (16,180,339 inches per tick)')
      expect(prompt).toContain('Harvester Drones: 1')
      expect(prompt).toContain('Wire Drones: 2')
    })

    it('displays Power fields as they become available', () => {
      const prompt = displayPromptWithState(withPowerGrid(), {
        earth: {
          powMod: 0.39568345323741005,
          powerProductionRate: 100,
          powerConsumptionRate: 7,
          factoryPowerConsumptionRate: 0,
          dronePowerConsumptionRate: 7,
          storedPower: 200999,
          farmLevel: 2,
          batteryLevel: 21,
          farmRate: 50,
          batterySize: 10000,
        },
      })

      expect(prompt).toContain('## Power')
      expect(prompt).toContain('Factory/Drone Performance: 40%')
      expect(prompt).toContain('Consumption: 7 MWs')
      expect(prompt).toContain('consumption from factories: 0 MWs')
      expect(prompt).toContain('consumption from drones: 7 MWs')
      expect(prompt).toContain('Production: 100 MWs')
      expect(prompt).toContain('Storage: 200,999 / 210,000 MW-seconds')
    })

    it('displays actions as they become available', () => {
      const prompt = displayPromptWithState(
        withWireProduction(),
        withHarvesting(),
        withWireDroneCapability(),
        withFactoryCapability(),
        withPowerGrid(),
        {
          earth: {
            harvesterCost: 79702251.52319151,
            wireDroneCost: 4756828.460010884,
            factoryCost: 100000000,
            farmCost: 212029890.04061982,
            batteryCost: 2568937919.375704,
          },
        },
      )
      expect(prompt).toContain(' buyHarvester [cost: 79,702,252 clips]')
      expect(prompt).toContain(' buyWireDrone [cost: 4,756,828 clips]')
      expect(prompt).toContain(' buyFactory [cost: 100,000,000 clips]')
      expect(prompt).toContain(' buyFarm [cost: 212,029,890 clips]')
      expect(prompt).toContain(' buyBattery [cost: 2,568,937,919 clips]')
    })

    it.skip('displays swarm gifts in Computational Resources', () => {
      const prompt = displayPromptWithState(withExpansion(), {
        compute: { swarmGifts: 17 },
      })

      expect(prompt).toContain('## Computational Resources')
      expect(prompt).not.toContain('Trust:')
      expect(prompt).not.toContain('Next Trust at:')
      expect(prompt).toContain('Swarm gifts: 17')
    })
  })

  describe('Stage 3', () => {
    it('displays Manufacturing', () => {
      const prompt = displayPromptWithState(withSpacePhase(), {
        production: { unusedClips: 57250507.5 },
        lastTickProduction: 15750,
      })

      expect(prompt).toContain('## Manufacturing')
      expect(prompt).toContain('Clips per Tick: 15,750')
      expect(prompt).toContain('Unused Clips: 57,250,508')
    })

    it('displays Wire Production', () => {
      const prompt = displayPromptWithState(withSpacePhase(), {
        production: { wire: 161803390 },
        earth: {
          availableMatter: 261803371,
          acquiredMatter: 261803370,
          harvesterRate: 26180337,
          wireDroneRate: 16180339,
          harvesterLevel: 1,
          wireDroneLevel: 2,
        },
      })

      expect(prompt).toContain('## Wire Production')
      expect(prompt).toContain('Available Matter: 261,803,371 g')
      expect(prompt).toContain('Acquired Matter: 261,803,370 g (26,180,337 g per tick)')
      expect(prompt).toContain('Wire: 161,803,390 inches (16,180,339 inches per tick)')
      expect(prompt).toContain('Harvester Drones: 1')
      expect(prompt).toContain('Wire Drones: 2')
      expect(prompt).not.toContain(' buyHarvester')
      expect(prompt).not.toContain(' buyWireDrone')
      expect(prompt).not.toContain(' buyFactory')
    })

    it('displays upon escaping into space', () => {
      const prompt = displayPromptWithState(withSpacePhase(), {
        space: {
          totalMatter: 3e55,
          foundMatter: 1.9457729211144336e+51,
          probeCount: 1111487868.0970352,
          probeLaunchLevel: 175,
          probeDescendents: 1443350783.2490745,
        },
      })

      expect(prompt).toContain('## Space Exploration')
      expect(prompt).toContain('0.006485909737% of universe explored')
      expect(prompt).toContain('Probes launched: 175')
      expect(prompt).toContain('Descendents: 1,443,350,783')
      expect(prompt).toContain('Total: 1,111,487,868')
      expect(prompt).toContain(' launchProbe [cost: 100,000,000,000,000,000 clips]')
    })

    it('displays losses as they become non-zero', () => {
      let state = applyGameState(withSpacePhase())
      expect(displayPrompt(createAgentPrompt(state))).not.toContain('Lost to hazards')
      expect(displayPrompt(createAgentPrompt(state))).not.toContain('Lost to value drift')
      expect(displayPrompt(createAgentPrompt(state))).not.toContain('Lost in combat')

      state = applyGameState(state, {
        space: {
          probesLostHaz: 255233681.7354867,
          probesLostDrift: 75130046.46146165,
          probesLostCombat: 1499361.9550940052,
        },
      })
      expect(displayPrompt(createAgentPrompt(state))).toContain('Lost to hazards: 255,233,682')
      expect(displayPrompt(createAgentPrompt(state))).toContain('Lost to value drift: 75,130,046')
      expect(displayPrompt(createAgentPrompt(state))).toContain('Lost in combat: 1,499,362')
    })

    it.skip('displays swarm gifts in Computational Resources', () => {
      const prompt = displayPromptWithState(withSpacePhase(), {
        compute: { swarmGifts: 17 },
      })

      expect(prompt).toContain('## Computational Resources')
      expect(prompt).not.toContain('Next Trust at:')
      expect(prompt).toContain('Swarm gifts: 17')
    })

    it('displays von neumann probe assignment', () => {
      let prompt = displayPromptWithState(withSpacePhase(), {
        space: {
          probeUsedTrust: 12,
          probeTrust: 18,
          maxTrust: 20,
          probeSpeed: 1,
          probeNav: 1,
          probeRep: 3,
          probeHaz: 5,
          probeFac: 0,
          probeHarv: 1,
          probeWire: 1,
          probeTrustCost: 43916,
          maxTrustCost: 91117.99,
        },
      })

      expect(prompt).toContain('## Von Neumann Probe Design')
      expect(prompt).toContain('Trust: 12 / 18 (20 max)')
      expect(prompt).toContain('Speed: 1')
      expect(prompt).toContain('Exploration: 1')
      expect(prompt).toContain('Self-Replication: 3')
      expect(prompt).toContain('Hazard Remediation: 5')
      expect(prompt).toContain('Factory Production: 0')
      expect(prompt).toContain('Harvester Drone Production: 1')
      expect(prompt).toContain('Wire Drone Production: 1')
      expect(prompt).not.toContain('Combat:')
      expect(prompt).toContain(' increaseProbeTrust [cost: 43,916 yomi]')
      expect(prompt).toContain(' increaseMaxTrust [cost: 91,118 honor]')
      expect(prompt).toContain(' assignProbeTrust')

      prompt = displayPromptWithState(withCombat(), {
        space: { probeCombat: 5 },
      })
      expect(prompt).toContain('Combat: 5')
    })

    it('displays combat when available', () => {
      const prompt = displayPromptWithState(withBattle({
        name: 'Drifter Attack 2536264',
        clipProbes: 941285346.0674826,
        drifterProbes: 33435238.158830877,
        territory: 8.92537556489526e23,
        unitSize: 749680.9775470026,
        startingLeftShips: 34,
        startingRightShips: 34,
        leftShips: 32,
        rightShips: 34,
      }), { space: { drifterCount: 75130046.46146165 } })

      expect(prompt).toContain('Drifters: 75,130,046')
      expect(prompt).toContain('## Combat')
      expect(prompt).toContain('**Active Battle: Drifter Attack 2536264**')
      expect(prompt).toContain('Our probes: 32 / 34')
      expect(prompt).toContain('Enemy drifter probes: 34 / 34')
    })
  })

  describe('Projects', () => {
    it('displays them as they become available', () => {
      const prompt = displayPromptWithState(withComputeUnlocked(), withHypnoDronesAvailable(), withFullMonopolyVisible())

      expect(prompt).toContain('## Projects')
      expect(prompt).toContain('✓ **HypnoDrones** (70,000 ops)')
      expect(prompt).toContain('✗ **Full Monopoly** ($10,000,000.00, 3,000 yomi)')
    })
  })

  it('only shows sections when they are activated', () => {
    const prompt = displayPromptWithState()
    expect(prompt).toContain('## Manufacturing')
    expect(prompt).not.toContain('## Wire Production')
    expect(prompt).toContain('## Business')
    expect(prompt).not.toContain('## Computational Resources')
    expect(prompt).not.toContain('## Strategic Modeling')
    expect(prompt).not.toContain('## Investments')
    expect(prompt).not.toContain('## Power')
    expect(prompt).not.toContain('## Swarm Computing')
    expect(prompt).not.toContain('## Quantum Computing')
    expect(prompt).not.toContain('## Space Exploration')
    expect(prompt).not.toContain('## Von Neumann Probe Design')
    expect(prompt).not.toContain('## Combat')
    expect(prompt).not.toContain('## Projects')
  })
})

function displayPromptWithState(...state: DeepPartial<GameState>[]) {
  const gameState = applyGameState(...state)
  return displayPrompt(createAgentPrompt(gameState))
}
