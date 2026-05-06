import { getStallState, getWirePurchaseAmount, type GameAction, type GameState } from "paperclips-remake"
import type { AgentAction } from "./types"

type AgentState = Omit<GameState, 'version' | 'paused' | 'prestige' | 'wirePurchased' | 'lastTickProduction' | 'lastTickSales' | 'lastTickRevenue' | 'lastAction' | 'earth' | 'space' | 'compute' | 'investment' | 'strategy'>
  & Partial<Pick<GameState, 'compute' | 'investment' | 'strategy' | 'space'>>

export function toAgentState(state: GameState): AgentState {
  const { version, paused, prestige, wirePurchased, lastTickProduction, lastTickSales, lastTickRevenue, lastAction, earth, compute, investment, strategy, space, ...rest } = state

  return {
    ...rest,
    ...(compute.unlocked && { compute }),
    ...(investment.unlocked && { investment }),
    ...(strategy.unlocked && { strategy }),
  }
}

type AgentActions = {
  available: AgentAction[]
  unavailable: AgentAction[]
}
export function getActions(state: GameState): AgentActions {
  const available: AgentAction[] = []
  const unavailable: AgentAction[] = []

  const { production } = state

  if (production.wire === 0) {
    unavailable.push({ type: 'makeClip' })
  } else {
    available.push({ type: 'makeClip' })
  }

  if (state.phase !== 'boot') {
    if (production.funds >= production.autoClipperCost) {
      available.push({ type: 'buyAutoClipper' })
    } else {
      unavailable.push({ type: 'buyAutoClipper' })
    }
  }

  return { available, unavailable }
}

export type AgentPrompt = {
  state: AgentState
  actions: AgentActions
}
export function createAgentPrompt(state: GameState): AgentPrompt {
  return { state: toAgentState(state), actions: getActions(state) }
}

export function toGameAction(action: AgentAction, state: GameState): GameAction {
  switch (action.type) {
    case 'buyWire':
      return { type: 'buyWire', amount: getWirePurchaseAmount(state, 1) }
    default:
      return action as GameAction
  }
}

export function isGameOver(state: GameState) {
  const remainingMatter = Math.max(0, state.space.totalMatter - state.space.foundMatter)
  return remainingMatter == 0 || getStallState(state).stalled
}
