import { existsSync } from 'node:fs'
import { readFile, writeFile, appendFile } from 'node:fs/promises'
import { WebSocketServer } from 'ws'
import { createInitialGameState, type GameAction, type GameState } from 'paperclips-remake'
import { createRunner } from './generation'
import { isGameOver } from './agent-adapter'
import createAgent from './agent'
import createDispatch from './dispatch'
import { StrategicNotes } from './types'

const STATE_FILE = 'data/state.json'
const NOTES_FILE = 'data/notes.jsonl'


async function execute() {
  const { agent: agentName, waitForClient } = parseArgs(process.argv)
  const { maker, summarize } = createAgent(agentName)
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
    await saveNotes(notes)
  }
  wss.close()
}

execute()

function parseArgs(argv: string[]): { agent: string, waitForClient: boolean } {
  const agentIndex = argv.indexOf('--agent')
  return {
    agent: agentIndex !== -1 ? argv[agentIndex + 1] : 'sonnet',
    waitForClient: argv.includes('--wait'),
  }
}

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

async function saveNotes(notes: StrategicNotes): Promise<void> {
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
      return new Promise<void>((resolve) => {
        wss.clients.forEach(client => {
          if (client.readyState === client.OPEN) {
            try {
              client.send(JSON.stringify(state))
            } catch (err) {
              console.error('send failed:', err)
            }
          }
        })
        resolve()
      })
    },
    async waitForConnection() { await new Promise<void>(resolve => wss.once('connection', resolve)) },
    close() { wss.close() }
  }
}
