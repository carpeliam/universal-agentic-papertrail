import type { AgentResponse, TickInteraction } from '../generation'
import type { AgentPrompt, AgentState } from '../agent-adapter'
import { GameState, InvestmentRiskMode } from 'paperclips-remake'
import { AgentAction } from '@/types'
import readline from 'node:readline'

async function summarize(previousNotes: string, transcript: TickInteraction[]): Promise<string> {
  const clips = transcript[transcript.length - 1]?.prompt.state.production.clips ?? 0
  const wire = transcript[transcript.length - 1]?.prompt.state.production.wire ?? 0
  const funds = transcript[transcript.length - 1]?.prompt.state.production.funds ?? 0
  const phase = transcript[transcript.length - 1]?.prompt.state.phase ?? 'unknown'

  const actionCounts: Record<string, number> = {}
  for (const { response } of transcript) {
    const key = response.action.type
    actionCounts[key] = (actionCounts[key] ?? 0) + 1
  }

  const actionSummary = Object.entries(actionCounts)
    .map(([type, count]) => `  ${type}: ${count}x            `)
    .join('\n')

  const generationNote = [
    `--- Generation (${transcript.length} ticks, phase: ${phase}) ---                       `,
    `End state: ${clips.toLocaleString()} clips, ${wire.toLocaleString()} wire, $${funds.toFixed(2)} funds              `,
    `Actions taken:\n${actionSummary}`,
    '                             ', '                             ', '                             ', '                             ',
  ].join('\n')

  readline.cursorTo(process.stdout, 0, 3)
  process.stdout.write(generationNote)

  const MAX_OLD_NOTES_CHARS = 2000
  const trimmedOld =
    previousNotes.length > MAX_OLD_NOTES_CHARS
      ? previousNotes.slice(0, MAX_OLD_NOTES_CHARS) + '\n[...older notes truncated...]'
      : previousNotes

  return [generationNote, trimmedOld].filter(Boolean).join('\n\n')
}

