import { getDroneStatus, getMaxOps, getTotalDroneCount, totalSecondsUntilSwarmGift, type GameState } from 'paperclips-remake'
import { areAutoClippersVisible, areMegaClippersVisible, isCombatEnabled } from '@/domain'
import type { AgentAction, AgentActions, AgentPrompt, Cost, PromptAction } from '../types'

type ActionType = AgentAction['type']
type ActionTypeData = ActionType | Partial<Record<ActionType, Cost>>

export function displayPrompt(prompt: AgentPrompt): string {
  return md`\
    # Paperclips: ${numeric(prompt.state.production.clips)}

    ${business(prompt)}

    ${manufacturing(prompt)}

    ${compute(prompt)}

    ${investments(prompt)}

    ${wireProduction(prompt)}

    ${power(prompt)}

    ${space(prompt)}

    ${vonNeumannProbeDesign(prompt)}

    ${combat(prompt)}

    ${strategy(prompt)}

    ${swarmComputing(prompt)}

    ${projects(prompt)}

    Clock: ${clock(prompt.state.elapsedMs)}

    ## Available Actions
    ${prompt.actions.available.map(a => markAvailable(JSON.stringify(a)))}

    ## Unavailable Actions
    ${prompt.actions.unavailable.map(a => markUnavailable(JSON.stringify(a)))}`
}

function business({ state, actions }: AgentPrompt) {
  if (!state.earth.humanFlag) return
  const { production, economy } = state
  return md`\
    ## Business

    Available Funds: ${currency(production.funds)}
    Unsold Inventory: ${numeric(production.unsoldClips)}
    Price per Clip: ${currency(economy.clipPrice)}
    Public Demand: ${numeric(economy.demand * 10)}%

    ${actionsFor(actions, 'raisePrice', 'lowerPrice', {
      buyMarketing: { amount: economy.adCost, unit: 'dollars' },
    })}`
}

function manufacturing({ state, actions }: AgentPrompt) {
  const { production, economy, earth, lastTickProduction } = state

  return md`\
    ## Manufacturing

    Clips per Tick: ${numeric(lastTickProduction)}
    ${(earth.humanFlag)
      ? `Wire: ${numeric(production.wire)} inches`
      : [
        `Unused Clips: ${numeric(production.unusedClips)}`,
        `Factories: ${earth.factoryLevel}`
      ]}

    ${areAutoClippersVisible(state) && `AutoClippers: ${numeric(production.autoClippers)}`}
    ${areMegaClippersVisible(state) && `MegaClippers: ${numeric(production.megaClippers)}`}

    ${actionsFor(actions, {
      buyAutoClipper: { amount: production.autoClipperCost, unit: 'dollars' },
      buyMegaClipper: { amount: production.megaClipperCost, unit: 'dollars' },
      buyWire: { amount: economy.wireCost, unit: 'dollars' },
      buyFactory: { amount: earth.factoryCost, unit: 'clips' },
    })}`
}

function compute({ state, actions }: AgentPrompt) {
  const { compute, earth } = state
  if (!compute.unlocked) return

  const { processors, memory, trust } = compute
  const unallocatedTrust = trust - (processors + memory)
  const breakdown = [
    `Processors: ${numeric(processors)}`,
    `Memory: ${numeric(memory)}`,
    (unallocatedTrust > 0) && `Unallocated: ${numeric(unallocatedTrust)}`,
  ].filter(Boolean).join(' | ')
  return md`\
    ## Computational Resources

    ${earth.humanFlag && [
      `Trust: ${numeric(trust)} (${breakdown})`,
      `Next Trust at: ${numeric(compute.nextTrust)} clips`,
    ]}
    ${compute.swarmFlag && `Swarm gifts: ${numeric(compute.swarmGifts)}`}

    Memory: ${numeric(memory)}
    Operations: ${numeric(compute.operations)} / ${numeric(getMaxOps(state))}

    Processors: ${numeric(processors)}
    ${(compute.creativityOn) && `Creativity: ${numeric(compute.creativity)}`}

    ${actionsFor(actions, 'addProcessor', 'addMemory')}`
}

function investments({ state, actions }: AgentPrompt) {
  const { investment } = state
  if (!investment.unlocked) return

  const riskMode: Record<GameState['investment']['riskMode'], string> = {
    low: 'Low Risk',
    med: 'Med Risk',
    hi: 'High Risk',
  }

  return md`\
    ## Investments

    Cash: ${currency(investment.bankroll, { showCents: false })}
    Stocks: ${currency(investment.secTotal, { showCents: false })}
    Portfolio Total: ${currency(investment.portTotal, { showCents: false })}

    | Stock | Amount | Price | Total | P/L |
    |-------|--------|-------|-------|-----|
    ${investment.stocks.map(stock => (
      `| ${stock.symbol} | ${stock.amount} | ${stock.price} | ${stock.total} | ${stock.profit} |`
    ))}

    Investment Level: ${numeric(investment.investLevel)}
    Risk: ${riskMode[investment.riskMode]}

    ${actionsFor(actions, 'investDeposit', 'investWithdraw', 'chooseInvestmentRisk', {
      investUpgrade: { amount: investment.investUpgradeCost, unit: 'yomi' },
    })}`
}

