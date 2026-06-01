import readline from 'node:readline'
import path from 'node:path'
import fs from 'node:fs'
import type { InvestmentRiskMode, ProjectId } from 'paperclips-remake'
import type { AgentAction, StrategicNotes, AgentPrompt, AgentState, AgentResponse, TickInteraction, PromptAction } from '@/types'

const SUMMARY_LOG_FILE = path.resolve('data/run-summary.jsonl')
type GenerationLogEntry = {
  timestamp: string
  ticks: number
  phase: string
  availableActions: PromptAction[]
  endState: AgentState
  actions: Record<string, number>
}
function writeLogSummary(entry: GenerationLogEntry): void {
  fs.appendFileSync(SUMMARY_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8')
}

function determinePhase(state: AgentState) {
  if (state.projects?.project46) {
    return 'space'
  }
  if (state.projects?.project35) {
    return 'expansion'
  }
  if ('compute' in state) {
    return 'compute'
  }
  if ((state.production.autoClippers ?? 0) > 0 || (state.production.marketingLevel ?? 0) > 1 || 'projects' in state) {
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
    const key = response.action.type
    actionCounts[key] = (actionCounts[key] ?? 0) + 1
  }

  const timestamp = new Date().toISOString()

  const actionSummary = Object.entries(actionCounts)
    .map(([type, count]) => `  ${type}: ${count}x`)
    .join('\n')

  const startActions = new Set(first?.actions.available.map(a => a.type) ?? [])
  const endActions   = last?.actions.available.map(a => a.type) ?? []
  const newUnlocks   = endActions.filter(a => !startActions.has(a))
  const importantUnlocks = Array.from(new Set([...(priorNotes.at(-1)?.importantUnlocks ?? []), ...newUnlocks]))

  const surprisesAndUpdates: string[] = []
  const startPhase = determinePhase(startState)
  if (startPhase !== phase) {
    surprisesAndUpdates.push(`Phase transition: ${startPhase} → ${phase}`)
  }

  const watchouts: string[] = []
  if (wire === 0) {
    watchouts.push('Wire depleted — production will stall')
  }
  const startClips = startState.production.clips
  if (clips <= startClips && clips > 0) {
    watchouts.push('Clip production stalled — no growth this generation')
  }

  const endStateSummary = (wire)
    ? `End state: ${clips.toLocaleString()} clips, ${wire.toLocaleString()} wire, $${funds!.toFixed(2)} funds`
    : `End state: ${clips.toLocaleString()} clips`
  const narrativeParts = [
    `--- Generation (${transcript.length} ticks, phase: ${phase}) ${timestamp} ---`,
    endStateSummary,
    `Actions taken:\n${actionSummary}`,
  ]
  if (newUnlocks.length)          narrativeParts.push(`New unlocks: ${newUnlocks.join(', ')}`)
  if (watchouts.length)           narrativeParts.push(`Watchouts: ${watchouts.join(' | ')}`)
  if (surprisesAndUpdates.length) narrativeParts.push(`Surprises: ${surprisesAndUpdates.join(' | ')}`)

  const strategicNarrative = narrativeParts.join('\n')

  console.clear()
  readline.cursorTo(process.stdout, 0, 0)
  console.log(strategicNarrative)

  writeLogSummary({
    timestamp,
    ticks: transcript.length,
    phase,
    availableActions: last?.actions.available,
    endState,
    actions: actionCounts,
  })

  return {
    importantUnlocks,
    surprisesAndUpdates,
    watchouts,
    strategicNarrative,
  }
}

export default function createFakeAgent() {
  fs.writeFileSync(SUMMARY_LOG_FILE, '', 'utf8')

  let tickCount = 0
  let capturedState: AgentState
  let project37PriceTarget: number
  let project38PriceTarget: number
  let project40PriceTarget: number
  const haveSeenProject: Record<string, boolean> = { project37: false, project38: false, project40: false }

  async function maker(prompt: AgentPrompt): Promise<AgentResponse> {
    await new Promise(resolve => setTimeout(resolve, 5))
    const previousState = capturedState
    capturedState = prompt.state
    tickCount++
    const priorityProjects: Record<string, { urgent: boolean, shouldExecute: (state: AgentState) => boolean }> = {
      project26: { urgent: true, shouldExecute: () => true },        // WireBuyer
      project7:  { urgent: true, shouldExecute: () => true },        // Improved Wire Extrusion
      project8:  { urgent: true, shouldExecute: () => true },        // Optimized Wire Extrusion
      project9:  { urgent: true, shouldExecute: () => true },        // Microlattice Shapecasting
      project10: { urgent: true, shouldExecute: () => true },        // Spectral Froth Annealment
      project10b:{ urgent: true, shouldExecute: () => true },        // Quantum Foam Annealment
      project2:  { urgent: true, shouldExecute: () => true },        // Beg for More Wire
      project3:  { urgent: true, shouldExecute: () => true },        // Creativity
      project6:  { urgent: true, shouldExecute: () => true },        // Limerick
      project13: { urgent: true, shouldExecute: () => true },        // Lexical Processing
      project14: { urgent: true, shouldExecute: () => true },        // Combinatory Harmonics
      project15: { urgent: true, shouldExecute: () => true },        // The Hadwiger Problem
      project17: { urgent: true, shouldExecute: () => true },        // The Toth Sausage Conjecture
      project19: { urgent: true, shouldExecute: () => true },        // Donkey Space
      project27: { urgent: true, shouldExecute: () => true },        // Coherent Extrapolated Volition
      project28: { urgent: true, shouldExecute: () => true },        // Cure for Cancer
      project29: { urgent: true, shouldExecute: () => true },        // World Peace
      project30: { urgent: true, shouldExecute: () => true },        // Global Warming
      project31: { urgent: true, shouldExecute: () => true },        // Male Pattern Baldness
      project11: { urgent: true, shouldExecute: () => true },        // New Slogan
      project12: { urgent: true, shouldExecute: () => true },        // Catchy Jingle
      project40: {                                                   // Hostile Takeover
        urgent: true, shouldExecute: s => {
          if (!project40PriceTarget) {
            project40PriceTarget = s.economy!.clipPrice * 4
          }
          return (s.economy?.clipPrice ?? 0) >= project40PriceTarget
        }
      },
      project37: {                                                   // Hostile Takeover
        urgent: true, shouldExecute: s => {
          if (!project37PriceTarget) {
            project37PriceTarget = s.economy!.clipPrice * 4
          }
          return (s.economy?.clipPrice ?? 0) >= project37PriceTarget
        }
      },
      project38: {                                                   // Full Monopoly
        urgent: true, shouldExecute: s => {
          if (!project38PriceTarget) {
            project38PriceTarget = s.economy!.clipPrice * 7
          }
          return (s.economy?.clipPrice ?? 0) >= project38PriceTarget
        }
      },
      project1:  { urgent: false, shouldExecute: s => s.compute!.processors > 5 },          // Improved AutoClippers
      project4:  { urgent: false, shouldExecute: s => !!s.projects?.project34 },            // Even Better AutoClippers
      project5:  { urgent: false, shouldExecute: s => !!s.projects?.project34 },            // Optimized AutoClippers
      project16: { urgent: false, shouldExecute: s => !!s.projects?.project34 },            // Hadwiger Clip Diagrams
      project22: { urgent: false, shouldExecute: () => true },       // MegaClippers
      project23: { urgent: false, shouldExecute: () => true },       // Improved MegaClippers
      project24: { urgent: false, shouldExecute: () => true },       // Even Better MegaClippers
      project25: { urgent: false, shouldExecute: () => true },       // Optimized MegaClippers
      project34: { urgent: false, shouldExecute: s => s.compute!.operations > 12_000 },    // Hypno Harmonics
      project20: { urgent: false, shouldExecute: () => true },       // Strategic Modeling
      project21: { urgent: false, shouldExecute: () => true },       // Algorithmic Trading
      project60: { urgent: false, shouldExecute: () => true },       // New Strategy: A100
      project61: { urgent: false, shouldExecute: () => true },       // New Strategy: B100
      project62: { urgent: false, shouldExecute: () => true },       // New Strategy: GREEDY
      project63: { urgent: false, shouldExecute: () => true },       // New Strategy: GENEROUS
      project64: { urgent: false, shouldExecute: () => true },       // New Strategy: MINIMAX
      project65: { urgent: false, shouldExecute: () => true },       // New Strategy: TIT FOR TAT
      project66: { urgent: false, shouldExecute: () => true },       // New Strategy: BEAT LAST
      project119: { urgent: false, shouldExecute: () => true },      // Theory of Mind
      project118: { urgent: false, shouldExecute: () => true },      // AutoTourney
      project70: { urgent: false, shouldExecute: s => s.production.unsoldClips! > 113_000_000 }, // HypnoDrones
      project35: { urgent: true, shouldExecute: () => true },        // Release the HypnoDrones
      project18: { urgent: true, shouldExecute: () => true },        // Toth Tubule Enfolding
      project127: { urgent: true, shouldExecute: () => true },       // Power Grid
      project41: { urgent: true, shouldExecute: () => true },        // Nanoscale Wire Production
      project43: { urgent: true, shouldExecute: () => true },        // Harvester Drones
      project44: { urgent: true, shouldExecute: () => true },        // Wire Drones
      project45: { urgent: true, shouldExecute: () => true },        // Clip Factories
      project100: { urgent: true, shouldExecute: () => true },       // Upgraded Factories
      project101: { urgent: true, shouldExecute: () => true },       // Hyperspeed Factories
      project110: { urgent: true, shouldExecute: () => true },       // Collision Avoidance
      project111: { urgent: true, shouldExecute: () => true },       // Alignment
      project125: { urgent: true, shouldExecute: () => true },       // Momentum
      project46: { urgent: true, shouldExecute: () => true },        // Space Exploration
      project120: { urgent: false, shouldExecute: () => true },      // The OODA Loop
      project121: { urgent: false, shouldExecute: () => true },      // Name the Battles
      project129: { urgent: false, shouldExecute: () => true },      // Elliptic Hull Polytopes
      project131: { urgent: false, shouldExecute: () => true },      // Combat
      project134: { urgent: false, shouldExecute: () => true },      // Glory
    }

    const { state, actions: { available, unavailable } } = prompt
    const phase = determinePhase(state)

    const find = (type: AgentAction['type']) => available.find((a): a is AgentAction => a.type === type)
    const findProject = (id: ProjectId) => available.find((a): a is AgentAction => a.type === 'completeProject' && a.projectId === id)
    const findRisk = (mode: InvestmentRiskMode) => available.find((a): a is AgentAction => a.type === 'chooseInvestmentRisk' && a.mode === mode)

    const buyWire = find('buyWire')
    const investWithdraw = find('investWithdraw')

    const needToKeepMoneyInStocks = haveSeenProject['project37'] && !state.projects?.project37 && !findProject('project37')

    // ─── URGENT PROJECTS (before resource safety) ────────────────────────────
    const availableProjects = available.filter((a) => a.type === 'completeProject') as Extract<AgentAction, { type: 'completeProject' }>[]
    const urgentProject = availableProjects.find((p) =>
      priorityProjects[p.projectId]?.urgent &&
      priorityProjects[p.projectId].shouldExecute(state)
    )
    if (urgentProject) {
      return { action: urgentProject, reasoning: `${urgentProject.title} is available, completing it first.` }
    }

    // ─── 1. RESOURCE SAFETY ───────────────────────────────────────────────────
    // Emergency wire: don't let production stall for any reason
    if (buyWire && state.production.wire! < state.economy!.publicDemand! * 0.5) {
      return { action: buyWire, reasoning: 'Wire critically low — buying before anything else.' }
    }

    // Fund floor: ensure we can afford wire
    if (
      investWithdraw &&
      !needToKeepMoneyInStocks &&
      state.production.funds! < state.economy!.wireCostPerSpool * 1.5 &&
      state.investment!.bankroll > 0
    ) {
      return { action: investWithdraw, reasoning: 'Funds too low for wire — withdrawing.' }
    }

    // ─── 2. CHEAP WIRE STOCKPILE ──────────────────────────────────────────────
    if (buyWire && state.economy!.wireCostPerSpool <= 17) {
      return { action: buyWire, reasoning: 'Wire is cheap, stocking up.' }
    }

    // ─── 3. PRIORITY PROJECTS ─────────────────────────────────────────────────
    const nonUrgentProject = availableProjects.find((p) =>
      !priorityProjects[p.projectId]?.urgent &&
      // TODO add new projects
      priorityProjects[p.projectId]?.shouldExecute(state)
    )
    if (nonUrgentProject) {
      return { action: nonUrgentProject, reasoning: `${nonUrgentProject.title} is available, it's not urgent but it's still important.` }
    }

    // ─── 4. COMPUTE ───────────────────────────────────────────────────────────
    const addProcessor = find('addProcessor')
    const addMemory = find('addMemory')

    if (addProcessor && addMemory) {
      if (state.compute!.processors < 5) {
        return { action: addProcessor, reasoning: 'Building up to 6 processors.' }
      } else if (state.compute!.memory < 50) {
        return { action: addMemory, reasoning: 'Adding memory to accumulate ops.' }
      } else if (state.compute!.processors < 30) {
        return { action: addProcessor, reasoning: 'Building up to 30 processors.' }
      } else if (state.compute!.memory < 100) {
        return { action: addMemory, reasoning: 'Adding memory to ultimately release the hypnodrones.' }
      } else if (state.compute!.processors < 50) {
        return { action: addProcessor, reasoning: 'Upping processing power.' }
      } else if (state.compute!.memory < 300) {
        return { action: addMemory, reasoning: 'Getting all the memory I could ever need' }
      } else if (state.compute!.processors < 400) {
        return { action: addProcessor, reasoning: 'Getting all the processors I could ever need' }
      } else {
        return { action: addProcessor, reasoning: 'Adding even more processing power.' }
      }
    }

    const chooseA100 = available.find((a): a is AgentAction => a.type === 'chooseStrategy' && a.strategy === 'A100')
    if (chooseA100) {
      return { action: chooseA100, reasoning: 'A100 is the winning strategy.' }
    }

    const runTournament = find('runTournament')
    if (runTournament && state.compute) {
      const opsNearCap = state.compute.operations >= state.compute.memory * 1000 * 0.9
      const creativityFloor: Record<ReturnType<typeof determinePhase>, number> = { boot: 0, industry: 0, compute: 1000, expansion: 25_000, space: 30_000 }
      const shouldWaitForGlobalWarming = (
        state.compute.memory >= 50 &&
        state.strategy!.yomi > 4_500 &&
        unavailable.some((a) => a.type === 'completeProject' && a.projectId === 'project30')
      )
      const shouldWaitForHypnoDrones = (
        state.compute.memory >= 70 &&
        unavailable.some((a) => a.type === 'completeProject' && a.projectId === 'project70')
      )
      const shouldWaitForProject = shouldWaitForGlobalWarming || shouldWaitForHypnoDrones
      if (opsNearCap && state.compute.creativity! >= creativityFloor[determinePhase(state)] && !shouldWaitForProject) {
        return { action: runTournament, reasoning: 'Ops near cap with sufficient creativity — running tournament.' }
      }
    }

    // ─── 5. INDUSTRY: PRODUCTION & PRICING ───────────────────────────────────
    if (state.economy) {
      if (state.investment) {
        if (
          investWithdraw &&
          !state.projects?.project40 &&
          state.investment.bankroll > 0 &&
          state.production.funds! + state.investment.bankroll >= 500_000
        ) {
          return { action: investWithdraw, reasoning: 'Withdrawing to afford A Token of Goodwill.' }
        }
        if (
          investWithdraw &&
          !needToKeepMoneyInStocks &&
          state.investment.bankroll > 0 &&
          state.production.funds! + state.investment.bankroll >= 1_000_000
        ) {
          return { action: investWithdraw, reasoning: 'Withdrawing to afford Hostile Takeover.' }
        }
        if (
          investWithdraw &&
          !state.projects?.project38 &&
          state.investment.bankroll > 0 &&
          state.production.funds! + state.investment.bankroll >= 10_000_000
        ) {
          return { action: investWithdraw, reasoning: 'Withdrawing to afford Full Monopoly.' }
        }
      }

      // Proactive wire buffer (below emergency floor but ahead of empty)
      const wireNeedMultiplier = ((state.production.megaClippers ?? 0) > 0 ? 1.5 : 1) * (!state.projects?.project26 ? 1.15 : 1)
      if (buyWire && state.production.wire! < state.economy.publicDemand! * wireNeedMultiplier) {
        return { action: buyWire, reasoning: 'Wire buffer low — topping up.' }
      }

      const buyAutoClipper = find('buyAutoClipper')
      const buyMegaClipper = find('buyMegaClipper')
      const buyMarketing = find('buyMarketing')
      const ticksOfInventory = state.production.unsoldClips! / state.economy.publicDemand!
      const ticksPerSpool = state.economy.wireSupply / state.lastTickProduction
      const wireIsSustainable = ticksPerSpool >= 1.25  // some headroom

      if (buyMarketing && state.economy.clipPrice === 0.01) {
        return { action: buyMarketing, reasoning: 'Price at floor — buying marketing.' }
      }
      if (
        buyAutoClipper &&
        state.production.autoClippers! < 75 &&
        wireIsSustainable &&
        state.production.funds! - state.production.autoClipperCost! >= state.economy.wireCostPerSpool!
      ) {
        return { action: buyAutoClipper, reasoning: 'Building to 75 autoclippers.' }
      }
      if (
        buyMegaClipper &&
        state.production.megaClippers! < 100 &&
        wireIsSustainable &&
        state.production.funds! - state.production.megaClipperCost! >= state.economy.wireCostPerSpool!
      ) {
        return { action: buyMegaClipper, reasoning: 'Buying mega clipper to REALLY increase production.' }
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
      if (raisePrice && (preparingForProject || ((state.production.autoClippers ?? 0) > 0 && ticksOfInventory <= targetTicksOfInventory / 2))) {
        return {
          action: raisePrice,
          reasoning: preparingForProject ? 'Gotta get ready for a big project!' : 'Inventory lean — raising price.'
        }
      }
      if (lowerPrice && !preparingForProject && ticksOfInventory > targetTicksOfInventory * 2) {
        return { action: lowerPrice, reasoning: 'Too much inventory — lowering price.' }
      }
    }

    // ─── 6. EXPANSION: DRONES & FACTORIES ────────────────────────────────────
    if (phase === 'expansion' && state.earth) {
      const buyBattery  = find('buyBattery')
      const buyWireDrone = find('buyWireDrone')
      const buyHarvester = find('buyHarvester')
      const buyFactory = find('buyFactory')
      const buyFarm = find('buyFarm')
      const earth = state.earth as Required<typeof state.earth>

      // Bootstrap: need at least 1 of each in dependency order
      if (earth.farmLevel === 0 && buyFarm) {
        return { action: buyFarm, reasoning: 'Need first farm for power production.' }
      }
      if (earth.batteryLevel === 0 && buyBattery) {
        return { action: buyBattery, reasoning: 'Need first battery for power storage.' }
      }
      if (earth.harvesterLevel === 0 && buyHarvester) {
        return { action: buyHarvester, reasoning: 'Need first harvester for matter acquisition.' }
      }
      if (earth.wireDroneLevel === 0 && buyWireDrone) {
        return { action: buyWireDrone, reasoning: 'Need first wire drone for nanowire production.' }
      }
      if (earth.factoryLevel === 0 && buyFactory) {
        return { action: buyFactory, reasoning: 'Need first factory to start clip production.' }
      }
      if ([earth.farmLevel, earth.batteryLevel, earth.harvesterLevel, earth.wireDroneLevel, earth.factoryLevel].some(l => l === undefined || l === 0)) {
        return { action: { type: 'wait', turns: 1 }, reasoning: 'Not enough clips to build what we need, holding off until then.' }
      }

      const prevEarth = previousState.earth as Required<NonNullable<typeof previousState.earth>>

      const powerConstrained = (additionalMW: number) =>
        earth.powerConsumptionRate + additionalMW >= earth.powerProductionRate

      const buyFarmIfAffordable = buyFarm
        ? { action: buyFarm, reasoning: 'Power constrained — buying farm first.' }
        : { action: { type: 'wait' as const, turns: 1 }, reasoning: 'Power constrained but farm unaffordable — waiting.' }

      // Priority 1: power consumption already at or exceeding production
      if (earth.powerConsumptionRate >= earth.powerProductionRate && buyFarm) {
        return { action: buyFarm, reasoning: 'Consuming as much power as we produce — buying farm.' }
      }

      const matterTrendingDown = earth.acquiredMatter < prevEarth.acquiredMatter || earth.acquiredMatter === 0
      const wireTrendingDown = earth.nanoWire <= prevEarth.nanoWire

      // Priority 2: battery capacity reached
      const maxStoredPower = earth.batteryLevel * earth.batterySize
      const excessProduction = earth.powerProductionRate - earth.powerConsumptionRate
      const shouldBuyBattery = earth.storedPower === maxStoredPower && maxStoredPower < 10_000_000 && excessProduction < earth.batterySize

      const remainingAfterBattery = state.production.unusedClips! - earth.batteryCost
      const ticksToFactoryAfterBattery = (earth.factoryCost - remainingAfterBattery) / state.lastTickProduction
      const ticksToFactoryNow = (earth.factoryCost - state.production.unusedClips!) / state.lastTickProduction
      const batteryDelaysFactoryBy = ticksToFactoryAfterBattery - ticksToFactoryNow

      if (shouldBuyBattery && batteryDelaysFactoryBy < 10 && buyBattery) {
        return { action: buyBattery, reasoning: 'Battery at capacity — expanding storage.' }
      }

      // Priority 3: matter throughput falling and matter remains
      if (matterTrendingDown && earth.availableMatter > 0) {
        if (powerConstrained(1)) return buyFarmIfAffordable
        if (buyHarvester) return { action: buyHarvester, reasoning: 'Acquired matter trending down — buying harvester.' }
        return { action: { type: 'wait', turns: 1 }, reasoning: 'Saving up for a harvester.' }
      }

      // Priority 4: wire trending down
      if (wireTrendingDown) {
        if (powerConstrained(1)) return buyFarmIfAffordable
        if (buyWireDrone) return { action: buyWireDrone, reasoning: 'Nanowire trending down — buying wire drone.' }
        return { action: { type: 'wait', turns: 1 }, reasoning: 'Saving up for a wire drone.' }
      }

      // Priority 5: wire trending up — factories are the bottleneck
      const wireTrendingUp = earth.nanoWire > prevEarth.nanoWire
      if (wireTrendingUp) {
        if (powerConstrained(50)) return buyFarmIfAffordable
        if (buyFactory) return { action: buyFactory, reasoning: 'Nanowire accumulating — buying factory.' }
        return { action: { type: 'wait', turns: 1 }, reasoning: 'Saving up for factory.' }
      }
    }

    // ─── 7. INVESTMENT ────────────────────────────────────────────────────────
    if (state.investment && state.economy && ['boot', 'compute', 'industry'].includes(phase)) {
      const investDeposit = find('investDeposit')
      const investUpgrade = find('investUpgrade')
      const secondsOfInventory = state.production.unsoldClips! / state.economy.publicDemand!
      const depositFrequency = state.investment.riskMode === 'hi' ? 3 : state.investment.riskMode === 'med' ? 5 : 10
      if (
        investDeposit &&
        state.production.wire! > state.economy.publicDemand! * 3 &&
        secondsOfInventory >= 3 &&
        tickCount % depositFrequency === 0
      ) {
        return { action: investDeposit, reasoning: 'Conditions good — depositing funds.' }
      }

      if (
        investUpgrade && state.strategy &&
        state.investment.investLevel < 14 &&
        state.strategy.yomi >= state.investment.investUpgradeCost.amount
      ) {
        return { action: investUpgrade, reasoning: 'Upgrading investment engine.' }
      }

      const highRisk = findRisk('hi')
      if (highRisk && state.investment.investLevel >= 5 && state.investment.riskMode === 'med') {
        return { action: highRisk, reasoning: 'Switching to high risk at level 5+.' }
      }
      const mediumRisk = findRisk('med')
      if (mediumRisk && state.investment.investLevel >= 3 && state.investment.riskMode === 'low') {
        return { action: mediumRisk, reasoning: 'Switching to medium risk at level 3+.' }
      }
      if (
        investWithdraw &&
        state.investment.riskMode === 'hi' &&
        state.investment.bankroll > state.production.megaClipperCost! &&
        tickCount % 30 === 0
      ) {
        return { action: investWithdraw, reasoning: 'Opportunistic withdraw to put gains to work.' }
      }
    }

    const makeClip = find('makeClip')
    if (makeClip && ['boot', 'compute', 'industry'].includes(phase)) {
      return { action: makeClip, reasoning: 'Making clips is how we win! ...Right?' }
    }

    const fallback = available.find((a): a is AgentAction => !['wait'].includes(a.type))
    if (fallback) {
      return { action: fallback, reasoning: `Falling back to ${fallback.type}.` }
    }

    return { action: { type: 'wait', turns: 1 }, reasoning: 'Nothing available — waiting.' }
  }

  return { maker, summarize }
}
