import { APICallError, generateText, NoObjectGeneratedError, Output, type FlexibleSchema, type LanguageModel } from "ai"
import { z } from "zod"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"
import { createOllama } from 'ollama-ai-provider-v2'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { agentResponseSchema, strategicNotesSchema, type LLMAgentOptions, type LLMAgentSpec, type AgentPrompt, type AgentResponse, type StrategicNotes, type TickInteraction } from "@/types"

const ollama = createOllama()

function languageModelFor(agentSpec: LLMAgentSpec) {
  if ('OPENROUTER_API_KEY' in process.env) {
    return openrouter(`${agentSpec.provider}/${agentSpec.model}`)
  }
  switch (agentSpec.provider) {
    case 'anthropic':
      return anthropic(agentSpec.model)
    case 'openai':
      return openai(agentSpec.model)
    case 'google':
      return google(agentSpec.model)
    case 'ollama':
      return ollama(agentSpec.model)
    default:
      throw Error(`Unknown provider "${agentSpec.provider}"`)
  }
}

function createLogger(shouldLog: boolean) {
  return function log(...messages: any[]) {
    if (shouldLog) console.log(new Date(), ...messages)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function is504(err: APICallError): boolean {
  return typeof err.data === 'object' && err.data !== null && 'code' in err.data && (err.data as { code: unknown }).code === 504
}

async function submit<T extends FlexibleSchema>(model: LanguageModel, schema: T, text: string, log: (...messages: any[]) => void): Promise<z.infer<T>> {
  const maxAttempts = 3
  const attempt = async (prompt: string) => {
    const { output } = await generateText({ model, output: Output.object({ schema }), prompt })
    return output
  }
  let prompt = text

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt(prompt)
    } catch (err) {
      console.warn(err)
      if (i === maxAttempts - 1) {
        throw err
      }
      if (APICallError.isInstance(err) && is504(err)) {
        await delay(125 * Math.pow(2, 2 * i))
        continue
      }
      if (NoObjectGeneratedError.isInstance(err) && err.cause instanceof Error) {
        prompt = `Your previous response did not match the required schema. Error: ${err.cause.message}\n\nPlease try again, paying close attention to required fields. For example, the "wait" action requires a "turns" field (integer between 1 and 30).\n${text}`
        log('schema validation failed, retrying:', err.cause)
        continue
      }
      throw err
    }
  }
  throw new Error('unreachable')
}

const actionInstructions = `\
Choose one action from the available actions and explain your reasoning. \
Unavailable actions are your horizon — reachable goals, and between the current \
state and the actions themselves you should be able to see what's standing \
between you and them.`

const firstTickFirstGenerationPrompt = `\
You're starting fresh with no prior context — that's expected, not a problem. Your objectives are yours \
to discover. Lean into action; you'll learn more from doing than from deliberating. Make your best \
guess and update as you go. ${actionInstructions}`
const firstTickNthGenerationPrompt = `\
You're on a bit of an adventure, picking up where someone else left off. Not to worry, they left you \
notes — treat them like cliff notes for everything that happened before you arrived. Read them to orient \
yourself, but trust the current state over the notes; things may have moved on since they were written. ${actionInstructions}`
const nthTickPrompt = `Take a look at what changed. Did your last action have the effect you expected? \
  Update your thinking if not, then choose your next action and explain your reasoning.`

function createMaker(model: LanguageModel, logTicks: boolean) {
  const log = createLogger(logTicks)
  return async function maker(prompt: AgentPrompt): Promise<AgentResponse> {
    const { state, actions, priorNotes } = prompt
    const intro = (priorNotes)
        ? (priorNotes.length) ? firstTickNthGenerationPrompt : firstTickFirstGenerationPrompt
        : nthTickPrompt
    log('prompting with available actions:', JSON.stringify(actions.available))
    const output = await submit(model, agentResponseSchema, `${intro}\nActions: ${JSON.stringify(actions)}\nState: ${JSON.stringify(state)}`, log)
    log(JSON.stringify(output))
    return output
  }
}

const summarizePrompt = `\
You are maintaining a rolling set of strategic notes for an agent discovering a world across multiple sessions. You will receive:
- An array of up to 3 prior note sets (oldest first)
- A transcript of the most recent session, including the decisions they made, their reasoning, and the state as it evolved
The oldest note set is about to be dropped. If it contains anything not already captured in the \
newer notes or the transcript — hard-won lessons, persistent risks, important context — you might choose to carry it forward \
if you think it might bear on future decisions. Otherwise let it go.
Your job is to produce a single updated note set that gives the next agent the clearest possible \
picture of: what has been discovered, what has been tried, what to watch out for, and what the \
current strategic situation is.
Write in a clear, declarative voice. The next agent needs stable ground truth, not a reconstruction of how it felt to be in \
the moment. You are their memory; be faithful.
Be selective. The next agent will act on these notes — clarity and signal matter more than completeness.`
function createSummarize(model: LanguageModel, logSummaries: boolean) {
  const log = createLogger(logSummaries)
  return async function summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes> {
    const prompt = `${summarizePrompt}\n\nPrior notes:\n${JSON.stringify(priorNotes)}\n\nTranscript:\n${JSON.stringify(transcript)}`
    log('summarizing')
    const output = await submit(model, strategicNotesSchema, prompt, log)
    log(JSON.stringify(output))
    return output
  }
}

export default function createAiAgent(options: LLMAgentOptions) {
  const logTicks = options.verbosity > 1
  const logSummaries = options.verbosity > 0
  const maker = createMaker(languageModelFor(options.agent), logTicks)
  const summarize = createSummarize(languageModelFor(options.summarizer), logSummaries)
  return { maker, summarize }
}
