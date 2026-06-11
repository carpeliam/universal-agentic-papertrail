import { createInitialGameState, type GameState, type SpaceBattle } from "paperclips-remake"

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
function patch<TBase extends GameState | DeepPartial<GameState>>(base: TBase, overrides: DeepPartial<GameState>): TBase {
  const { compute, production, economy, investment, strategy, earth, space, projects, ...rest } = overrides
  return {
    ...base,
    ...rest,
    compute: { ...base.compute, ...compute } as GameState['compute'],
    production: { ...base.production, ...production } as GameState['production'],
    economy: { ...base.economy, ...economy } as GameState['economy'],
    investment: { ...base.investment, ...investment } as GameState['investment'],
    strategy: { ...base.strategy, ...strategy } as GameState['strategy'],
    earth: { ...base.earth, ...earth } as GameState['earth'],
    space: { ...base.space, ...space } as GameState['space'],
    projects: { ...base.projects, ...projects } as GameState['projects'],
  }
}
export function applyGameState(...overrides: DeepPartial<GameState>[]): GameState {
  return overrides.reduce<GameState>(patch, createInitialGameState())
}
export function applyIndustryState(...overrides: DeepPartial<GameState>[]): GameState {
  return applyGameState({ phase: 'industry' }, ...overrides)
}
export function applyComputeState(...overrides: DeepPartial<GameState>[]): GameState {
  return applyGameState({
      phase: 'compute',
      compute: { unlocked: true },
      strategy: { unlocked: true },
    }, ...overrides)
}
export function applyExpansionState(...overrides: DeepPartial<GameState>[]): GameState {
  return applyComputeState({
      phase: 'expansion',
      earth: { phase: 'postHuman', humanFlag: false },
      projects: { project35: true },
    }, ...overrides)
}
export function applySpaceState(...overrides: DeepPartial<GameState>[]): GameState {
  return applyExpansionState({
      earth: { spaceFlag: true },
      projects: { project35: true },
    }, ...overrides)
}

export function withAutoClippersEnabled(): DeepPartial<GameState> {
  return { production: { funds: 6 } }
}

export function withMegaClippersEnabled(): DeepPartial<GameState> {
  return { projects: { project22: true } }
}

export function generateActiveBattle(): SpaceBattle {
  return {
    id: 1,
    name: "Drifter Attack 1",
    clipProbes: 3452472.361476761,
    drifterProbes: 410481.57527364074,
    territory: 3.22559376725434e+28,
    unitSize: 10003.390377970392,
    startingLeftShips: 4,
    startingRightShips: 1,
    leftShips: 4,
    rightShips: 1,
    battleClock: 0,
    masterBattleClock: 1285,
    battleEndDelay: false,
    battleEndTimer: 100,
  }
}
