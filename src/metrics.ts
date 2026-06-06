import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { getStallState, type GameState } from "paperclips-remake"
import { events } from "./events"

const DATA_DIR = "data"
const METRICS_JSON = path.join(DATA_DIR, 'metrics.json')
const METRICS_JSONL = path.join(DATA_DIR, 'metrics.jsonl')

export interface Metrics {
  agentName: string
  wallClockMs: number
  gameElapsedMs: number
  clipCount: number
  tickCount: number
  status: 'active' | 'complete' | 'stalled'
  cost?: number
}

class MetricsAccumulator {
  private writeQueue: Promise<any> = Promise.resolve()
  private startMs: number
  private currentState: Partial<Metrics>
  constructor(state: Partial<Metrics> | undefined) {
    this.currentState = state || {}
    this.startMs = performance.now() - (state?.wallClockMs ?? 0)
  }
  accumulate(data: Partial<Metrics>) {
    this.currentState = {
      agentName: data.agentName ?? this.currentState.agentName,
      wallClockMs: performance.now() - this.startMs,
      gameElapsedMs: data.gameElapsedMs ?? this.currentState.gameElapsedMs,
      clipCount: data.clipCount ?? this.currentState.clipCount,
      tickCount: (this.currentState.tickCount ?? 0) + (data?.tickCount ?? 0),
      status: data.status ?? this.currentState.status,
      cost: (data.cost) ? data.cost + (this.currentState.cost ?? 0) : this.currentState.cost,
    }
    this.persist()
  }
  get metrics() { return this.currentState }
  async immortalize() {
    await this.writeQueue
    await appendFile(METRICS_JSONL, JSON.stringify({ timestamp: Date.now(), ...this.currentState }) + '\n', 'utf8')
  }
  private persist() {
    this.writeQueue = this.writeQueue
      .then(() => writeFile(METRICS_JSON, JSON.stringify(this.currentState)))
      .catch((e) => console.error('failed to persist metrics', e))
  }
}
let accumulator: MetricsAccumulator | undefined
export async function initMetrics() {
  await mkdir(DATA_DIR, { recursive: true })
  const priorMetrics = await loadMetricsFromFile()

  events.on('agentStarted', (agentOptions) => {
    accumulator = new MetricsAccumulator(priorMetrics)
    const agentName = agentOptions.type === 'llm' ? `${agentOptions.agent.provider}/${agentOptions.agent.model}` : agentOptions.type
    accumulator.accumulate({ agentName })
  })

  events.on('generationCompleted', ({ state, transcript }) => {
    accumulator!.accumulate({
      gameElapsedMs: state.elapsedMs,
      clipCount: state.production.clips,
      tickCount: transcript.length,
      status: status(state),
    })
  })

  events.on('turnExecuted', ({ cost }) => { accumulator!.accumulate({ cost }) })
}

export function status(state: GameState): Metrics['status'] {
  const { foundMatter, totalMatter } = state.space
  if (foundMatter > 0 && totalMatter === foundMatter) {
    return 'complete'
  }
  if (getStallState(state).stalled) {
    return 'stalled'
  }
  return 'active'
}

export function isGameOver(state: GameState) {
  return status(state) !== 'active'
}

export function metrics(): Partial<Metrics> | undefined {
  return accumulator!.metrics
}

export async function immortalizeMetrics() {
  await accumulator!.immortalize()
}

export async function loadMetricsFromFile(): Promise<Metrics | undefined> {
  try {
    const priorMetrics = await readFile(METRICS_JSON, 'utf8')
    if (priorMetrics) {
      return JSON.parse(priorMetrics) as Metrics
    }
  } catch { }
}
