import { existsSync } from 'node:fs'
import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises'
import { WebSocketServer } from 'ws'
import { createInitialGameState, formatNumber, type GameState } from 'paperclips-remake'
import parseCLI from './cli'
import { createRunner } from './generation'
import { isGameOver, metrics } from './metrics'
import createAgent from './agent'
import createDispatch from './dispatch'
import type { StrategicNotes } from './types'

const STATE_FILE = 'data/state.json'
const NOTES_FILE = 'data/notes.jsonl'
const METRICS_FILE = 'data/metrics.json'


async function execute() {
  const { waitForClient, reset, ...agentOptions } = parseCLI()
  const { maker, summarize } = createAgent(agentOptions)
  if (reset) {
    await Promise.allSettled([unlink(STATE_FILE), unlink(NOTES_FILE), unlink(METRICS_FILE)])
  }
  let gameState = (await loadState()) ?? createInitialGameState()
  const priorNotes = await loadNotes()

  const wss = createWebSocketServer()
  process.once('SIGINT', () => { wss.close() })
  const dispatch = createDispatch({ wss })
  const runner = createRunner(maker, summarize, dispatch)

  if (waitForClient) {
    console.log('waiting for client connection ...')
    await wss.waitForConnection()
    console.log('connection established.')
  }

  while (!isGameOver(gameState)) {
    const { state, notes } = await runner(gameState, priorNotes)
    gameState = state
    priorNotes.push(notes)
    if (priorNotes.length > 3) priorNotes.shift()
    await saveState(state)
    await appendNotes(notes)
  }
  await logMetricsIfPresent()
  wss.close()
}

execute()

async function loadState(): Promise<GameState | null> {
  if (!existsSync(STATE_FILE)) return null
  const raw = await readFile(STATE_FILE, 'utf-8')
  return JSON.parse(raw) as GameState
}

async function loadNotes(): Promise<StrategicNotes[]> {
  if (!existsSync(NOTES_FILE)) return []
  const lines = (await readFile(NOTES_FILE, 'utf-8'))
    .split('\n')
    .filter(line => line.trim())
  return lines.slice(-3).map(line => JSON.parse(line)) as StrategicNotes[]
}

async function saveState(state: GameState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state))
}

async function appendNotes(notes: StrategicNotes): Promise<void> {
  await appendFile(NOTES_FILE, JSON.stringify(notes) + '\n')
}

function createWebSocketServer() {
  const wss = new WebSocketServer({ port: 8080 })

  wss.on('connection', (ws) => {
    console.log(new Date(), `client connected, total: ${wss.clients.size}`)
    ws.on('close', () => {
      console.log(new Date(), `client disconnected, total: ${wss.clients.size}`)
    })
    ws.on('error', (err) => console.error(new Date(), 'ws client error:', err))
  })

  return {
    broadcast(state: GameState) {
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          try {
            client.send(JSON.stringify(state))
          } catch (err) {
            console.error('send failed:', err)
          }
        }
      })
    },
    async waitForConnection() { await new Promise<void>(resolve => wss.once('connection', resolve)) },
    close() {
      wss.clients.forEach(client => client.terminate())
      wss.close()
    }
  }
}

async function logMetricsIfPresent() {
  const results = await metrics()
  if (results) {
    const y = '\x1b[33m', r = '\x1b[0m'
    console.log('Status'.padEnd(15), y, results.status, r)
    console.log('Wall clock time'.padEnd(15), y, formatDuration(results.wallClockMs), r)
    console.log('In-game time'.padEnd(15), y, formatDuration(results.gameElapsedMs), r)
    console.log('Clip count'.padEnd(15), y, formatNumber(results.clipCount), r)
    console.log('Tick count'.padEnd(15), y, formatNumber(results.tickCount), r)
  }
}

function formatDuration(ms: number) {
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)

  const pad = (n: number) => String(n).padStart(2, '0')

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
}
