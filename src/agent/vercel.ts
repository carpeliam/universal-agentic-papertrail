import { generateText, LanguageModel, Output } from "ai"
import { agentResponseSchema, strategicNotesSchema, type AgentPrompt, type AgentResponse, type AgentType, type StrategicNotes, type TickInteraction } from "@/types"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"


type LLMAgentModel = Exclude<AgentType, 'fake'>

const models: Record<LLMAgentModel, LanguageModel> = {
  haiku: anthropic('claude-haiku-4-5'),
  sonnet: anthropic('claude-sonnet-4-6'),
  opus: anthropic('claude-opus-4-7'),
  gpt: openai('gpt-5'),
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

function createMaker(model: LanguageModel) {
  return async function maker(prompt: AgentPrompt): Promise<AgentResponse> {
    const { state, actions, priorNotes } = prompt
    const intro = (priorNotes)
        ? (priorNotes.length) ? firstTickNthGenerationPrompt : firstTickFirstGenerationPrompt
        : nthTickPrompt
    const { output } = await generateText({
      model,
      output: Output.object({ schema: agentResponseSchema }),
      prompt: `${intro}\nActions: ${JSON.stringify(actions)}\nState: ${JSON.stringify(state)}`,
    })
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
function createSummarize(model: LanguageModel) {
  return async function summarize(priorNotes: StrategicNotes[], transcript: TickInteraction[]): Promise<StrategicNotes> {
    const prompt = `${summarizePrompt}\n\nPrior notes:\n${JSON.stringify(priorNotes)}\n\nTranscript:\n${JSON.stringify(transcript)}`
    const { output } = await generateText({
      model,
      output: Output.object({ schema: strategicNotesSchema }),
      prompt,
    })
    console.log(JSON.stringify(output))
    return output
  }
}

export default function createAiAgent(model: LLMAgentModel) {
  const maker = createMaker(models[model])
  const summarize = createSummarize(models[model])
  return { maker, summarize }
}
