import { reduceGameState, type GameAction, type GameState } from "paperclips-remake"

export type DispatchFn = (state: GameState, action: GameAction) => Promise<GameState>
type DispatchOptions = { wss: { broadcast: (action: GameState) => void }}
export default function createDispatch({ wss: { broadcast }}: DispatchOptions): DispatchFn {
  return async (state: GameState, action: GameAction) => {
    const newState = reduceGameState(state, action)
    broadcast(newState)
    return newState
  }
}
