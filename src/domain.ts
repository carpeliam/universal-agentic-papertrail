import { GameState } from "paperclips-remake";

export function areAutoClippersVisible(state: GameState) {
  return state.earth.humanFlag &&
    (state.production.funds >= 5 ||
    state.production.autoClippers > 0 ||
    state.production.marketingLevel > 1 ||
    state.wirePurchased > 0)
}

export function areMegaClippersVisible(state: GameState) {
  return state.earth.humanFlag && state.projects.project22.completed
}

export function isCombatEnabled(state: GameState) {
  return state.projects.project131.completed
}