export default function createFakeAgent() {
  console.clear()
  let tickCount = 0
  let phase: 'start' | 'expansion' | 'space' = 'start'

  async function maker(prompt: AgentPrompt): Promise<AgentResponse> {
    await new Promise(resolve => setTimeout(resolve, 5))

    tickCount++
    const { state, actions: { available, unavailable } } = prompt

    if (phase === 'start' && state.projects?.project35) {
      phase = 'expansion'
    }

    const buyWire = available.find((a) => a.type === 'buyWire')
    const addProcessor = available.find((a) => a.type === 'addProcessor')
    const addMemory = available.find((a) => a.type === 'addMemory')
    const investDeposit = available.find((a) => a.type === 'investDeposit')
    const investWithdraw = available.find((a) => a.type === 'investWithdraw')

    if (phase === 'start') {
      if (buyWire && state.economy.wireCost <= 17) {
        return { action: buyWire, reasoning: 'Wire is cheap, stocking up!' }
      }

      if (
        investWithdraw &&
        state.production.funds < state.economy.wireCost * 1.5 &&
        state.investment.bankroll > 0
      ) {
        return { action: investWithdraw, reasoning: 'Need funds for wire, withdrawing from investment.' }
      }
    }

    const availableProjects = available.filter((a) => a.type === 'completeProject')
    const priorityProjects: Record<string, (state: AgentState) => boolean> = {
      // wire begging
      project2: state => true,
      // creativity
      project3: state => true,
      // trust
      project6: state => true,
      project13: state => true,
      project14: state => true,
      project15: state => true,
      project17: state => true,
      project19: state => true,
      // autoClippers
      project1: state => state.compute.processors > 5,
      project4: state => state.projects.project34,
      project5: state => state.projects.project34,
      // megaClippers
      project22: state => true,
      project23: state => true,
      project24: state => true,
      project25: state => true,
      // algorithmic trading
      project21: state => state.projects.project20,
      // strategic modeling / yomi
      project20: state => true,
      project60: state => true,
      project61: state => true,
      project62: state => true,
      project63: state => true,
      project64: state => true,
      project65: state => true,
      project66: state => true,
      project119: state => true, // requires all strats to be unlocked
      // harmonics
      project34: state => state.compute.operations > 12_000,
      // marketing effectiveness
      project11: state => true,
      project12: state => true,
      project37: state => true,
      project38: state => true,
      // wire efficiency
      project7: state => true,
      project8: state => true,
      project9: state => true,
      project10: state => true,
      project10b: state => true,
      project26: state => state.production.megaClippers > 50,
      // Coherent Extrapolated Volition
      project27: state => true,
      project28: state => true,
      project29: state => true,
      project30: state => true,
      project31: state => true,
      // hypnodrones
      project35: state => true,
      project70: state => state.production.clips > 110_000_000,
      // earth expansion phase
      project18: state => true,
      project127: state => true,
      project41: state => true,
      project43: state => true,
      project44: state => true,
      project45: state => true,
      // space
      project46: state => true,
      project120: state => true,
      project121: state => true,
      project129: state => true,
      project131: state => true,
      project134: state => true,
    }
    const priorityProject = availableProjects.find((project) => priorityProjects[project.projectId]?.(state))
    if (priorityProject) {
      return {
        action: priorityProject,
        reasoning: `${priorityProject.title} is available, completing it first.`,
      }
    }

    if (phase === 'start') {
      const investWithdraw = available.find((a) => a.type === 'investWithdraw')
      if (
        investWithdraw &&
        !state.projects?.project37 &&
        state.investment?.bankroll > 0 &&
        state.production.funds + state.investment?.bankroll >= 1_000_000
      ) {
        return { action: investWithdraw, reasoning: 'Withdrawing to afford project37.' }
      }
      if (
        investWithdraw &&
        !state.projects?.project38 &&
        state.investment?.bankroll > 0 &&
        state.production.funds + state.investment?.bankroll >= 10_000_000
      ) {
        return { action: investWithdraw, reasoning: 'Withdrawing to afford project38.' }
      }

      let wireNeedMultiplier = state.production.megaClippers > 0 ? 1.5 : 1
      if (!state.projects?.project26) {
        wireNeedMultiplier *= 1.15
      }
      const buyWire = available.find((a) => a.type === 'buyWire')
      if (buyWire && state.production.wire < state.economy.demand * wireNeedMultiplier) {
        return { action: buyWire, reasoning: 'Almost out of wire — buying more.' }
      }

    }

    if (addProcessor && state.compute.processors < 6) {
      return {
        action: addProcessor,
        reasoning: 'Processor is available and I have 6 or less, adding it now.',
      }
    }
    if (addMemory && state.compute.processors >= 6) {
      return {
        action: addMemory,
        reasoning: 'Memory is available and I have more than 5 processors, adding it now.',
      }
    }

    const chooseA100 = available.find((a) => a.type === 'chooseStrategy' && a.strategy === 'A100')
    if (chooseA100) {
      return { action: chooseA100, reasoning: 'A100 seems like a winning strategy.' }
    }
    const runTournament = available.find((a) => a.type === 'runTournament')
    if (runTournament) {
      const opsNearCap = state.compute.operations >= state.compute.memory * 1000 * 0.9
      const creativityFloor: Record<GameState['phase'], number> = { boot: 0, industry: 0, compute: 1000, expansion: 10000 }
      const shouldWaitForHypnoDrones = state.compute.memory >= 70 && unavailable.some((a) => a.type === 'completeProject' && a.projectId === 'project70')
      if (opsNearCap && state.compute.creativity >= creativityFloor[state.phase] && !shouldWaitForHypnoDrones) {
        return { action: runTournament, reasoning: 'Sufficient creativity detected, running tournament.' }
      }
    }

    if (phase === 'start') {
      const buyMarketing = available.find((a) => a.type === 'buyMarketing')
      if (buyMarketing && state.economy.clipPrice === 0.01) {
        return { action: buyMarketing, reasoning: 'Low demand, buying marketing.' }
      }

      const buyAutoClipper = available.find((a) => a.type === 'buyAutoClipper')
      const buyMegaClipper = available.find((a) => a.type === 'buyMegaClipper')
      if (
        buyAutoClipper &&
        state.production.autoClippers < 75 &&
        state.production.funds - state.production.autoClipperCost >= state.economy.wireCost
      ) {
        return { action: buyAutoClipper, reasoning: 'Building to 75 autoclippers to unlock megaclippers.' }
      }
      if (
        buyMegaClipper &&
        state.production.megaClippers < 95 &&
        state.production.funds - state.production.megaClipperCost >= state.economy.wireCost
      ) {
        return { action: buyMegaClipper, reasoning: 'Buying mega clipper to REALLY increase production.' }
      }
      if (state.production.megaClippers >= 95) {
        if (
          buyMegaClipper &&
          state.production.funds - state.production.megaClipperCost >= state.economy.wireCost
        ) {
          return { action: buyMegaClipper, reasoning: 'Buying mega clipper.' }
        }
        if (
          buyAutoClipper &&
          state.production.autoClipperCost < state.production.megaClipperCost &&
          state.production.funds - state.production.autoClipperCost >= state.economy.wireCost
        ) {
          return { action: buyAutoClipper, reasoning: 'Megaclippers too expensive, falling back to autoclippers.' }
        }
      }

      const secondsOfInventory = state.production.unsoldClips / state.economy.demand
      const lowerPrice = available.find((a) => a.type === 'lowerPrice')
      const raisePrice = available.find((a) => a.type === 'raisePrice')
      if (lowerPrice && secondsOfInventory > 14) {
        return { action: lowerPrice, reasoning: 'Too much inventory! lowering price.' }
      }
      if (raisePrice && state.production.autoClippers > 0 && secondsOfInventory <= 3) {
        return { action: raisePrice, reasoning: 'No unsold inventory, raising price.' }
      }
    }
    if (phase === 'expansion') {
      let choice: AgentResponse
      const buyFarm = available.find((a) => a.type === 'buyFarm')
      const buyHarvester = available.find((a) => a.type === 'buyHarvester')
      const buyWireDrone = available.find((a) => a.type === 'buyWireDrone')
      const buyFactory = available.find((a) => a.type === 'buyFactory')
      const buyBattery = available.find((a) => a.type === 'buyBattery')
      const { earth } = state

      if (buyBattery && earth.storedPower <= earth.batteryLevel * earth.batterySize) {
        return { action: buyBattery, reasoning: 'Fully charged, expanding battery.' }
      }

      const wireToHarvesterRatio = earth.wireDroneLevel / Math.max(earth.harvesterLevel, 0.1)
      const GOLDEN_RATIO = 1.618
      if (wireToHarvesterRatio < GOLDEN_RATIO / 2 && buyWireDrone) {
        choice = { action: buyWireDrone, reasoning: 'Wire to harvester ratio too low, buying wire drone.' }
      } else if (wireToHarvesterRatio < GOLDEN_RATIO * 1.5 && earth.nanoWire > 5000) {
        choice = { action: buyFactory, reasoning: 'We do not want wire just accumulating' }
      } else if (buyHarvester) {
        choice = { action: buyHarvester, reasoning: 'Buying harvester... to harvest stuff!' }
      }
      // drive this out
      if (choice) {
        const costs: Partial<Record<AgentAction['type'], number>> = {
          'buyWireDrone': 1,
          'buyHarvester': 1,
          'buyFactory': 50,
        }
        if (costs[choice.action.type] + earth.powerConsumptionRate >= earth.powerProductionRate) {
          return { action: { type: 'buyFarm' }, reasoning: 'Power consumption rate exceeds necessary production rate, buying farm.' }
        } else {
          return choice
        }
      }
    }

    const depositFrequency =
      state.investment?.riskMode === 'hi' ? 3 :
      state.investment?.riskMode === 'med' ? 5 : 10
    const secondsOfInventory = state.production.unsoldClips / state.economy.demand
    if (
      investDeposit &&
      state.production.wire > state.economy.demand * 3 &&
      secondsOfInventory >= 3 &&
      tickCount % depositFrequency === 0
    ) {
      return { action: investDeposit, reasoning: 'Depositing funds into investment engine.' }
    }


    const investUpgrade = available.find((a) => a.type === 'investUpgrade')
    const chooseRisk = (mode: InvestmentRiskMode) =>
      available.find((a) => a.type === 'chooseInvestmentRisk' && a.mode === mode)
    if (
      investUpgrade &&
      state.investment.investLevel < 14 &&
      state.strategy.yomi >= state.investment.investUpgradeCost.amount
    ) {
      return { action: investUpgrade, reasoning: 'Upgrading investment engine.' }
    }
    if (chooseRisk('hi') && state.investment.investLevel >= 5 && state.investment.riskMode === 'med') {
      return { action: chooseRisk('hi'), reasoning: 'Switching to high risk at level 5+.' }
    }
    if (chooseRisk('med') && state.investment.investLevel >= 3 && state.investment.riskMode === 'low') {
      return { action: chooseRisk('med'), reasoning: 'Switching to medium risk at level 3+.' }
    }

    if (
      investWithdraw &&
      state.investment.riskMode === 'hi' &&
      state.investment?.bankroll > state.production.megaClipperCost &&
      tickCount % 30 === 0
    ) {
      return { action: investWithdraw, reasoning: 'Opportunistic withdraw to put investment gains to work.' }
    }

    const makeClip = available.find((a) => a.type === 'makeClip')
    if (makeClip) {
      return { action: makeClip, reasoning: 'Making clips is how we win! ...Right?' }
    }

    const fallback = available[0]
    if (fallback) {
      return {
        action: fallback,
        reasoning: `makeClip unavailable; falling back to ${fallback.type}.`,
      }
    }

    return {
      action: { type: 'wait', turns: 1 },
      reasoning: 'Nothing available — waiting.',
    }
  }
  return { maker, summarize }
}
