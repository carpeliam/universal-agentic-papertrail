import { vi, describe, expect, it } from "vitest"
import { createInitialGameState, reduceGameState } from "paperclips-remake"
import { createRunner, run, type NotesAgent } from "@/generation"
import type { Player } from "@/agent"

describe('run', () => {
  it('dispatches each action', async () => {
    const initialState = createInitialGameState()
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(createPlayer(fakePlay), fakeDispatch, initialState, [], { ticksPerGeneration: 3 })

    expect(fakeDispatch).toHaveBeenNthCalledWith(1, initialState, { type: 'makeClip' })
    const additionalExpectedActions = [
      expect.objectContaining({ type: 'tick' }),
      { type: 'makeClip' },
      expect.objectContaining({ type: 'tick' }),
      { type: 'makeClip' },
      expect.objectContaining({ type: 'tick' }),
    ]
    additionalExpectedActions.forEach((action, i) => {
      expect(fakeDispatch).toHaveBeenNthCalledWith(i + 2, expect.anything(), action)
    })
  })
  it('returns a transcript with one record per tick', async () => {
    const initialState = createInitialGameState()
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    const { transcript } = await run(createPlayer(fakePlay), fakeDispatch, initialState, [], { ticksPerGeneration: 3 })

    expect(transcript).toHaveLength(3)
  })
  it('returns early if the game completes part way through', async () => {
    const initialState = createInitialGameState()
    const winState = {
      ...initialState,
      space: { ...initialState.space, totalMatter: 100, foundMatter: 100 },
    }
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(createPlayer(fakePlay), fakeDispatch, winState, [], { ticksPerGeneration: 2 })

    expect(fakePlay).not.toHaveBeenCalled()
    expect(fakeDispatch).not.toHaveBeenCalled()
  })
  it('returns early if the game stalls part way through', async () => {
    const initialState = createInitialGameState()
    const stalledState = { ...initialState, earth: { ...initialState.earth, humanFlag: false, spaceFlag: true } }
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(createPlayer(fakePlay), fakeDispatch, stalledState, [], { ticksPerGeneration: 2 })

    expect(fakePlay).not.toHaveBeenCalled()
    expect(fakeDispatch).not.toHaveBeenCalled()
  })
})

describe('createRunner', () => {
  it('asks the agent to rewrite notes at the end of the generation', async () => {
    const initialState = createInitialGameState()
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeNotesAgent = vi.fn<NotesAgent>().mockResolvedValue({ importantUnlocks: [], surprisesAndUpdates: [], watchouts: [], strategicNarrative: 'win plz' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    const runGeneration = createRunner(createPlayer(fakePlay), fakeNotesAgent, fakeDispatch, { ticksPerGeneration: 2 })
    const result = await runGeneration(initialState, [])

    expect(result.notes).toEqual({ importantUnlocks: [], surprisesAndUpdates: [], watchouts: [], strategicNarrative: 'win plz' })
    expect(fakeNotesAgent).toHaveBeenCalledWith(
      [],
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

function createPlayer(play: Player['play']) {
  return () => ({ play })
}
