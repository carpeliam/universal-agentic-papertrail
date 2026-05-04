import { createRunnerForGeneration, run, type Agent, type NotesAgent } from "@/generation"
import { createInitialGameState } from "paperclips-remake"
import { vi, describe, expect, it } from "vitest"

describe('run', () => {
  it('advances the game clock', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })

    const { state } = await run(fakeAgent, initialState, { ticksPerGeneration: 3 })

    expect(state.elapsedMs).toBeGreaterThan(0)
  })
  it('applies the agent action to the game state', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })

    const { state } = await run(fakeAgent, initialState, { ticksPerGeneration: 3 })

    expect(state.production.clips).toBeGreaterThan(0)
  })
  it('returns a transcript with one record per tick', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })

    const { transcript } = await run(fakeAgent, initialState, { ticksPerGeneration: 3 })

    expect(transcript).toHaveLength(3)
  })
})

describe('createRunnerForGeneration', () => {
  it('asks the agent to rewrite notes at the end of the generation', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeNotesAgent = vi.fn<NotesAgent>().mockResolvedValue('new notes from agent')

    const runGeneration = createRunnerForGeneration(fakeAgent, fakeNotesAgent, { ticksPerGeneration: 2 })
    const result = await runGeneration(initialState, 'old notes')

    expect(result.notes).toBe('new notes from agent')
    expect(fakeNotesAgent).toHaveBeenCalledWith(
      'old notes',
      expect.arrayContaining([
        expect.objectContaining({
          response: { action: { type: 'makeClip' }, reasoning: '' }
        }),
        expect.objectContaining({
          response: { action: { type: 'makeClip' }, reasoning: '' }
        })
      ])
    )
  })
})
