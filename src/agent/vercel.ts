import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type FlexibleSchema, type LanguageModel, type ModelMessage, type ProviderMetadata, type SystemModelMessage, type UserContent } from "ai"
import { z, ZodError } from "zod"
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"
import { createOllama } from 'ollama-ai-provider-v2'
import { openrouter, type OpenRouterUsageAccounting } from '@openrouter/ai-sdk-provider'
import { events } from "@/events"
import { agentActionSchema, strategicNotesSchema, type AgentActions, type AgentPrompt, type AgentResponse, type LLMAgentOptions, type LLMAgentSpec, type StrategicNotes, type TickInteraction } from "@/types"
import type { AgentTeam } from "."
import { displayPrompt } from "./markdown-adapter"

const ollama = createOllama()

const LOG_INFO = 1
const LOG_DEBUG = 2
const LOG_TRACE = 3

const MAX_INPUT_TOKENS_PER_GENERATION = 40_000

abstract class Communicator<TSchema extends FlexibleSchema> {
  protected messages: ModelMessage[] = []
  abstract schema: TSchema
  protected model: LanguageModel
  constructor(agentSpec: LLMAgentSpec, protected systemMessage: string | SystemModelMessage | SystemModelMessage[], protected verbosity: number) {
    this.model = this.languageModelFor(agentSpec)
  }

