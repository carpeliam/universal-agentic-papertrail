import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { vol } from "memfs"
import { createInitialGameState } from "paperclips-remake"
import { metrics, initMetrics, type Metrics } from "@/metrics"
import { TickInteraction } from "@/types"
import { events } from "@/events"
import { applyGameState, withSpacePhase } from "./helper"

vi.mock('node:fs/promises')

describe('metrics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vol.reset()
    events.reset()
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
    const transcript = [generateTickInteraction(), generateTickInteraction()]

    await initMetrics()
    events.emit('agentStarted', {
      type: 'llm',
      agent: { provider: 'anthropic', model: 'sonnet' },
      summarizer: { provider: 'anthropic', model: 'sonnet' },
      planMode: false,
      verbosity: 0,
    })
    vi.advanceTimersByTime(123)
    events.emit('generationCompleted', { state, transcript })

    const currentMetrics = metrics()
    expect(currentMetrics).toEqual({
      agentName: 'anthropic/sonnet',
      wallClockMs: 123,
      gameElapsedMs: 10_000,
      clipCount: 999,
      tickCount: 2,
      status: 'active',
    })

    await vi.waitFor(() => {
      const fileContents = vol.readFileSync('data/metrics.json', 'utf-8') as string
      const metrics = JSON.parse(fileContents)

      expect(metrics).toEqual({
        agentName: 'anthropic/sonnet',
        wallClockMs: 123,
        gameElapsedMs: 10_000,
        clipCount: 999,
        tickCount: 2,
        status: 'active',
      })
    })
  })

  it('appends current game state to existing log', async () => {
    const priorMetrics: Partial<Metrics> = {
      agentName: 'anthropic/opus',
      wallClockMs: 246,
      gameElapsedMs: 10,
      clipCount: 99,
      tickCount: 6,
      status: 'active',
    }
    vol.fromJSON({ 'data/metrics.json': JSON.stringify(priorMetrics) })

    const state = applyGameState(withSpacePhase(), {
      elapsedMs: 269223000,
      production: {
        clips: 999,
      },
      space: {
        totalMatter: 1000,
        foundMatter: 1000,
      },
    })
    const transcript = [generateTickInteraction(), generateTickInteraction()]

    await initMetrics()
    events.emit('agentStarted', {
      type: 'llm',
      agent: { provider: 'anthropic', model: 'sonnet' },
      summarizer: { provider: 'anthropic', model: 'sonnet' },
      planMode: false,
      verbosity: 0,
    })
    vi.advanceTimersByTime(123)
    events.emit('generationCompleted', { state, transcript })

    await vi.waitFor(() => {
      const fileContents = vol.readFileSync('data/metrics.json', 'utf-8') as string
      const metrics = JSON.parse(fileContents)

      expect(metrics).toEqual({
        agentName: 'anthropic/sonnet',
        wallClockMs: 369,
        gameElapsedMs: 269223000,
        clipCount: 999,
        tickCount: 8,
        status: 'complete',
      })
    })
  })
})

function generateTickInteraction(): TickInteraction {
  return {
    prompt: {
      state: createInitialGameState(),
      actions: { available: [{ type: 'wait', turns: 1 }], unavailable: [] },
    },
    response: { plan: [{ type: 'wait', turns: 1 }], reasoning: '' },
  }
}
