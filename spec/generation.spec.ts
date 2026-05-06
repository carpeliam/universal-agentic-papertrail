import { vi, describe, expect, it } from "vitest"
import { createInitialGameState, reduceGameState } from "paperclips-remake"
import { createRunner, run, type Agent, type NotesAgent } from "@/generation"

describe('run', () => {
  it('dispatches each action', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(fakeAgent, fakeDispatch, initialState, { ticksPerGeneration: 3 })

    expect(fakeDispatch).toHaveBeenNthCalledWith(1, initialState, { type: 'makeClip' })
    const additionalExpectedActions = [
      { type: 'tick', deltaMs: 1000 },
      { type: 'makeClip' },
      { type: 'tick', deltaMs: 1000 },
      { type: 'makeClip' },
      { type: 'tick', deltaMs: 1000 },
    ]
    additionalExpectedActions.forEach((action, i) => {
      expect(fakeDispatch).toHaveBeenNthCalledWith(i + 2, expect.anything(), action)
    })
  })
  it('returns a transcript with one record per tick', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    const { transcript } = await run(fakeAgent, fakeDispatch, initialState, { ticksPerGeneration: 3 })

    expect(transcript).toHaveLength(3)
  })
  it('returns early if the game completes part way through', async () => {
    const initialState = createInitialGameState()
    const winState = {
      ...initialState,
      space: { ...initialState.space, totalMatter: 100, foundMatter: 100 },
    }
    const fakeAgent: Agent = vi.fn().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(fakeAgent, fakeDispatch, winState, { ticksPerGeneration: 2 })

    expect(fakeAgent).not.toHaveBeenCalled()
    expect(fakeDispatch).not.toHaveBeenCalled()
  })
  it('returns early if the game stalls part way through', async () => {
    const initialState = createInitialGameState()
    const stalledState = { ...initialState, earth: { ...initialState.earth, humanFlag: false, spaceFlag: true } }
    const fakeAgent: Agent = vi.fn().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(fakeAgent, fakeDispatch, stalledState, { ticksPerGeneration: 2 })

    expect(fakeAgent).not.toHaveBeenCalled()
    expect(fakeDispatch).not.toHaveBeenCalled()
  })
})

describe('createRunner', () => {
  it('asks the agent to rewrite notes at the end of the generation', async () => {
    const initialState = createInitialGameState()
    const fakeAgent: Agent = async () => ({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeNotesAgent = vi.fn<NotesAgent>().mockResolvedValue('new notes from agent')
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    const runGeneration = createRunner(fakeAgent, fakeNotesAgent, fakeDispatch, { ticksPerGeneration: 2 })
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
