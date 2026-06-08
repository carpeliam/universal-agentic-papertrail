import { Command, InvalidArgumentError } from 'commander'
import type { LLMAgentSpec, Provider, Host } from './types';

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'ollama']
const HOSTS: Host[] = ['openrouter']
const ALIASES: Record<string, LLMAgentSpec> = {
  haiku:   { provider: 'anthropic', model: 'claude-haiku-4-5' },
  sonnet:  { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  opus:    { provider: 'anthropic', model: 'claude-opus-4-7' },
  gpt:     { provider: 'openai', model: 'gpt-5' },
  gemini:  { provider: 'google', model: 'gemini-2.5-flash' },
  mistral: { provider: 'ollama', model: 'mistral' },
}

export type CLIConfig = (
  | { type: 'fake' }
  | { type: 'llm'; agent: LLMAgentSpec; summarizer: LLMAgentSpec }
) & {
  waitForClient: boolean
  reset: boolean
  planMode: boolean
  verbosity: number
}

function isProvider(value: string): value is Provider {
  return PROVIDERS.includes(value as Provider)
}

function parseSpec(value: string): LLMAgentSpec {
  const match = value.match(new RegExp(`^(.+?)(?:@(${HOSTS.join('|')}))?$`))
  if (!match) {
    throw new InvalidArgumentError(`Unknown agent ${value}. Use a known alias (${Object.keys(ALIASES).join(', ')}) or provider/model[@host] format (e.g. anthropic/claude-opus-4-6@openrouter, ollama/gemma2:9b).`)
  }

  const providerAndModel = match[1]
  const host = match[2] as Host | undefined
  if (providerAndModel in ALIASES) {
    return { ...ALIASES[providerAndModel], host }
  }

  const [provider, model] = providerAndModel.split('/', 2)
  if (!model || !isProvider(provider)) {
    throw new InvalidArgumentError(
      `Unknown agent "${providerAndModel}". Use a known alias (${Object.keys(ALIASES).join(', ')}) or provider/model[@host] format (e.g. anthropic/claude-opus-4-6@openrouter, ollama/gemma2:9b).`
    )
  }

  return { provider, model, host }
}

export default function parseCLI(): CLIConfig {
  const program = new Command('npm start --')
    .option('--agent <spec>', 'Agent to use: fake, an alias (haiku, sonnet, opus, gpt, mistral), or provider/model[@host]', 'fake')
    .option('--summarizer <spec>', 'Summarizer to use: follows the same format as --agent (defaults to same value as --agent if not specified)')
    .option('--wait', 'Wait for a WebSocket client connection before starting', false)
    .option('--reset', 'Clear logs before starting', false)
    .option('--plan', 'Allows an agent to plan multiple actions per turn', false)
    .option('-v, --verbose', 'Print the agent\'s thought process to the screen', (_, prev: number) => prev + 1, 0)
    .parse()

  const opts = program.opts<{ agent: string, summarizer?: string, wait: boolean, reset: boolean, plan: boolean, verbose: number }>()

  if (opts.agent === 'fake') {
    if (opts.summarizer) {
      program.error('--summarizer cannot be used with the fake agent')
    }
    return { type: 'fake', waitForClient: opts.wait, reset: opts.reset, planMode: opts.plan, verbosity: opts.verbose }
  }

  if (opts.summarizer === 'fake') {
    program.error('--summarizer cannot be "fake"')
  }

  const agent = parseSpec(opts.agent)
  const summarizer = opts.summarizer ? parseSpec(opts.summarizer) : agent

  return { type: 'llm', agent, summarizer, waitForClient: opts.wait, reset: opts.reset, planMode: opts.plan, verbosity: opts.verbose }
}
