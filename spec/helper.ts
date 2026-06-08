import { createInitialGameState, type GameState, type SpaceBattle } from "paperclips-remake"

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
export function applyIndustryState(overrides: DeepPartial<GameState> = {}): GameState {
  const base = createInitialGameState()
  const { compute, production, economy, investment, strategy, earth, space, projects, ...rest } = overrides
  return {
    ...base,
    ...rest as Partial<GameState>,
    phase: 'industry',
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
export function applyComputeState(overrides: DeepPartial<GameState> = {}): GameState {
  const base = createInitialGameState()
  const { compute, production, economy, investment, strategy, earth, space, projects, ...rest } = overrides
  return {
    ...base,
    ...rest as Partial<GameState>,
    phase: 'compute',
    compute: { ...base.compute, unlocked: true, ...compute } as GameState['compute'],
    production: { ...base.production, ...production } as GameState['production'],
    economy: { ...base.economy, ...economy } as GameState['economy'],
    investment: { ...base.investment, ...investment } as GameState['investment'],
    strategy: { ...base.strategy, unlocked: true, ...strategy } as GameState['strategy'],
    earth: { ...base.earth, ...earth } as GameState['earth'],
    space: { ...base.space, ...space } as GameState['space'],
    projects: { ...base.projects, ...projects } as GameState['projects'],
  }
}
export function applyExpansionState(overrides: DeepPartial<GameState> = {}): GameState {
  const base = applyComputeState()
  const { compute, production, economy, investment, strategy, earth, space, projects, ...rest } = overrides
  return {
    ...base,
    ...rest as Partial<GameState>,
    phase: 'expansion',
    compute: { ...base.compute, ...compute },
    production: { ...base.production, ...production },
    economy: { ...base.economy, ...economy },
    investment: { ...base.investment, ...investment } as GameState['investment'],
    strategy: { ...base.strategy, ...strategy } as GameState['strategy'],
    earth: { ...base.earth, phase: 'postHuman', humanFlag: false, ...earth } as GameState['earth'],
    space: { ...base.space, ...space } as GameState['space'],
    projects: { ...base.projects, ...projects, project35: true },
  }
}
export function applySpaceState(overrides: DeepPartial<GameState> = {}): GameState {
  const base = applyExpansionState()
  const { compute, production, economy, investment, strategy, earth, space, projects, ...rest } = overrides
  return {
    ...base,
    ...rest as Partial<GameState>,
    compute: { ...base.compute, ...compute } as GameState['compute'],
    production: { ...base.production, ...production } as GameState['production'],
    economy: { ...base.economy, ...economy } as GameState['economy'],
    investment: { ...base.investment, ...investment } as GameState['investment'],
    strategy: { ...base.strategy, ...strategy } as GameState['strategy'],
    earth: { ...base.earth, spaceFlag: true, ...earth } as GameState['earth'],
    space: { ...base.space, ...space } as GameState['space'],
    projects: { ...base.projects, ...projects, project35: true } as GameState['projects'],
  }
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
