import { GameState, createInitialGameState } from "paperclips-remake"

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
export function applyComputeState(overrides: DeepPartial<GameState> = {}): GameState {
  const base = createInitialGameState()
  return {
    ...base,
    phase: 'compute',
    compute: { ...base.compute, unlocked: true, ...overrides.compute } as GameState['compute'],
    production: { ...base.production, ...overrides.production } as GameState['production'],
    economy: { ...base.economy, ...overrides.economy } as GameState['economy'],
    investment: { ...base.investment, ...overrides.investment } as GameState['investment'],
    strategy: { ...base.strategy, unlocked: true, ...overrides.strategy } as GameState['strategy'],
    earth: { ...base.earth, ...overrides.earth } as GameState['earth'],
    space: { ...base.space, ...overrides.space } as GameState['space'],
  }
}
export function applyExpansionState(overrides: DeepPartial<GameState> = {}): GameState {
  const base = applyComputeState()
  return {
    ...base,
    phase: 'expansion',
    compute: { ...base.compute, ...overrides.compute },
    production: { ...base.production, ...overrides.production },
    economy: { ...base.economy, ...overrides.economy },
    investment: { ...base.investment, ...overrides.investment } as GameState['investment'],
    strategy: { ...base.strategy, ...overrides.strategy } as GameState['strategy'],
    earth: { ...base.earth, humanFlag: false, ...overrides.earth } as GameState['earth'],
    space: { ...base.space, ...overrides.space } as GameState['space'],
    projects: { ...base.projects, project35: true }
  }
}