function strategy({ state, actions }: AgentPrompt) {
  const { strategy } = state
  if (!strategy.unlocked) return

  const { lastPayoffMatrix } = strategy

  const actionTypes: ActionTypeData[] = ['chooseStrategy', { runTournament: { amount: strategy.tourneyCost, unit: 'ops' } }]
  if (strategy.autoTourneyEnabled) {
    actionTypes.push('toggleAutoTourney')
  }

  return md`\
    ## Strategic Modeling

    Current Strategy: ${strategy.selectedStrategy}
    Yomi: ${numeric(strategy.yomi)}
    Tournament Level: ${strategy.tourneyLevel}

    ${(!!lastPayoffMatrix) && md`\
      Payoff Matrix:
      |        | Move A | Move B |
      |--------|--------|--------|
      | Move A | ${lastPayoffMatrix.AA},${lastPayoffMatrix.AA} | ${lastPayoffMatrix.AB},${lastPayoffMatrix.BA} |
      | Move B | ${lastPayoffMatrix.BA},${lastPayoffMatrix.AB} | ${lastPayoffMatrix.BB},${lastPayoffMatrix.BB} |`}

    ${actionsFor(actions, ...actionTypes)}`
}

function wireProduction({ state, actions }: AgentPrompt) {
  const { production, earth } = state
  if (!earth.wireProductionFlag) return

  return md`\
    ## Wire Production

    Available Matter: ${numeric(earth.availableMatter)} g
    Acquired Matter: ${numeric(earth.acquiredMatter)} g (${numeric(earth.harvesterRate)} g per tick)
    Wire: ${numeric(production.wire)} inches (${numeric(earth.wireDroneRate)} inches per tick)

    Harvester Drones: ${earth.harvesterLevel}
    Wire Drones: ${earth.wireDroneLevel}

    ${actionsFor(actions, {
      buyHarvester: { amount: earth.harvesterCost, unit: 'clips' },
      buyWireDrone: { amount: earth.wireDroneCost, unit: 'clips' },
    })}`
}

function power({ state, actions }: AgentPrompt) {
  const { earth } = state
  if (!earth.powerGridFlag) return

  const batteryCapacity = earth.batteryLevel * earth.batterySize

  return md`\
    ## Power

    Factory/Drone Performance: ${numeric(earth.powMod * 100)}%
    Consumption: ${numeric(earth.powerConsumptionRate)} MWs
    consumption from factories: ${numeric(earth.factoryPowerConsumptionRate)} MWs
    consumption from drones: ${numeric(earth.dronePowerConsumptionRate)} MWs

    Production: ${numeric(earth.powerProductionRate)} MWs
    Storage: ${numeric(earth.storedPower)} / ${numeric(batteryCapacity)} MW-seconds

    ${actionsFor(actions, {
      buyFarm: { amount: earth.farmCost, unit: 'clips' },
      buyBattery: { amount: earth.batteryCost, unit: 'clips' },
    })}`
}

function space({ state, actions }: AgentPrompt) {
  const { earth, space } = state
  if (!earth.spaceFlag) return

  return md`\
    ## Space Exploration

    ${numeric(space.foundMatter / space.totalMatter * 100, 12)}% of universe explored
    Probes launched: ${numeric(space.probeLaunchLevel)}
    Descendents: ${numeric(space.probeDescendents)}
    ${(space.probesLostHaz > 0) && `Lost to hazards: ${numeric(space.probesLostHaz)}`}
    ${(space.probesLostDrift > 0) && `Lost to value drift: ${numeric(space.probesLostDrift)}`}
    ${(space.probesLostCombat > 0) && `Lost in combat: ${numeric(space.probesLostCombat)}`}
    ---
    Total: ${numeric(space.probeCount)}

    ${(space.battleFlag) && `Drifters: ${numeric(space.drifterCount)}`}

    ${actionsFor(actions, { launchProbe: { amount: space.probeCost, unit: 'clips' } })}`
}

function vonNeumannProbeDesign({ state, actions }: AgentPrompt) {
  if (!state.earth.spaceFlag) return
  const { space } = state

  return md`\
    ## Von Neumann Probe Design

    Trust: ${numeric(space.probeUsedTrust)} / ${numeric(space.probeTrust)} (${numeric(space.maxTrust)} max)
    Speed: ${numeric(space.probeSpeed)}
    Exploration: ${numeric(space.probeNav)}
    Self-Replication: ${numeric(space.probeRep)}
    Hazard Remediation: ${numeric(space.probeHaz)}
    Factory Production: ${numeric(space.probeFac)}
    Harvester Drone Production: ${numeric(space.probeHarv)}
    Wire Drone Production: ${numeric(space.probeWire)}
    ${isCombatEnabled(state) && `Combat: ${numeric(space.probeCombat)}`}

    ${actionsFor(actions, 'assignProbeTrust', {
      increaseProbeTrust: { amount: space.probeTrustCost, unit: 'yomi' },
      increaseMaxTrust: { amount: space.maxTrustCost, unit: 'honor' },
    })}`
}

