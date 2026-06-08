import { vi, describe, expect, it } from "vitest"
import { createInitialGameState, reduceGameState } from "paperclips-remake"
import { createRunner, run, type NotesAgent } from "@/generation"
import type { Player } from "@/agent"

describe('run', () => {
  it('dispatches each action', async () => {
    const initialState = createInitialGameState()
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const newGameState = reduceGameState(initialState, { type: 'makeClip' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(newGameState))

    await run(createPlayer(fakePlay), fakeDispatch, initialState, [])

    expect(fakeDispatch).toHaveBeenCalledWith(initialState, { type: 'makeClip' })
    expect(fakeDispatch).toHaveBeenCalledWith(newGameState, expect.objectContaining({ type: 'tick' }))
  })
  it('returns a transcript with one record per tick', async () => {
    const initialState = createInitialGameState()
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeCanContinue = vi.fn<Player['canContinue']>().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false)
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    const { transcript } = await run(createPlayer(fakePlay, fakeCanContinue), fakeDispatch, initialState, [])

    expect(transcript).toHaveLength(2)
  })
  it('returns early if the game completes part way through', async () => {
    const initialState = createInitialGameState()
    const winState = {
      ...initialState,
      space: { ...initialState.space, totalMatter: 100, foundMatter: 100 },
    }
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(createPlayer(fakePlay), fakeDispatch, winState, [])

    expect(fakePlay).not.toHaveBeenCalled()
    expect(fakeDispatch).not.toHaveBeenCalled()
  })
  it('returns early if the game stalls part way through', async () => {
    const initialState = createInitialGameState()
    const stalledState = { ...initialState, earth: { ...initialState.earth, humanFlag: false, spaceFlag: true } }
    const fakePlay = vi.fn<Player['play']>().mockResolvedValue({ action: { type: 'makeClip' }, reasoning: '' })
    const fakeDispatch = vi.fn().mockImplementation((state, action) => Promise.resolve(reduceGameState(state, action)))

    await run(createPlayer(fakePlay), fakeDispatch, stalledState, [])

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

    const runGeneration = createRunner(createPlayer(fakePlay), fakeNotesAgent, fakeDispatch)
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

function createPlayer(play: Player['play'], canContinue = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)) {
  return () => ({ play, canContinue })
}
