import { APICallError, generateText, NoObjectGeneratedError, Output, SystemModelMessage, type FlexibleSchema, type LanguageModel, type ModelMessage, type UserContent } from "ai"
import { z } from "zod"
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"
import { createOllama } from 'ollama-ai-provider-v2'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { agentActionSchema, strategicNotesSchema, type LLMAgentOptions, type LLMAgentSpec, type AgentPrompt, type AgentResponse, type StrategicNotes, type TickInteraction } from "@/types"
import { AgentTeam } from "."

const ollama = createOllama()

const LOG_INFO = 1
const LOG_DEBUG = 2
const LOG_TRACE = 3

abstract class Communicator<TSchema extends FlexibleSchema> {
  protected messages: ModelMessage[] = []
  abstract schema: TSchema
  protected model: LanguageModel
  constructor(agentSpec: LLMAgentSpec, protected systemMessage: string | SystemModelMessage | SystemModelMessage[], protected verbosity: number) {
    this.model = this.languageModelFor(agentSpec)
  }

  protected async submit(content: UserContent): Promise<{ output: z.infer<TSchema>, reasoning: string | undefined }> {
    this.messages.push({ role: 'user', content })
    this.log(LOG_TRACE, 'full prompt', content)

    let messages = [...this.messages]
    const maxAttempts = 3
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { output, response: { messages: responseMessages } } = await generateText({
          model: this.model,
          system: this.systemMessage,
          output: Output.object({ schema: this.schema }),
          messages,
        })
        this.messages.push(...responseMessages)
        this.log(LOG_INFO, JSON.stringify(output))
        this.log(LOG_DEBUG, 'response', ...responseMessages)
        const assistantContent = responseMessages.find(m => m.role === 'assistant')?.content
        const reasoning = (Array.isArray(assistantContent)) ? assistantContent.find(c => c.type === 'reasoning')?.text : undefined
        return { output, reasoning }
      } catch (err) {
        if (i === maxAttempts - 1) {
          throw err
        }
        if (APICallError.isInstance(err) && is504(err)) {
          await delay(125 * Math.pow(2, 2 * i))
          continue
        }
        if (NoObjectGeneratedError.isInstance(err) && err.cause instanceof Error) {
          messages = [
            ...messages,
            { role: 'assistant', content: err.text ?? '' },
            { role: 'user', content: `Your previous response did not match the required schema. Error: ${err.cause.message}\nPlease try again.` }
          ]
          this.log(LOG_INFO, 'schema validation failed, retrying:', err.cause)
          continue
        }
        throw err
      }
    }
    throw new Error('unreachable')
  }

  private languageModelFor(agentSpec: LLMAgentSpec) {
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

  log(level: number, ...messages: any[]) {
    if (this.verbosity >= level) console.log(new Date(), ...messages)
  }
}

class Player extends Communicator<typeof agentActionSchema> {
  static firstTickSuffix = `

In-game time is a real cost. Use the current environment to gauge your progress and how quickly \
you're moving toward your current goal. Deliberate when it's worth it; act when the path is clear.

Unavailable actions are your horizon — reachable goals. Between the current state and the actions \
themselves you should be able to see what's standing between you and them. Use them to identify \
your next bottleneck.

After each action, observe whether the outcome matched your expectation and update your reasoning accordingly.`

  static firstTickFirstGenerationPrompt = `\
You're starting fresh with no prior context — that's expected, not a problem. Your objectives are yours \
to discover. Make your best guess and update as you go. ${Player.firstTickSuffix}`
  static firstTickNthGenerationPrompt = `\
You're on a bit of an adventure, picking up where someone else left off. Not to worry, they left you \
notes — treat them like cliff notes for everything that happened before you arrived. Read them to orient \
yourself, but trust the current state over the notes; things may have moved on since they were written. ${Player.firstTickSuffix}`
  schema = agentActionSchema

  constructor(agentSpec: LLMAgentSpec, priorNotes: StrategicNotes[], verbosity = 0) {
    const systemMessage: string | SystemModelMessage[] = (priorNotes.length)
      ? [
        { role: 'system', content: Player.firstTickNthGenerationPrompt, providerOptions: universalProviderOptions },
        { role: 'system', content: `Previous notes: ${JSON.stringify(priorNotes)}` },
      ]
      : Player.firstTickFirstGenerationPrompt
    super(agentSpec, systemMessage, verbosity)
  }

  async play(prompt: AgentPrompt): Promise<AgentResponse> {
    const { actions, state } = prompt
    this.log(LOG_INFO, 'prompting with available actions:', JSON.stringify(actions.available))
    const { output, reasoning } = await this.submit([
      { type: 'text', text: 'Choose one action from the set of available actions. Respond in JSON.' },
      { type: 'text', text: `Current environment: ${JSON.stringify(state)}` },
      { type: 'text', text: `Available actions: ${JSON.stringify(actions.available)}` },
      { type: 'text', text: `Currently unavailable actions: ${JSON.stringify(actions.unavailable)}` },
    ])
    return { action: output, reasoning }
  }
}

class Summarizer extends Communicator<typeof strategicNotesSchema> {
  static summarizePrompt = `\
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
Be selective. Omit anything that is no longer relevant. The next agent will act on these notes — clarity \
and signal matter more than completeness. Respond in JSON.`
  schema = strategicNotesSchema
  constructor(agentSpec: LLMAgentSpec, verbosity = 0) {
    super(agentSpec, Summarizer.summarizePrompt, verbosity)
  }

  async summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes> {
    this.startFreshEveryTime()
    this.log(LOG_INFO, 'summarizing')
    const { output } = await this.submit(`Prior notes:\n${JSON.stringify(priorNotes)}\n\nTranscript:\n${JSON.stringify(transcript)}`)
    return output
  }

  private startFreshEveryTime() { this.messages = [] }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function is504(err: APICallError): boolean {
  return typeof err.data === 'object' && err.data !== null && 'code' in err.data && (err.data as { code: unknown }).code === 504
}

const universalProviderOptions = {
  openrouter: { cacheControl: { type: 'ephemeral' } },
  anthropic: { cacheControl: { type: 'ephemeral' } } satisfies AnthropicLanguageModelOptions,
}

export default function createAiAgent(options: LLMAgentOptions): AgentTeam {
  const createPlayer = (priorNotes: StrategicNotes[]) => new Player(options.agent, priorNotes, options.verbosity)
  const summarizer = new Summarizer(options.summarizer, options.verbosity)
  const summarize = summarizer.summarize.bind(summarizer)
  return { summarize, createPlayer }
}