function combat({ state }: AgentPrompt) {
  if (!isCombatEnabled(state)) return
  const { space } = state
  const { activeBattle } = space
  if (!activeBattle) return

  return md`\
    ## Combat

    **Active Battle: ${activeBattle.name}**
    Our probes: ${numeric(activeBattle.leftShips)} / ${numeric(activeBattle.startingLeftShips)}
    Enemy drifter probes: ${numeric(activeBattle.rightShips)} / ${numeric(activeBattle.startingRightShips)}`
}

function swarmComputing({ state, actions }: AgentPrompt) {
  const { compute } = state
  if (!compute.swarmFlag) return

  const timeUntilSwarmGift = totalSecondsUntilSwarmGift(state)
  return md`\
    ## Swarm Computing

    Drone count: ${numeric(getTotalDroneCount(state))}
    Swarm status: ${getDroneStatus(state)}
    Work/Think balance: ${numeric(compute.swarmComputingBalance)} (0=all work, 100=all think)
    ${(timeUntilSwarmGift !== null) && `Next gift in: ${clock(timeUntilSwarmGift)}`}

    ${actionsFor(actions, 'setSwarmComputingBalance', {
      entertainSwarm: { amount: compute.entertainCost, unit: 'creativity' },
      synchronizeSwarm: { amount: compute.synchCost, unit: 'yomi' },
    })}`
}

function projects({ state, actions }: AgentPrompt) {
  const availableProjects = actions.available.filter(a => a.type === 'completeProject')
  const unavailableProjects = actions.unavailable.filter(a => a.type === 'completeProject')
  if (!availableProjects.length && !unavailableProjects.length) return

  return md`\
    ## Projects

    ${[
      ...availableProjects.map(p => `✓ **${p.title}** (${displayCost(p.cost as Cost | Cost[])})`),
      ...unavailableProjects.map(p => `✗ **${p.title}** (${displayCost(p.cost as Cost | Cost[])})`),
    ]}`
}

function numeric(n: number, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n)
}

function currency(n: number, { showCents } = { showCents: true }) {
  return `$${numeric(n, showCents ? 2 : 0)}`
}

function clock(ms: number) {
  if (ms === Infinity) return String(ms)
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return (h > 0)
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function displayCost(cost: Cost | Cost[]) {
  const singleCost = (c: Cost) => (c.unit === 'dollars') ? currency(c.amount) : `${numeric(c.amount)} ${c.unit}`
  return Array.isArray(cost) ? cost.map(singleCost).join(', ') : singleCost(cost)
}

function markAvailable(action: string) { return `✓ ${action}` }
function markUnavailable(action: string) { return `✗ ${action}` }

function actionsFor({ available, unavailable }: AgentActions, ...typesAndCosts: ActionTypeData[]) {
  const types = typesAndCosts.flatMap(t => (typeof t === 'string' ? t : Object.keys(t) as ActionType[]))
  const costs = typesAndCosts.reduce(
    (all: Partial<Record<ActionType, Cost>>, t) => typeof t === 'string' ? all : { ...all, ...t },
    {},
  )

  const actionLabel = ({ type, ...rest }: PromptAction) => {
    if (Object.keys(rest).length === 0) {
      return type
    }
    const entries = Object.entries(rest)
    const description = (entries.length === 1)
      ? entries[0][1]
      : entries.map(pair => pair.join('=')).join(',')
    return `${type}(${description})`
  }

  const actionLabelWithCost = (action: PromptAction) => {
    const label = actionLabel(action)
    const cost = costs[action.type]
    return (cost !== undefined) ? `${label} [cost: ${displayCost(cost)}]` : label
  }

  const actions = [
    ...available.filter(a => types.includes(a.type)).map(a => markAvailable(actionLabelWithCost(a))),
    ...unavailable.filter(a => types.includes(a.type)).map(a => markUnavailable(actionLabelWithCost(a))),
  ]

  return (actions.length) ? ['Actions:', ...actions].join('\n') : undefined
}

function md(strings: TemplateStringsArray, ...values: unknown[]) {
  const result = strings.reduce((result: string, currentString: string, i: number) => {
    const value = values[i]

    if (!value) {
      return result.replace(/\n\s*$/, '') + currentString.replace(/^\s*\n/, '')
    }

    return result + currentString + (Array.isArray(value) ? value.join('\n') : String(value))
  }, '')

  const firstLineIndent = result.match(/^(\s+)/)?.[1]
  if (!firstLineIndent) return result

  return result
    .split('\n')
    .map(line => line.startsWith(firstLineIndent) ? line.slice(firstLineIndent.length) : line)
    .join('\n')
}
