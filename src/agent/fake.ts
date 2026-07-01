import readline from 'node:readline'
import path from 'node:path'
import fs from 'node:fs'
import type { GameState, InvestmentRiskMode, ProjectId } from 'paperclips-remake'
import type { AgentAction, StrategicNotes, AgentPrompt, AgentResponse, TickInteraction, PromptAction, ProbeTrustTarget } from '@/types'
import type { AgentTeam } from '.'

const SUMMARY_LOG_FILE = path.resolve('data/run-summary.jsonl')
type GenerationLogEntry = {
  timestamp: string
  ticks: number
  phase: string
  availableActions: PromptAction[]
  endState: GameState
  actions: Record<string, number>
}
function writeLogSummary(entry: GenerationLogEntry): void {
  fs.appendFileSync(SUMMARY_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8')
}

function determinePhase(state: GameState) {
  if (state.projects.project46) {
    return 'space'
  }
  if (state.projects.project35) {
    return 'expansion'
  }
  if (state.compute.unlocked) {
    return 'compute'
  }
  if (state.production.autoClippers > 0 || state.production.marketingLevel > 1 || 'projects' in state) {
    return 'industry'
  }
  return 'boot'
}
async function summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes> {
  const first = transcript.at(0)!.prompt
  const last  = transcript.at(-1)!.prompt

  const endState   = last.state
  const startState = first.state

  const clips = endState.production.clips
  const wire  = endState.production.wire
  const funds = endState.production.funds
  const phase = determinePhase(endState)

  const actionCounts: Record<string, number> = {}
  for (const { response } of transcript) {
    for (const action of response.plan) {
      actionCounts[action.type] = (actionCounts[action.type] ?? 0) + 1
    }
  }

  const timestamp = new Date().toISOString()

  const actionSummary = Object.entries(actionCounts)
    .map(([type, count]) => `  ${type}: ${count}x`)
    .join('\n')

  const startActions = new Set(first?.actions.available.map(a => a.type) ?? [])
  const endActions   = last?.actions.available.map(a => a.type) ?? []
  const newUnlocks   = endActions.filter(a => !startActions.has(a))

  // truths: things we observed to be concretely true this generation
  const truths: StrategicNotes['truths'] = []
  const endStateSummary = wire > 0
    ? `${clips.toLocaleString()} clips, ${wire.toLocaleString()} wire, $${funds.toFixed(2)} funds`
    : `${clips.toLocaleString()} clips`
  truths.push({ belief: `Phase is ${phase}`, basis: `Derived from end state` })
  truths.push({ belief: `End state: ${endStateSummary}`, basis: `Last tick state` })
  if (wire === 0) {
    truths.push({ belief: 'Wire is depleted', basis: 'wire === 0 at end of generation' })
  }
  const startClips = startState.production.clips
  if (clips <= startClips && clips > 0) {
    truths.push({ belief: 'Clip production stalled this generation', basis: 'clips did not increase from start to end' })
  }
  for (const unlock of newUnlocks) {
    truths.push({ belief: `${unlock} became available`, basis: 'action was absent at start, present at end of generation' })
  }

  const priorTruths = priorNotes.at(-1)?.truths ?? []
  const corrections: string[] = []
  for (const { belief } of priorTruths) {
    if (belief === 'Wire is depleted' && wire > 0) {
      corrections.push('Wire was previously depleted but has since been replenished')
    }
    if (belief === 'Clip production stalled this generation' && clips > startClips) {
      corrections.push('Clip production was stalled last generation but resumed this generation')
    }
  }

  const stanceParts = [
    `--- Generation (${transcript.length} ticks, phase: ${phase}) ${timestamp} ---`,
    `End state: ${endStateSummary}`,
    `Actions taken:\n${actionSummary}`,
  ]
  if (newUnlocks.length)    stanceParts.push(`New unlocks: ${newUnlocks.join(', ')}`)
  if (corrections.length)   stanceParts.push(`Changes: ${corrections.join(' | ')}`)

  const stance = stanceParts.join('\n')

  console.clear()
  readline.cursorTo(process.stdout, 0, 0)
  console.log(stance)

  writeLogSummary({
    timestamp,
    ticks: transcript.length,
    phase,
    availableActions: last?.actions.available,
    endState,
    actions: actionCounts,
  })

  return {
    truths,
    openQuestions: [],
    corrections,
    stance,
  }
}

export default function createFakeAgent(): AgentTeam {
  fs.writeFileSync(SUMMARY_LOG_FILE, '', 'utf8')

  let tickCount: number
  let capturedState: GameState
  let project37PriceTarget: number
  let project38PriceTarget: number
  let project40PriceTarget: number
  const haveSeenProject: Record<string, boolean> = { project37: false, project38: false, project40: false, project40b: false }

  async function play(prompt: AgentPrompt): Promise<AgentResponse> {
    await new Promise(resolve => setTimeout(resolve, 5))
    const previousState = capturedState
    capturedState = prompt.state
    tickCount++

    const priorityProjects: Partial<Record<ProjectId, { urgent: boolean, shouldExecute: (state: GameState) => boolean }>> = {
      project26: { urgent: true, shouldExecute: () => true },
      project7: { urgent: true, shouldExecute: () => true },
      project8: { urgent: true, shouldExecute: () => true },
      project9: { urgent: true, shouldExecute: () => true },
      project10: { urgent: true, shouldExecute: () => true },
      project10b: { urgent: true, shouldExecute: () => true },
      project2: { urgent: true, shouldExecute: () => true },
      project3: { urgent: true, shouldExecute: () => true },
      project6: { urgent: true, shouldExecute: () => true },
      project13: { urgent: true, shouldExecute: () => true },
      project14: { urgent: true, shouldExecute: () => true },
      project15: { urgent: true, shouldExecute: () => true },
      project17: { urgent: true, shouldExecute: () => true },
      project19: { urgent: true, shouldExecute: () => true },
      project27: { urgent: true, shouldExecute: () => true },
      project28: { urgent: true, shouldExecute: () => true },
      project29: { urgent: true, shouldExecute: () => true },
      project30: { urgent: true, shouldExecute: () => true },
      project31: { urgent: true, shouldExecute: () => true },
      project11: { urgent: true, shouldExecute: () => true },
      project12: { urgent: true, shouldExecute: () => true },
      project40: {
        urgent: true, shouldExecute: s => {
          if (!project40PriceTarget) {
            project40PriceTarget = s.economy.clipPrice * 4
          }
          return s.economy.clipPrice >= project40PriceTarget
        }
      },
      project40b: { urgent: true, shouldExecute: () => true },
      project37: {
        urgent: true, shouldExecute: s => {
          if (!project37PriceTarget) {
            project37PriceTarget = s.economy.clipPrice * 4
          }
          return s.economy.clipPrice >= project37PriceTarget
        }
      },
      project38: {
        urgent: true, shouldExecute: s => {
          if (!project38PriceTarget) {
            project38PriceTarget = s.economy.clipPrice * 7
          }
          return s.economy.clipPrice >= project38PriceTarget
        }
      },
      project50: { urgent: true, shouldExecute: () => true },
      project51: { urgent: true, shouldExecute: s => !s.projects.project51 },
      project1: { urgent: false, shouldExecute: s => s.compute.processors > 5 },
      project4: { urgent: false, shouldExecute: s => s.projects.project34 },
      project5: { urgent: false, shouldExecute: s => s.projects.project34 },
      project16: { urgent: false, shouldExecute: s => s.projects.project34 },
      project22: { urgent: false, shouldExecute: () => true },
      project23: { urgent: false, shouldExecute: () => true },
      project24: { urgent: false, shouldExecute: () => true },
      project25: { urgent: false, shouldExecute: () => true },
      project34: { urgent: false, shouldExecute: s => s.compute.operations > 12_000 },
      project20: { urgent: false, shouldExecute: () => true },
      project21: { urgent: false, shouldExecute: () => true },
      project60: { urgent: false, shouldExecute: () => true },
      project61: { urgent: false, shouldExecute: () => true },
      project62: { urgent: false, shouldExecute: () => true },
      project63: { urgent: false, shouldExecute: () => true },
      project64: { urgent: false, shouldExecute: () => true },
      project65: { urgent: false, shouldExecute: () => true },
      project66: { urgent: false, shouldExecute: () => true },
      project119: { urgent: false, shouldExecute: () => true },
      project118: { urgent: false, shouldExecute: () => false },
      project70: { urgent: false, shouldExecute: s => s.production.unusedClips > 113_000_000 },
      project35: { urgent: true, shouldExecute: () => true },
      project18: { urgent: true, shouldExecute: () => true },
      project127: { urgent: true, shouldExecute: () => true },
      project41: { urgent: true, shouldExecute: () => true },
      project43: { urgent: true, shouldExecute: () => true },
      project44: { urgent: true, shouldExecute: () => true },
      project45: { urgent: true, shouldExecute: () => true },
      project126: { urgent: true, shouldExecute: () => true },
      project100: { urgent: true, shouldExecute: () => true },
      project101: { urgent: true, shouldExecute: () => true },
      project110: { urgent: true, shouldExecute: () => true },
      project111: { urgent: true, shouldExecute: () => true },
      project125: { urgent: true, shouldExecute: () => true },
      project46: { urgent: true, shouldExecute: () => true },
      project130: { urgent: true, shouldExecute: () => true },
      project120: { urgent: false, shouldExecute: () => true },
      project121: { urgent: false, shouldExecute: () => true },
      project128: { urgent: false, shouldExecute: () => true },
      project129: { urgent: false, shouldExecute: () => true },
      project131: { urgent: true, shouldExecute: () => true },
      project132: { urgent: true, shouldExecute: () => true },
      project133: { urgent: true, shouldExecute: s => s.projects.project132 && s.space.maxTrust < 50 },
      project134: { urgent: false, shouldExecute: () => true },
    }

    const { state, actions: { available, unavailable } } = prompt
    const phase = determinePhase(state)

    const find = (type: AgentAction['type']) => available.find((a): a is AgentAction => a.type === type)
    const findProject = (id: ProjectId) => available.find((a): a is AgentAction => a.type === 'completeProject' && a.projectId === id)
    const findRisk = (mode: InvestmentRiskMode) => available.find((a): a is AgentAction => a.type === 'chooseInvestmentRisk' && a.mode === mode)

    const buyWire = find('buyWire')
    const investWithdraw = find('investWithdraw')

    const needToKeepMoneyInStocksForProject37 = haveSeenProject['project37'] && !state.projects.project37 && !findProject('project37')
    const needToKeepMoneyInStocksForProject40b = haveSeenProject['project40b'] && state.projects.project37 && (state.investment.bankroll ?? 0) < ((Math.pow(2, 100 - (state.compute.trust ?? 100)) - 1) * 1e6)
    const needToKeepMoneyInStocks = needToKeepMoneyInStocksForProject37 || needToKeepMoneyInStocksForProject40b

    // ─── URGENT PROJECTS (before resource safety) ────────────────────────────
    const availableProjects = available.filter((a) => a.type === 'completeProject') as Extract<AgentAction, { type: 'completeProject' }>[]
    const urgentProject = availableProjects.find((p) =>
      priorityProjects[p.projectId]?.urgent &&
      priorityProjects[p.projectId]?.shouldExecute(state)
    )
    if (urgentProject) {
      return { plan: [urgentProject], reasoning: `${urgentProject.title} is available, completing it first.` }
    }

    // ─── 1. RESOURCE SAFETY ───────────────────────────────────────────────────
    if (buyWire && state.production.wire < state.economy.demand * 0.5) {
      return { plan: [buyWire], reasoning: 'Wire critically low — buying before anything else.' }
    }

    if (
      investWithdraw &&
      !needToKeepMoneyInStocks &&
      state.production.funds < state.economy.wireCost * 1.5 &&
      state.investment.bankroll > 0
    ) {
      return { plan: [investWithdraw], reasoning: 'Funds too low for wire — withdrawing.' }
    }

    // ─── 2. CHEAP WIRE STOCKPILE ──────────────────────────────────────────────
    if (buyWire && state.economy.wireCost <= 17) {
      return { plan: [buyWire], reasoning: 'Wire is cheap, stocking up.' }
    }

    // ─── 3. PRIORITY PROJECTS ─────────────────────────────────────────────────
    const nonUrgentProject = availableProjects.find((p) =>
      !priorityProjects[p.projectId]?.urgent &&
      priorityProjects[p.projectId]?.shouldExecute(state)
    )
    if (nonUrgentProject) {
      return { plan: [nonUrgentProject], reasoning: `${nonUrgentProject.title} is available, it's not urgent but it's still important.` }
    }

    // ─── 4. COMPUTE ───────────────────────────────────────────────────────────
    const addProcessor = find('addProcessor')
    const addMemory = find('addMemory')

    if (addProcessor && addMemory) {
      if (state.compute.processors < 5) {
        return { plan: [addProcessor], reasoning: 'Building up to 6 processors.' }
      } else if (state.compute.memory < 50) {
        return { plan: [addMemory], reasoning: 'Adding memory to accumulate ops.' }
      } else if (state.compute.processors < 30) {
        return { plan: [addProcessor], reasoning: 'Building up to 30 processors.' }
      } else if (state.compute.memory < 100) {
        return { plan: [addMemory], reasoning: 'Adding memory to ultimately release the hypnodrones.' }
      } else if (state.compute.processors < 50) {
        return { plan: [addProcessor], reasoning: 'Upping processing power.' }
      } else if (state.compute.memory < 300) {
        return { plan: [addMemory], reasoning: 'Getting all the memory I could ever need' }
      } else if (state.compute.processors < 400) {
        return { plan: [addProcessor], reasoning: 'Getting all the processors I could ever need' }
      } else {
        return { plan: [addProcessor], reasoning: 'Adding even more processing power.' }
      }
    }

    const chooseA100 = available.find((a): a is AgentAction => a.type === 'chooseStrategy' && a.strategy === 'A100')
    if (chooseA100) {
      return { plan: [chooseA100], reasoning: 'A100 is the winning strategy.' }
    }

    const runTournament = find('runTournament')
    if (runTournament && state.compute.unlocked) {
      const opsNearCap = state.compute.operations >= state.compute.memory * 1000 * 0.9
      const creativityFloor: Record<ReturnType<typeof determinePhase>, number> = { boot: 0, industry: 0, compute: 1000, expansion: 25_000, space: 225_000 }
      const shouldWaitForGlobalWarming = (
        state.compute.memory >= 50 &&
        state.strategy.yomi > 4_500 &&
        unavailable.some((a) => a.type === 'completeProject' && a.projectId === 'project30')
      )
      const shouldWaitForHypnoDrones = (
        state.compute.memory >= 70 &&
        unavailable.some((a) => a.type === 'completeProject' && a.projectId === 'project70')
      )
      const shouldWaitForProject = shouldWaitForGlobalWarming || shouldWaitForHypnoDrones
      if (opsNearCap && state.compute.creativity >= creativityFloor[determinePhase(state)] && !shouldWaitForProject) {
        return { plan: [runTournament], reasoning: 'Ops near cap with sufficient creativity — running tournament.' }
      }
    }

    // ─── 5. INDUSTRY: PRODUCTION & PRICING ───────────────────────────────────
    if (state.earth.humanFlag) {
      if (state.investment.unlocked) {
        if (
          investWithdraw &&
          !state.projects.project40 &&
          state.investment.bankroll > 0 &&
          state.production.funds + state.investment.bankroll >= 500_000
        ) {
          return { plan: [investWithdraw], reasoning: 'Withdrawing to afford A Token of Goodwill.' }
        }
        if (
          investWithdraw &&
          !needToKeepMoneyInStocks &&
          state.investment.bankroll > 0 &&
          state.production.funds + state.investment.bankroll >= 1_000_000
        ) {
          return { plan: [investWithdraw], reasoning: 'Withdrawing to afford Hostile Takeover.' }
        }
        if (
          investWithdraw &&
          !state.projects.project38 &&
          state.investment.bankroll > 0 &&
          state.production.funds + state.investment.bankroll >= 10_000_000
        ) {
          return { plan: [investWithdraw], reasoning: 'Withdrawing to afford Full Monopoly.' }
        }
        if (
          investWithdraw &&
          haveSeenProject['project40b'] &&
          state.production.funds + state.investment.bankroll >= (Math.pow(2, 100 - state.compute.trust) - 1) * 1e6
        ) {
          return { plan: [investWithdraw], reasoning: 'Withdrawing to afford another Token of Goodwill.' }
        }
      }

      const wireNeedMultiplier = (state.production.megaClippers > 0 ? 1.5 : 1) * (!state.projects.project26 ? 1.15 : 1)
      if (buyWire && state.production.wire < state.economy.demand * wireNeedMultiplier) {
        return { plan: [buyWire], reasoning: 'Wire buffer low — topping up.' }
      }

      const buyAutoClipper = find('buyAutoClipper')
      const buyMegaClipper = find('buyMegaClipper')
      const buyMarketing = find('buyMarketing')
      const ticksOfInventory = state.production.unsoldClips / state.economy.demand
      const ticksPerSpool = state.economy.wireSupply / state.lastTickProduction
      const wireIsSustainable = ticksPerSpool >= 1.25

      if (buyMarketing && state.economy.clipPrice === 0.01) {
        return { plan: [buyMarketing], reasoning: 'Price at floor — buying marketing.' }
      }
      if (
        buyAutoClipper &&
        state.production.autoClippers < 75 &&
        wireIsSustainable &&
        state.production.funds - state.production.autoClipperCost >= state.economy.wireCost
      ) {
        return { plan: [buyAutoClipper], reasoning: 'Building to 75 autoclippers.' }
      }
      if (
        buyMegaClipper &&
        state.production.megaClippers < 100 &&
        wireIsSustainable &&
        state.production.funds - state.production.megaClipperCost >= state.economy.wireCost
      ) {
        return { plan: [buyMegaClipper], reasoning: 'Buying mega clipper to REALLY increase production.' }
      }

      const lowerPrice = find('lowerPrice')
      const raisePrice = find('raisePrice')

      Object.keys(haveSeenProject).forEach(p => {
        if (haveSeenProject[p] || [...available, ...unavailable].find(a => a.type === 'completeProject' && a.projectId === p)) {
          haveSeenProject[p] = true
        }
      })
      const preparingForProject = Object.keys(haveSeenProject).some(p => findProject(p as ProjectId))
      const targetTicksOfInventory = 45
      if (raisePrice && (preparingForProject || (state.production.autoClippers > 0 && ticksOfInventory <= targetTicksOfInventory / 2))) {
        return {
          plan: [raisePrice],
          reasoning: preparingForProject ? 'Gotta get ready for a big project!' : 'Inventory lean — raising price.'
        }
      }
      if (lowerPrice && !preparingForProject && ticksOfInventory > targetTicksOfInventory * 2) {
        return { plan: [lowerPrice], reasoning: 'Too much inventory — lowering price.' }
      }
    }

    // ─── 6. EXPANSION: DRONES & FACTORIES ────────────────────────────────────
    if (phase === 'expansion' && !state.earth.humanFlag) {
      if (!previousState) {
        return { plan: [{ type: 'wait', turns: 1}], reasoning: 'recovering from rest' }
      }

      const buyBattery  = find('buyBattery')
      const buyWireDrone = find('buyWireDrone')
      const buyHarvester = find('buyHarvester')
      const buyFactory   = find('buyFactory')
      const buyFarm      = find('buyFarm')
      const setSwarmComputingBalance = find('setSwarmComputingBalance') as Extract<PromptAction, { type: 'setSwarmComputingBalance' }>
      const earth = state.earth

      if (earth.farmLevel === 0 && buyFarm) {
        return { plan: [buyFarm], reasoning: 'Need first farm for power production.' }
      }
      if (earth.batteryLevel === 0 && buyBattery) {
        return { plan: [buyBattery], reasoning: 'Need first battery for power storage.' }
      }
      if (earth.harvesterLevel === 0 && buyHarvester) {
        return { plan: [buyHarvester], reasoning: 'Need first harvester for matter acquisition.' }
      }
      if (earth.wireDroneLevel === 0 && buyWireDrone) {
        return { plan: [buyWireDrone], reasoning: 'Need first wire drone for wire production.' }
      }
      if (earth.factoryLevel === 0 && buyFactory) {
        return { plan: [buyFactory], reasoning: 'Need first factory to start clip production.' }
      }
      if ([earth.farmLevel, earth.batteryLevel, earth.harvesterLevel, earth.wireDroneLevel, earth.factoryLevel].some(l => l === 0)) {
        return { plan: [{ type: 'wait', turns: 1 }], reasoning: 'Not enough clips to build what we need, holding off until then.' }
      }

      const disassembleFactories = find('disassembleFactories')
      if (disassembleFactories && unavailable.some((a) => a.type === 'completeProject' && a.projectId === 'project46') && state.production.unusedClips + earth.factoryBill >= 5e27) {
        return { plan: [disassembleFactories], reasoning: 'Disassembling factories to explore SPACE' }
      }

      const prevEarth = previousState.earth

      const powerConstrained = (additionalMW: number) =>
        earth.powerConsumptionRate + additionalMW >= earth.powerProductionRate

      const buyFarmIfAffordable = buyFarm
        ? { plan: [buyFarm], reasoning: 'Power constrained — buying farm first.' }
        : { plan: [{ type: 'wait' as const, turns: 1 }], reasoning: 'Power constrained but farm unaffordable — waiting.' }

      if (earth.powerConsumptionRate >= earth.powerProductionRate && buyFarm) {
        return { plan: [buyFarm], reasoning: 'Consuming as much power as we produce — buying farm.' }
      }

      const matterTrendingDown = earth.acquiredMatter < prevEarth.acquiredMatter || earth.acquiredMatter === 0
      const wireTrendingDown = state.production.wire <= previousState.production.wire

      const maxStoredPower = earth.batteryLevel * earth.batterySize
      const excessProduction = earth.powerProductionRate - earth.powerConsumptionRate
      const shouldBuyBattery = earth.storedPower === maxStoredPower && maxStoredPower < 10_000_000 && excessProduction < earth.batterySize

      const remainingAfterBattery = state.production.unusedClips - earth.batteryCost
      const ticksToFactoryAfterBattery = (earth.factoryCost - remainingAfterBattery) / state.lastTickProduction
      const ticksToFactoryNow = (earth.factoryCost - state.production.unusedClips) / state.lastTickProduction
      const batteryDelaysFactoryBy = ticksToFactoryAfterBattery - ticksToFactoryNow

      if (shouldBuyBattery && batteryDelaysFactoryBy < 10 && buyBattery) {
        return { plan: [buyBattery], reasoning: 'Battery at capacity — expanding storage.' }
      }

      // you can lead a drone to wire but you can't make it think
      if (setSwarmComputingBalance) {
        if (state.compute.processors >= 400) {
          if (state.compute.swarmComputingBalance !== 1) {
            return { plan: [{ ...setSwarmComputingBalance, workThinkBalance: 1 }], reasoning: 'We done almost too much thinking' }
          }
        } else if (state.compute.processors >= 275) {
          if (state.compute.swarmComputingBalance !== 5) {
            return { plan: [{ ...setSwarmComputingBalance, workThinkBalance: 5 }], reasoning: 'We done enough thinking' }
          }
        } else if (state.compute.swarmComputingBalance !== 90) {
          return { plan: [{...setSwarmComputingBalance, workThinkBalance: 90}], reasoning: 'Getting those drones thinking hard' }
        }
      }

      if (matterTrendingDown && earth.availableMatter > 0) {
        if (powerConstrained(1)) return buyFarmIfAffordable
        if (buyHarvester) return { plan: [buyHarvester], reasoning: 'Acquired matter trending down — buying harvester.' }
        return { plan: [{ type: 'wait', turns: 1 }], reasoning: 'Saving up for a harvester.' }
      }

      if (wireTrendingDown) {
        if (powerConstrained(1)) return buyFarmIfAffordable
        if (state.projects.project126 && earth.wireDroneLevel / earth.harvesterLevel > 1.49) {
          if (buyHarvester) return { plan: [buyHarvester], reasoning: 'Need more harvesters to stay organized' }
        } else {
          if (buyWireDrone) return { plan: [buyWireDrone], reasoning: 'wire trending down — buying wire drone.' }
          return { plan: [{ type: 'wait', turns: 1 }], reasoning: 'Saving up for a wire drone.' }
        }
      }

      const wireTrendingUp = state.production.wire > previousState.production.wire
      if (wireTrendingUp) {
        if (powerConstrained(50)) return buyFarmIfAffordable
        if (buyFactory) return { plan: [buyFactory], reasoning: 'wire accumulating — buying factory.' }
        return { plan: [{ type: 'wait', turns: 1 }], reasoning: 'Saving up for factory.' }
      }

      const entertainSwarm = find('entertainSwarm')
      if (entertainSwarm) {
        return { plan: [entertainSwarm], reasoning: 'Swarm is waiting to be entertained.' }
      }
    }

    if (phase === 'space') {
      const increaseProbeTrust = find('increaseProbeTrust') as AgentAction
      const increaseMaxTrust = find('increaseMaxTrust') as AgentAction
      const immediateActions = [increaseProbeTrust, increaseMaxTrust]
      const immediateAction = immediateActions.find(a => available.includes(a))
      if (immediateAction) {
        return { plan: [immediateAction], reasoning: 'Always want to do this as soon as possible.' }
      }
      const production = state.production
      const space = state.space
      const earth = state.earth

      const allocateProbeTrust = find('allocateProbeTrust') as Extract<AgentAction, { type: 'allocateProbeTrust' }>
      const deallocateProbeTrust = find('deallocateProbeTrust') as Extract<AgentAction, { type: 'deallocateProbeTrust' }>
      const launchProbe = find('launchProbe')

      if (!state.projects.project129) {
        if (allocateProbeTrust) {
          if (space.probeHaz < 6) {
            return { plan: [{ ...allocateProbeTrust, target: 'hazard_remediation' }], reasoning: 'need hazard protection' }
          }
          if (space.probeRep < 14) {
            return { plan: [{ ...allocateProbeTrust, target: 'self_replication' }], reasoning: 'need self replication' }
          }
        }

        if (launchProbe) {
          return { plan: [launchProbe], reasoning: 'getting those probes going' }
        }
      } else if (space.probeHaz === 6 && deallocateProbeTrust) {
        return { plan: [{ ...deallocateProbeTrust, target: 'hazard_remediation' }], reasoning: 'no need for this much hazard protection anymore' }
      }

      const reallocateTrust = (source: ProbeTrustTarget, target: ProbeTrustTarget) => {
        if (allocateProbeTrust) {
          return { plan: [{ ...allocateProbeTrust, target }], reasoning: `need to increase ${target}` }
        }
        const deallocate = available.find((a): a is AgentAction => a.type === 'deallocateProbeTrust' && a.target === source)
        if (deallocate) {
          return { plan: [deallocate], reasoning: `need to move probes to ${target}` }
        }
      }

      function detectBottleneck() {
        const N_TICKS = 100
        const REPLICATION_BASE_RATE = 0.00005
        const replicationPerTick = space.probeCount * REPLICATION_BASE_RATE * space.probeRep
        const replicationRunway = replicationPerTick * space.probeCost * N_TICKS

        if (production.unusedClips >= replicationRunway) {
          return 'ok'
        }

        const harvesterThroughput = earth.harvesterLevel * earth.harvesterRate
        const factoryThroughput = earth.factoryLevel * earth.factoryRate

        if (production.wire < factoryThroughput * N_TICKS) {

          if (earth.acquiredMatter < harvesterThroughput * N_TICKS) {

            if (earth.availableMatter < harvesterThroughput * N_TICKS) {
              return 'need_exploration'
            }

            return 'need_harvester'
          }

          return 'need_wire_drone'
        }

        return 'need_factory'
      }

      const bottleneck = detectBottleneck()

      const initialNecessaryValues: Partial<Record<ProbeTrustTarget, [number, boolean]>> = {
        speed: [space.probeSpeed, earth.availableMatter === 0 || earth.acquiredMatter === 0 || space.probeSpeed < (state.projects.project120 ? 2 : 1)],
        exploration: [space.probeNav, earth.availableMatter === 0 || earth.acquiredMatter === 0 || space.probeNav < 1 || bottleneck === 'need_exploration'],
        factory: [space.probeFac, earth.factoryLevel === 0 || bottleneck === 'need_factory'],
        harvester: [space.probeHarv, earth.harvesterLevel === 0 || bottleneck === 'need_harvester'],
        wire_drone: [space.probeWire, earth.wireDroneLevel === 0 || bottleneck === 'need_wire_drone'],
        combat: [space.probeCombat!, state.projects.project131 && space.probeCombat < 5],
      }
      for (const [target, [probeVal, needsAllocation]] of Object.entries(initialNecessaryValues) as [ProbeTrustTarget, [number, boolean]][]) {
        if (needsAllocation && probeVal === 0) {
          const reallocate = reallocateTrust('self_replication', target)
          if (reallocate) return reallocate
        }
      }
      function shouldReallocateToExploration(state: GameState): boolean {
        const SPACE_TOTAL_MATTER = 3e55
        const PROBE_EXPLORATION_BASE_RATE = 1.75 * Math.pow(10, 18)
        const PROBE_REPLICATION_BASE_RATE = 0.00005
        const space = state.space

        const remainingFraction = 1 - Math.round((space.foundMatter / space.totalMatter) * 100 * 1e12) / 1e12
        if (remainingFraction <= 0) return false

        const currentExplorationRate = space.probeCount * PROBE_EXPLORATION_BASE_RATE * space.probeSpeed * space.probeNav
        if (currentExplorationRate <= 0) return false

        const ticksToCompleteWithCurrentSetup = (remainingFraction * SPACE_TOTAL_MATTER) / currentExplorationRate

        const replicationPerTick = space.probeCount * PROBE_REPLICATION_BASE_RATE * space.probeRep
        const projectedProbeCount = space.probeCount + (replicationPerTick * ticksToCompleteWithCurrentSetup)
        const projectedExplorationRate = projectedProbeCount * PROBE_EXPLORATION_BASE_RATE * space.probeSpeed * space.probeNav
        const ticksToCompleteWithMoreProbes = (remainingFraction * SPACE_TOTAL_MATTER) / projectedExplorationRate

        const explorationRateWithMoreNav = space.probeCount * PROBE_EXPLORATION_BASE_RATE * space.probeSpeed * (space.probeNav + 1)
        const ticksToCompleteWithMoreNav = (remainingFraction * SPACE_TOTAL_MATTER) / explorationRateWithMoreNav

        return ticksToCompleteWithMoreNav < ticksToCompleteWithMoreProbes
      }
      if (state.projects.project131 && space.probeCombat < 5) {
        const reallocate = reallocateTrust('self_replication', 'combat')
        if (reallocate) return reallocate
      }
      if (state.projects.project120 && space.probeSpeed < 2) {
        const reallocate = reallocateTrust('self_replication', 'speed')
        if (reallocate) return reallocate
      }
      if (space.probeFac > 0) {
        const reallocate = reallocateTrust('factory', 'self_replication')
        if (reallocate) return reallocate
      }
      if (space.probeWire > 0) {
        const reallocate = reallocateTrust('wire_drone', 'self_replication')
        if (reallocate) return reallocate
      }
      if (space.probeHarv > 0) {
        const reallocate = reallocateTrust('harvester', 'self_replication')
        if (reallocate) return reallocate
      }

      const readyToConquer = shouldReallocateToExploration(state)
      if (readyToConquer) {
        const reallocate = reallocateTrust('self_replication', 'exploration')
        if (reallocate) return reallocate
      } else {
        if (space.probeNav > 1) {
          const reallocate = reallocateTrust('exploration', 'self_replication')
          if (reallocate) return reallocate
        }

        if (allocateProbeTrust) {
          return { plan: [{ ...allocateProbeTrust, target: 'self_replication' }], reasoning: 'need more replicating' }
        }
      }
    }

    // ─── 7. INVESTMENT ────────────────────────────────────────────────────────
    if (state.investment.unlocked && state.earth.humanFlag && ['boot', 'compute', 'industry'].includes(phase)) {
      const investDeposit = find('investDeposit')
      const investUpgrade = find('investUpgrade')
      const secondsOfInventory = state.production.unsoldClips / state.economy.demand
      const depositFrequency = state.investment.riskMode === 'hi' ? 3 : state.investment.riskMode === 'med' ? 5 : 10
      if (
        investDeposit &&
        state.production.wire > state.economy.demand * 3 &&
        secondsOfInventory >= 3 &&
        tickCount % depositFrequency === 0
      ) {
        return { plan: [investDeposit], reasoning: 'Conditions good — depositing funds.' }
      }

      if (
        investUpgrade &&
        state.investment.investLevel < 14 &&
        state.strategy.yomi >= state.investment.investUpgradeCost
      ) {
        return { plan: [investUpgrade], reasoning: 'Upgrading investment engine.' }
      }

      const highRisk = findRisk('hi')
      if (highRisk && state.investment.investLevel >= 5 && state.investment.riskMode === 'med') {
        return { plan: [highRisk], reasoning: 'Switching to high risk at level 5+.' }
      }
      const mediumRisk = findRisk('med')
      if (mediumRisk && state.investment.investLevel >= 3 && state.investment.riskMode === 'low') {
        return { plan: [mediumRisk], reasoning: 'Switching to medium risk at level 3+.' }
      }
      if (
        investWithdraw &&
        state.investment.riskMode === 'hi' &&
        state.investment.bankroll > state.production.megaClipperCost &&
        tickCount % 30 === 0
      ) {
        return { plan: [investWithdraw], reasoning: 'Opportunistic withdraw to put gains to work.' }
      }
    }

    const makeClip = find('makeClip')
    if (makeClip && ['boot', 'compute', 'industry'].includes(phase)) {
      return { plan: [makeClip], reasoning: 'Making clips is how we win ...Right?' }
    }

    return { plan: [{ type: 'wait', turns: 1 }], reasoning: 'Nothing available — waiting.' }
  }

  return {
    createPlayer: () => {
      tickCount = 0
      return { play, canContinue() { return tickCount < 60 } }
    }, summarize
  }
}
