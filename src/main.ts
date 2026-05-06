import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { WebSocketServer } from 'ws'
import { createInitialGameState, type GameAction, type GameState } from 'paperclips-remake'
import { createRunner } from './generation'
import { isGameOver } from './agent-adapter'
import createAgent from './agent'
import createDispatch from './dispatch'

async function execute() {
  const agentName = process.argv[process.argv.indexOf('--agent') + 1] ?? 'sonnet'
  const { maker, summarize } = createAgent(agentName)
  let state = (await loadState()) ?? createInitialGameState()
  let notes = await loadNotes()

  const wss = createWebSocketServer()
  process.once('SIGINT', () => { wss.close() })
  const dispatch = createDispatch({ wss })
  const runner = createRunner(maker, summarize, dispatch)

  while (!isGameOver(state)) {
    ({ state, notes } = await runner(state, notes))
    await saveState(state)
    await saveNotes(notes)
  }
  wss.close()
}

execute()


const STATE_FILE = 'data/state.json'
const NOTES_FILE = 'data/notes.md'

async function loadState(): Promise<GameState | null> {
  if (!existsSync(STATE_FILE)) return null
  const raw = await readFile(STATE_FILE, 'utf-8')
  return JSON.parse(raw) as GameState
}

async function loadNotes(): Promise<string> {
  if (!existsSync(NOTES_FILE)) return ''
  return readFile(NOTES_FILE, 'utf-8')
}

async function saveState(state: GameState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state))
}

async function saveNotes(notes: string): Promise<void> {
  await writeFile(NOTES_FILE, notes)
}

function createWebSocketServer() {
  const wss = new WebSocketServer({ port: 8080 })
  return {
    broadcast(action: GameAction) {
      return new Promise<void>((resolve) => {
        wss.clients.forEach(client => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(action))
          }
        })
        resolve()
      })
    },
    close() { wss.close() }
  }
}
