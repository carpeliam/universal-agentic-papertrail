import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { vol } from 'memfs'
import { capture, type Metrics } from "@/metrics"
import { RunResults } from "@/generation"
import { TickInteraction } from "@/types"
import { applyIndustryState, applySpaceState } from "./helper"
import { toAgentState } from "@/agent-adapter"
import { createInitialGameState } from "paperclips-remake"

vi.mock('node:fs/promises')

describe('capture', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vol.reset()
  })
  afterEach(() => { vi.clearAllTimers() })

  it('captures partial game state, actions, tick counts, and wall clock duration', async () => {
    const state = {
      ...createInitialGameState(),
      elapsedMs: 10_000,
      production: {
        ...createInitialGameState().production,
        clips: 999,
      },
    }
    console.log(state)
    const transcript = [generateTickInteraction(1), generateTickInteraction(2)]
    async function fn(): Promise<RunResults> {
      vi.advanceTimersByTime(123)
      return { state, transcript }
    }
    const result = await capture(() => fn())
    expect(result).toEqual({ state, transcript })

    const fileContents = vol.readFileSync('data/metrics.json', 'utf-8') as string
    const metrics = JSON.parse(fileContents)
    expect(metrics).toEqual({
      wallClockMs: 123,
      gameElapsedMs: 10_000,
      clipCount: 999,
      tickCount: 2,
      status: 'active',
    })
  })
  it('appends current game state to existing log', async () => {
    const priorMetrics: Metrics = {
      wallClockMs: 246,
      gameElapsedMs: 10,
      clipCount: 99,
      tickCount: 6,
      status: 'active',
    }
    vol.fromJSON({ 'data/metrics.json': JSON.stringify(priorMetrics) })

    const state = applySpaceState({
      elapsedMs: 269223000,
      production: {
        clips: 999,
      },
      space: {
        totalMatter: 1000,
        foundMatter: 1000,
      },
    })
    const transcript = [generateTickInteraction(1), generateTickInteraction(2)]
    async function fn(): Promise<RunResults> {
      vi.advanceTimersByTime(123)
      return { state, transcript }
    }
    const result = await capture(() => fn())
    expect(result).toEqual({ state, transcript })

    const fileContents = vol.readFileSync('data/metrics.json', 'utf-8') as string
    const metrics = JSON.parse(fileContents)

    expect(metrics).toEqual({
      wallClockMs: 369,
      gameElapsedMs: 269223000,
      clipCount: 999,
      tickCount: 8,
      status: 'complete',
    })
  })
})

function generateTickInteraction(elapsedMs: number): TickInteraction {
  return {
    prompt: {
      state: toAgentState(applyIndustryState({ elapsedMs })),
      actions: { available: [{ type: 'wait', turns: 1 }], unavailable: [] },
      priorNotes: [],
    },
    response: { action: { type: 'wait', turns: 1 }, reasoning: '' },
  }
}
