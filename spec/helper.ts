import { createInitialGameState, type GameState } from "paperclips-remake"

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
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
