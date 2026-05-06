import { reduceGameState, type GameAction, type GameState } from "paperclips-remake";

export type DispatchFn = (state: GameState, action: GameAction) => Promise<GameState>
type DispatchOptions = { wss: { broadcast: (action: GameAction) => Promise<void> }}
export default function createDispatch({ wss: { broadcast }}: DispatchOptions): DispatchFn {
  return async (state: GameState, action: GameAction) => {
    await broadcast(action)
    return reduceGameState(state, action)
  }
}