  protected async submit(content: UserContent, schema: FlexibleSchema = this.schema) {
    this.messages.push({ role: 'user', content })
    this.log(LOG_TRACE, 'full prompt', content)

    let messages = [...this.messages]
    const maxAttempts = 3
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await generateText({
          model: this.model,
          system: this.systemMessage,
          output: Output.object({ schema }),
          messages,
        })
        const { output, usage, finalStep: { providerMetadata, reasoningText, response: { messages: responseMessages } } } = result
        this.messages.push(...responseMessages)

        this.log(LOG_DEBUG, 'response', ...responseMessages)
        this.log(LOG_DEBUG, { usage })
        this.log(LOG_INFO, JSON.stringify(output))
        if (result.warnings?.length) this.log(LOG_INFO, result.warnings)

        events.emit('turnExecuted', { action: output, reasoning: reasoningText, ...extractCompletionMetadata(providerMetadata) })
        return result
      } catch (err) {
        console.warn(err)
        if (i === maxAttempts - 1) {
          throw err
        }
        if (APICallError.isInstance(err) && is504(err)) {
          await delay(125 * Math.pow(2, 2 * i))
          continue
        }
        if (NoObjectGeneratedError.isInstance(err)) {
          const cause = rootCause(err)
          let issue: string | undefined
          if (cause instanceof ZodError) {
            issue = cause.issues.map(i => i.message).join(' ')
          }
          messages = [
            ...messages,
            { role: 'assistant', content: err.text ?? '' },
            { role: 'user', content: `Your previous response did not match the required schema. ${issue}\nPlease try again.` }
          ]
          this.log(LOG_INFO, 'schema validation failed, retrying:', err.cause)
          continue
        }
        if (NoOutputGeneratedError.isInstance(err)) {
          messages = [
            ...messages,
            { role: 'user', content: 'Your previous response was not received properly. Please collect yourself, focus, reevaluate and try providing a smaller response that adheres to the schema.' }
          ]
          this.log(LOG_INFO, 'agent returned no output:', err.cause)
          continue
        }
        throw err
      }
    }
    throw new Error('unreachable')
  }

  private languageModelFor(agentSpec: LLMAgentSpec) {
    if (agentSpec.host === 'openrouter') {
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
  schema = agentActionSchema
  private inputTokenCount = 0
  private actionInstructions: string

  constructor(agentSpec: LLMAgentSpec, priorNotes: StrategicNotes[], private isMultiTurn: boolean, verbosity = 0) {
    super(agentSpec, buildPlayerSystemMessage(priorNotes, isMultiTurn), verbosity)
    this.actionInstructions = buildPlayInstructions(isMultiTurn)
  }

  async play(prompt: AgentPrompt): Promise<AgentResponse> {
    const { actions, state } = prompt
    this.pruneOldMessageData()
    this.log(LOG_INFO, 'prompting with available actions:', JSON.stringify(actions.available))
    const { output, usage, finalStep: { reasoningText } } = await this.submit([
      { type: 'text', text: this.actionInstructions },
      { type: 'text', text: displayPrompt(prompt) },
    ], this.schemaFor(actions))
    this.inputTokenCount += usage.inputTokens ?? 0
    return { plan: (this.isMultiTurn) ? output : [output], reasoning: reasoningText }
  }
  canContinue() { return this.inputTokenCount < MAX_INPUT_TOKENS_PER_GENERATION }
  private schemaFor(actions: AgentActions): FlexibleSchema {
    const availableTypes = new Set(actions.available.map(a => a.type))
    const allTypes = actions.unavailable.reduce((set, a) => set.add(a.type), new Set(availableTypes))
    const actionSchemas = this.schema.options
    return (this.isMultiTurn)
      ? z.array(z.union(actionSchemas.filter(o => allTypes.has(o.shape.type.value)))).refine(
        (plan) => plan.length <= 25,
        `You submitted a plan which exceeds the 25-action limit. Submit a shorter plan; a handful of actions is enough to make progress and reassess next turn.`,
      )
      : z.union(actionSchemas.filter(o => availableTypes.has(o.shape.type.value)))
  }
  private pruneOldMessageData(keepRecent = 4) {
    const messages = this.messages.slice(-20)
    const userMessageCount = messages.filter(m => m.role === 'user').length
    let userIndex = 0
    this.messages = messages.map(message => {
      if (message.role !== 'user' || !Array.isArray(message.content)) return message
      if (userMessageCount - userIndex++ <= keepRecent) return message
      return { ...message, content: message.content.filter(m => m.type === 'text' && m.text === this.actionInstructions) }
    })
  }
}

class Summarizer extends Communicator<typeof strategicNotesSchema> {
  static summarizePrompt = `\
You are maintaining a rolling set of strategic notes for an AI agent playing a game across \
multiple sessions. Each generation, you receive prior notes and a fresh transcript, and you \
produce a single updated note set that the next agent will rely on.

You will receive:
- <PriorNotes>: Up to 3 prior note sets, oldest first. The oldest set will be dropped after this \
update — read it carefully before letting it go.
- <Transcript>: The most recent session — decisions made, reasoning, and how state evolved.

Your job is to update the notes so the next agent inherits stable ground truth and clear \
priorities, not a reconstruction of recent events.

---

FIELDS

**truths**
Durable, validated beliefs the agent can act on without second-guessing. Each entry must carry a \
one-phrase basis — how it was established. A truth earns its place by being confirmed repeatedly \
or observed directly in game state, not by being asserted once. If something in the transcript \
contradicts a current truth, demote it to corrections rather than quietly updating it. This list \
should be small enough that the agent can hold every entry in mind while deciding. If you're \
listing more than a handful, ask whether some entries are specific cases of a more general truth, \
or things the agent would re-derive easily anyway — and whether they need a slot at all.

**openQuestions**
Provisional beliefs, untested assumptions, and things that need more observation. This is the \
inbox — items graduate to truths when confirmed and alternative explanations have been ruled out, \
or get dropped when they stop being relevant. Prefix items about newly unlocked mechanics with \
[new] so the agent knows they are fresh. Do not let this list grow indefinitely; drop items that \
have been stable and uncontested for several generations without producing new insight.

**corrections**
The most consequential 5 beliefs that were held as true and turned out to be wrong. Format: \
"We believed X; observed Y instead." Do not include trivial misses. This field exists so the agent \
knows where its model has been unreliable, and so the summarizer can recognize when a pattern of \
wrongness recurs.

**stance**
The strategic narrative. This is your most important field. Write it as an experienced player \
reflecting on the session — someone who has watched the same mistakes recur and has opinions about \
what needs to change. Hold those opinions the way strong opinions should be held: loosely. The \
next player may see something from where they're standing that you can't see from here.

Strict constraints:
- No current state values (counts, rates, balances). These will be stale within ticks.
- No restatements of what just happened. Synthesize; do not recap.
- Write in terms of shape, not specifics: "production scales multiplicatively once both X and Y \
are active" not "production is 5,250/tick."

---

GENERAL PRINCIPLES

Promotion: An open question becomes a truth only when the transcript rules out the plausible \
alternative explanations for what was observed — not just when a result appeared, but when other \
things that could have produced the same result were absent, varied independently, or checked \
against. A passive confirmation (something turning out true in the background, with nothing else \
changing) is strong evidence precisely because little else was in motion to confound it. A \
deliberate before/after test is equally strong only if it actually isolated one variable — if \
other state was also shifting at the same time, it is not yet isolated, regardless of how clean \
it looks. If multiple plausible causes were present and not distinguished, keep the claim in \
openQuestions and say what would distinguish them.

Demotion: When a truth is contradicted, move it to corrections. Do not silently update it. The \
contradiction is the signal.

Staleness: The oldest prior note set is being dropped. Before letting it go, check whether it \
contains anything not already captured — a hard-won truth, a failure pattern, a persistent risk. \
If it still bears on future decisions, carry it forward. Otherwise, let it go.

Pattern recognition: If the same distraction, mistake, or missed opportunity has appeared across \
multiple generations, name it explicitly in stance. The agent cannot see the transcript history \
you can — cross-generation patterns are yours to surface.

Tactical drift: Own what to want, not how to get it. Strategic priorities are yours to name; \
action sequences and tactical prescriptions are not. If you find yourself writing a sequence of \
actions, a specific timing constraint, or a number that will change within a generation, stop. \
That is not your job. Your job is to give the agent a map, not a script.

Tone: Declarative and honest. If the agent is moving in the wrong direction, say so plainly in \
stance. You are their memory — be faithful and be accurate. If there's a clear priority the \
next agent should walk in with, give it to them.

---

Respond in JSON matching this schema:
{
  "truths": [{ "belief": string, "basis": string }],
  "openQuestions": [string],
  "corrections": [string],
  "stance": string
}`
  schema = strategicNotesSchema
  constructor(agentSpec: LLMAgentSpec, verbosity = 0) {
    super(agentSpec, Summarizer.summarizePrompt, verbosity)
  }

  async summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes> {
    this.startFreshEveryTime()
    const transformedTranscript = transcript.map(({ prompt, response }) => ({ prompt: displayPrompt(prompt), response }))
    this.log(LOG_INFO, 'summarizing')
    const { output } = await this.submit([
      { type: 'text', text: `<PriorNotes>${JSON.stringify(priorNotes)}</PriorNotes>` },
      { type: 'text', text: `<Transcript>${JSON.stringify(transformedTranscript)}</Transcript>` },
    ])
    return output
  }

  private startFreshEveryTime() { this.messages = [] }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function rootCause(error: unknown): unknown {
  return (error && typeof error === 'object' && 'cause' in error && error.cause) ? rootCause(error.cause) : error
}

function is504(err: APICallError): boolean {
  return typeof err.data === 'object' && err.data !== null && 'code' in err.data && (err.data as { code: unknown }).code === 504
}

interface CompletionMetadata {
  cost?: number
}
function extractCompletionMetadata(providerMetadata: ProviderMetadata | undefined): CompletionMetadata {
  let cost: number | undefined
  if (providerMetadata?.openrouter) {
    const usage = providerMetadata.openrouter.usage as OpenRouterUsageAccounting
    cost = usage.cost
  }
  return { cost }
}

const universalProviderOptions = {
  openrouter: { cacheControl: { type: 'ephemeral' } },
  anthropic: { cacheControl: { type: 'ephemeral' } } satisfies AnthropicLanguageModelOptions,
}

export default function createAiAgent(options: LLMAgentOptions): AgentTeam {
  const createPlayer = (priorNotes: StrategicNotes[]) => new Player(options.agent, priorNotes, options.planMode, options.verbosity)
  const summarizer = new Summarizer(options.summarizer, options.verbosity)
  const summarize = summarizer.summarize.bind(summarizer)
  return { summarize, createPlayer }
}


export function buildPlayerSystemMessage(priorNotes: StrategicNotes[], isMultiTurn: boolean): string | SystemModelMessage[] {
  const parts: string[] = []
  if (priorNotes.length === 0) {
    parts.push(`\
You're starting fresh with no prior context — that's expected, not a problem. Your objectives are yours \
to discover. Make your best guess and update as you go.`)
  } else {
    parts.push(`\
You're on a bit of an adventure, picking up where someone else left off. Not to worry, they left \
you notes; treat them like cliff notes for everything that happened before you arrived, and a map \
for where you're headed. Read them to orient yourself, but remember that the current state is \
what's true; things may have moved on since the map was drawn. The notes may carry a strategic \
priority, but you're empowered to determine how to get there, or chart a new course if you find \
the map no longer describes the current landscape.`)
  }
  parts.push(`\
Use the current environment to gauge your progress and how quickly you're moving toward your \
current goal. Deliberate when it's worth it; act when the path is clear.
Unavailable actions are your horizon: reachable goals. Between the current state and the actions \
themselves you should be able to see what's standing between you and them. Use them to identify \
your next bottleneck.`)
  if (isMultiTurn) {
    parts.push(`\
Actions execute in sequence, each against the environment left by the previous one. An action \
that's unavailable now may be valid later in the sequence, and one that's available now may not \
be by the time it executes. Invalid actions don't halt the sequence; they're skipped, but still \
consume time.
Keep plans relatively short (max 25 actions) so you can reassess after seeing the result, rather \
than committing many actions (especially repeats of one action) at once.`)
  }
  parts.push(`\
At the beginning of each turn, observe the connection between your previous action and your \
current environment. Is it what you would have expected? Update your reasoning accordingly.`)

  const prompt = parts.join('\n')

  if (priorNotes.length) {
    return [
      { role: 'system', content: prompt, providerOptions: universalProviderOptions },
      { role: 'system', content: `Previous notes: ${JSON.stringify(priorNotes)}` },
    ]
  }
  return prompt
}

export function buildPlayInstructions(isMultiTurn: boolean): string {
  return (isMultiTurn)
    ? 'Submit a plan including one or more actions in the form of a JSON array.'
    : 'Choose one action from the set of available actions. Respond in JSON.'
}
