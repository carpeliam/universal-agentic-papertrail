import { EventEmitter } from 'node:events'
import type { RunResults } from './generation'
import type { AgentOptions } from './types'

type GameEvents = {
  agentStarted: AgentOptions
  generationCompleted: RunResults
}
type EventKey = keyof GameEvents

class AgentEventEmitter {
  private eventEmitter: EventEmitter = new EventEmitter()

  emit<K extends EventKey>(event: K, payload: GameEvents[K]): void {
    this.eventEmitter.emit(event, payload)
  }

  on<K extends EventKey>(event: K, listener: (payload: GameEvents[K]) => void): void {
    this.eventEmitter.on(event, listener)
  }

  off<K extends EventKey>(event: K, listener: (payload: GameEvents[K]) => void): void {
    this.eventEmitter.off(event, listener)
  }

  reset(): void {
    this.eventEmitter.removeAllListeners()
  }
}

export const events = new AgentEventEmitter()
