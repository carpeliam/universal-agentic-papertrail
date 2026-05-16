import { existsSync } from 'node:fs'
import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises'
import { WebSocketServer } from 'ws'
import { createInitialGameState, type GameState } from 'paperclips-remake'
import parseCLI from './cli'
import { createRunner } from './generation'
import { isGameOver } from './agent-adapter'
import createAgent from './agent'
import createDispatch from './dispatch'
import type { StrategicNotes } from './types'

const STATE_FILE = 'data/state.json'
const NOTES_FILE = 'data/notes.jsonl'


async function execute() {
  const { waitForClient, reset, ...agentOptions } = parseCLI()
  const { maker, summarize } = createAgent(agentOptions)
  let gameState = (await loadState(reset)) ?? createInitialGameState()
  const priorNotes = await loadNotes(reset)

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
  wss.close()
}

execute()

async function loadState(reset: boolean): Promise<GameState | null> {
  if (!existsSync(STATE_FILE)) return null
  if (reset) {
    await unlink(STATE_FILE)
    return null
  }
  const raw = await readFile(STATE_FILE, 'utf-8')
  return JSON.parse(raw) as GameState
}

async function loadNotes(reset: boolean): Promise<StrategicNotes[]> {
  if (!existsSync(NOTES_FILE)) return []
  if (reset) {
    await unlink(NOTES_FILE)
    return []
  }
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
    close() { wss.close() }
  }
}
