import { expect, it, vi } from "vitest"
import { createInitialGameState, reduceGameState, type GameAction } from "paperclips-remake"
import createDispatch from "@/dispatch"

it('returns the state after applying the action', async () => {
  const dispatch = createDispatch({ wss: { broadcast: vi.fn() }})
  const initialState = createInitialGameState()
  const action: GameAction = { type: 'makeClip' }
  const nextState = await dispatch(initialState, action)
  expect(nextState).toEqual(reduceGameState(initialState, action))
})

it('broadcasts the new state to the websocket server', async () => {
  const broadcast = vi.fn()
  const dispatch = createDispatch({ wss: { broadcast } })
  const initialState = createInitialGameState()
  const action: GameAction = { type: 'tick', deltaMs: 1000 }
  await dispatch(initialState, action)
  expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({
    elapsedMs: 1000
  }))
})
