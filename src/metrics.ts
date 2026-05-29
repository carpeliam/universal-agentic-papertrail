import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { RunResults } from "./generation"
import { GameState, getStallState } from "paperclips-remake"

const DATA_DIR = "data"
const METRICS_JSON = path.join(DATA_DIR, 'metrics.json')

export interface Metrics {
  wallClockMs: number
  gameElapsedMs: number
  clipCount: number
  tickCount: number
  status: 'active' | 'complete' | 'stalled'
}



export async function capture(run: () => Promise<RunResults>): Promise<RunResults> {
  const start = performance.now()
  const results = await run()
  const wallClockMs = performance.now() - start
  const metrics: Metrics = {
    wallClockMs,
    gameElapsedMs: results.state.elapsedMs,
    clipCount: results.state.production.clips,
    tickCount: results.transcript.length,
    status: status(results.state),
  }
  await log(metrics)
  return results
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

export async function metrics(): Promise<Metrics | undefined> {
  try {
    const priorMetrics = await readFile(METRICS_JSON, 'utf8')
    if (priorMetrics) {
      return JSON.parse(priorMetrics) as Metrics
    }
  } catch { }
}

async function log(data: Metrics): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const priorMetrics = await metrics()
  const savedData: Metrics = priorMetrics
    ? {
      wallClockMs: data.wallClockMs + priorMetrics.wallClockMs,
      gameElapsedMs: data.gameElapsedMs,
      clipCount: data.clipCount,
      tickCount: data.tickCount + priorMetrics.tickCount,
      status: data.status,
    }
    : data
  await writeFile(METRICS_JSON, JSON.stringify(savedData), 'utf8')
}
