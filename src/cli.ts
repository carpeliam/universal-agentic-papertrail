import { Command, InvalidArgumentError } from 'commander'
import type { LLMAgentSpec, Provider } from './types';

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google', 'ollama']
const ALIASES: Record<string, { provider: Provider; model: string }> = {
  haiku:   { provider: 'anthropic', model: 'claude-haiku-4-5' },
  sonnet:  { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  opus:    { provider: 'anthropic', model: 'claude-opus-4-7' },
  gpt:     { provider: 'openai', model: 'gpt-5' },
  gemini:  { provider: 'google', model: 'gemini-2.5-flash' },
  mistral: { provider: 'ollama',    model: 'mistral' },
}

export type CLIConfig = (
  | { type: 'fake' }
  | { type: 'llm'; agent: LLMAgentSpec; summarizer: LLMAgentSpec }
) & {
  waitForClient: boolean
  reset: boolean
  verbosity: number
}

function isProvider(value: string): value is Provider {
  return PROVIDERS.includes(value as Provider)
}

function parseSpec(value: string): LLMAgentSpec {
  if (value in ALIASES) {
    return { ...ALIASES[value] }
  }

  const [provider, model] = value.split('/', 2)
  if (!model || !isProvider(provider)) {
    throw new InvalidArgumentError(
      `Unknown model "${value}". Use a known alias (${Object.keys(ALIASES).join(', ')}) or provider/model format (e.g. anthropic/claude-opus-4-6, ollama/gemma2:9b).`
    )
  }

  return { provider, model }
}

export default function parseCLI(): CLIConfig {
  const program = new Command('npm start --')
    .option('--agent <spec>', 'Agent to use: fake, an alias (haiku, sonnet, opus, gpt, mistral), or provider/model', 'fake')
    .option('--summarizer <spec>', 'Summarizer to use: an alias or provider/model')
    .option('--wait', 'Wait for a WebSocket client connection before starting', false)
    .option('--reset', 'Clear logs before starting', false)
    .option('-v, --verbose', 'Print the agent\'s thought process to the screen', (_, prev: number) => prev + 1, 0)
    .parse()

  const opts = program.opts<{ agent: string, summarizer?: string, wait: boolean, reset: boolean, verbose: number }>()

  if (opts.agent === 'fake') {
    if (opts.summarizer) {
      program.error('--summarizer cannot be used with the fake agent')
    }
    return { type: 'fake', waitForClient: opts.wait, reset: opts.reset, verbosity: opts.verbose }
  }

  if (opts.summarizer === 'fake') {
    program.error('--summarizer cannot be "fake"')
  }

  const agent = parseSpec(opts.agent)
  const summarizer = opts.summarizer ? parseSpec(opts.summarizer) : agent

  return { type: 'llm', agent, summarizer, waitForClient: opts.wait, reset: opts.reset, verbosity: opts.verbose }
}
