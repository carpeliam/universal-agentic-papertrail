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

export function withAutoClippersEnabled(): DeepPartial<GameState> {
  return { production: { funds: 6 } }
}

export function withMegaClippersEnabled(): DeepPartial<GameState> {
  return { projects: { project22: true } }
}

export function withComputeUnlocked(): DeepPartial<GameState> {
  return {
    phase: 'compute',
    compute: { unlocked: true },
  }
}

export function withCreativity(): DeepPartial<GameState> {
  return patch(withComputeUnlocked(), {
    compute: { creativityOn: true },
  })
}

export function withSwarmComputing(): DeepPartial<GameState> {
  return patch(withComputeUnlocked(), {
    compute: { swarmFlag: true },
    earth: { powMod: 1 },
    projects: { project126: true },
  })
}

export function withInvestingUnlocked(): DeepPartial<GameState> {
  return {
    investment: { unlocked: true },
  }
}

export function withIndustryPhase(): DeepPartial<GameState> {
  return { phase: 'industry' }
}

export function withStrategicModeling(): DeepPartial<GameState> {
  return patch(withComputeUnlocked(), {
    strategy: { unlocked: true },
    projects: { project20: true },
  })
}

export function withFullMonopolyVisible(): DeepPartial<GameState> {
  return {
    projects: { project37: true },
  }
}

export function withHypnoDronesAvailable(): DeepPartial<GameState> {
  return patch(withComputeUnlocked(), {
    compute: { operations: 70_000 },
    projects: { project34: true },
  })
}

export function withExpansion(): DeepPartial<GameState> {
  return patch(withComputeUnlocked(), {
    phase: 'expansion',
    earth: { phase: 'postHuman', humanFlag: false },
    projects: { project35: true },
  })
}

export function withWireProduction(): DeepPartial<GameState> {
  return patch(withExpansion(), {
    earth: { wireProductionFlag: true },
    projects: { project41: true },
  })
}

export function withHarvesting(): DeepPartial<GameState> {
  return patch(withWireProduction(), {
    earth: { harvesterFlag: true },
    projects: { project43: true },
  })
}

export function withWireDroneCapability(): DeepPartial<GameState> {
  return patch(withWireProduction(), {
    earth: { wireDroneFlag: true },
    projects: { project44: true },
  })
}

export function withFactoryCapability(): DeepPartial<GameState> {
  return [
    withHarvesting(),
    withWireDroneCapability(),
  ].reduce<DeepPartial<GameState>>(patch, {
    earth: { factoryFlag: true },
    projects: { project45: true },
  })
}

export function withPowerGrid(): DeepPartial<GameState> {
  return patch(withExpansion(), {
    earth: { powerGridFlag: true },
    projects: { project127: true },
  })
}

export function withSpacePhase(): DeepPartial<GameState> {
  return patch(withFactoryCapability(), {
    earth: {
      spaceFlag: true,
      powMod: 1,
      farmLevel: 1,
    },
    projects: { project35: true },
  })
}

export function withCombat(): DeepPartial<GameState> {
  return patch(withSpacePhase(), { projects: { project131: true } })
}

export function withBattle(overrides: Partial<SpaceBattle> = {}): DeepPartial<GameState> {

  return patch(withCombat(), {
    space: {
      battleFlag: true,
      activeBattle: Object.assign({
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
      }, overrides),
    },
  })
}
