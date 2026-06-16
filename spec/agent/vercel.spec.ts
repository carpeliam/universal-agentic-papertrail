import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { APICallError, generateText, NoObjectGeneratedError, Output, type GenerateTextResult } from 'ai'
import { z } from 'zod'
import { createInitialGameState } from 'paperclips-remake'
import createAiAgent from '@/agent/vercel'
import { getActions } from '@/agent-adapter'
import type { AgentAction, LLMAgentOptions, StrategicNotes, TickInteraction } from '@/types'
import { DeepPartial } from '../helper'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => ({ schema })),
  },
  NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
    readonly cause?: Error
    readonly text: string
    constructor({ message, cause, text }: { message: string, cause?: Error, text: string }) {
      super(message)
      this.cause = cause
      this.text = text
    }
    static isInstance(e: unknown): e is NoObjectGeneratedError {
      return e instanceof NoObjectGeneratedError
    }
  },
  APICallError: class APICallError extends Error {
    readonly isRetryable: boolean
    readonly data?: unknown
    constructor({ message, data, isRetryable = false }: { message: string, data?: unknown, isRetryable?: boolean }) {
      super(message)
      this.data = data
      this.isRetryable = isRetryable
    }
    static isInstance(e: unknown): e is APICallError {
      return e instanceof APICallError
    }
  },
}))

vi.hoisted(() => { vi.stubEnv('OPENROUTER_API_KEY', undefined as any) })

const mockGenerateText = vi.mocked(generateText)

const sampleAgentAction: AgentAction = { type: 'makeClip' }
const sampleStrategicNotes: StrategicNotes = {
  truths: [],
  openQuestions: [],
  corrections: [],
  situation: 'Early game, exploring.',
}

const gameState = createInitialGameState()
const agentActions = getActions(gameState)

function setupAiAgent(options: DeepPartial<LLMAgentOptions> = {}) {
  return createAiAgent({
    agent: { provider: 'anthropic', model: 'haiku', ...options.agent },
    summarizer: { provider: 'anthropic', model: 'haiku', ...options.summarizer },
    planMode: options.planMode ?? false,
    verbosity: options.verbosity ?? 0,
  })
}

function mockGenerateTextOutput(output: object, reasoningText = 'this seems like a good idea') {
  return {
    output,
    usage: { inputTokens: 0 },
    reasoningText,
    response: {
      messages: [{
        role: 'assistant', content: [
          { type: 'reasoning', text: reasoningText },
          { type: 'text', text: JSON.stringify(output) },
        ],
      }],
    },
  } as GenerateTextResult<{}, any>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateText.mockResolvedValue(mockGenerateTextOutput(sampleAgentAction, 'Just getting started!'))
})
afterEach(() => { vi.unstubAllEnvs() })

describe('player', () => {
  it('sets the model according to the argument', async () => {
    const { createPlayer } = setupAiAgent({ agent: { model: 'claude-monet-1-0' } })
    const player = createPlayer([])

    await player.play({ state: gameState, actions: agentActions })

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: 'claude-monet-1-0' }),
    }))
  })

  it('returns the agent action/reasoning response as an array', async () => {
    const { createPlayer } = setupAiAgent()
    const player = createPlayer([])

    const response = await player.play({ state: gameState, actions: agentActions })

    expect(response).toEqual({ plan: [sampleAgentAction], reasoning: 'Just getting started!' })
  })

  it('sends a schema matching only available actions', async () => {
    const { createPlayer } = setupAiAgent()
    const player = createPlayer([])

    await player.play({ state: gameState, actions: agentActions })

    const schema = vi.mocked(Output.object).mock.calls[0][0].schema as z.ZodType
    expect(schema.safeParse({ type: 'makeClip' }).success).toBe(true)
    expect(schema.safeParse({ type: 'wait', turns: 1 }).success).toBe(true)
    expect(schema.safeParse({ type: 'buyAutoClipper' }).success).toBe(false)
  })

  describe('with plan mode enabled', () => {
    beforeEach(() => { mockGenerateText.mockResolvedValue(mockGenerateTextOutput([sampleAgentAction])) })
    const { createPlayer } = setupAiAgent({ planMode: true })

    it('returns the response', async () => {
      const player = createPlayer([])

      const response = await player.play({ state: gameState, actions: agentActions })

      expect(response).toEqual(expect.objectContaining({ plan: [sampleAgentAction] }))
    })

    it('sends a schema matching an array of all possible actions', async () => {
      const player = createPlayer([])

      await player.play({ state: gameState, actions: agentActions })

      const schema = vi.mocked(Output.object).mock.calls[0][0].schema as z.ZodType
      expect(schema.safeParse([{ type: 'makeClip' }]).success).toBe(true)
      expect(schema.safeParse([{ type: 'buyAutoClipper' }]).success).toBe(true)
      expect(schema.safeParse([{ type: 'makeClip' }, { type: 'buyAutoClipper' }, { type: 'wait', turns: 1 }]).success).toBe(true)
      expect(schema.safeParse({ type: 'makeClip' }).success).toBe(false)
    })
  })


  it('can start a conversation on the first generation', async () => {
    const { createPlayer } = setupAiAgent()
    const player = createPlayer([])

    await player.play({ state: gameState, actions: agentActions })

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    let generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining('# Paperclips: 0'))

    await player.play({ state: gameState, actions: agentActions })

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    generateTextPayload = mockGenerateText.mock.calls[1][0]
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining('# Paperclips: 0'))
  })

  it('can carry a conversation on the nth generation', async () => {
    const { createPlayer } = setupAiAgent()
    const player = createPlayer([sampleStrategicNotes])

    await player.play({ state: gameState, actions: agentActions })

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining('picking up where someone else left off')),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    let generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.system).toMatchSystemModelMessage(expect.stringContaining(JSON.stringify([sampleStrategicNotes])))
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining('# Paperclips: 0'))

    await player.play({ state: gameState, actions: agentActions })

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining('picking up where someone else left off')),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    generateTextPayload = mockGenerateText.mock.calls[1][0]
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining('# Paperclips: 0'))
  })

  it('removes state/actions beyond the most recent 4 responses', async () => {
    const { createPlayer } = setupAiAgent()
    const player = createPlayer([])

    for (let i = 0; i < 6; i++) {
      await player.play({ state: gameState, actions: agentActions })
    }

    expect(mockGenerateText).toHaveBeenLastCalledWith(expect.objectContaining({
      messages: [
        expect.not.toMatchModelMessage('user', expect.stringContaining(JSON.stringify(gameState))),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
  })

  it('can continue as long as the input token count is below 40,000', async () => {
    const baseGenerateTextResult = mockGenerateTextOutput(sampleAgentAction)
    const { createPlayer } = setupAiAgent()
    const player = createPlayer([])

    mockGenerateText
      .mockResolvedValueOnce({ ...baseGenerateTextResult, usage: { ...baseGenerateTextResult.usage, inputTokens: 39_999 } })
      .mockResolvedValue({ ...baseGenerateTextResult, usage: { ...baseGenerateTextResult.usage, inputTokens: 1 } })

    await player.play({ state: gameState, actions: agentActions })
    expect(player.canContinue()).toBeTruthy()
    await player.play({ state: gameState, actions: agentActions })
    expect(player.canContinue()).toBeFalsy()
  })

  describe('when a schema validation is encountered', () => {
    it('submits again with an explanation of the error', async () => {
      const { createPlayer } = setupAiAgent()
      const player = createPlayer([])
      mockGenerateText
        .mockRejectedValueOnce(new NoObjectGeneratedError({
          message: 'The operation was aborted',
          cause: new Error('Invalid input: expected number, received undefined'),
          text: '{"action":{"type":"wait"},"reasoning":"We have a healthy supply of wire"}',
        } as any))
        .mockResolvedValueOnce(mockGenerateTextOutput(sampleAgentAction))

      const response = await player.play({ state: gameState, actions: agentActions })

      expect(response).toEqual(expect.objectContaining({ plan: [sampleAgentAction] }))
      expect(mockGenerateText).toHaveBeenCalledTimes(2)
      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
        messages: [
          expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        ],
      }))
      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
        messages: [
          expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
          expect.toMatchModelMessage('assistant', '{"action":{"type":"wait"},"reasoning":"We have a healthy supply of wire"}'),
          expect.toMatchModelMessage('user', expect.stringContaining('Your previous response did not match the required schema.')),
        ],
      }))

      await player.play({ state: gameState, actions: agentActions })

      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
        messages: [
          expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
          expect.toMatchModelMessage('assistant', JSON.stringify(sampleAgentAction)),
          expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        ],
      }))
    })
  })

  describe('when an API error is thrown', () => {
    beforeEach(() => { vi.useFakeTimers() })
    it('waits a moment then tries again', async () => {
      const { createPlayer } = setupAiAgent()
      const player = createPlayer([])
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({ message: 'The operation was aborted', isRetryable: false, data: { code: 504 } } as any))
        .mockResolvedValueOnce(mockGenerateTextOutput(sampleAgentAction))

      const response = player.play({ state: gameState, actions: agentActions })

      await vi.advanceTimersByTimeAsync(124)
      expect(mockGenerateText).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)

      expect(await response).toEqual(expect.objectContaining({ plan: [sampleAgentAction] }))
    })
  })
})

describe('summarize', () => {
  const mockTranscript: TickInteraction[] = [
    {
      prompt: { state: gameState, actions: agentActions },
      response: { plan: [sampleAgentAction], reasoning: '' },
    },
  ]

  beforeEach(() => {
    mockGenerateText.mockResolvedValue(mockGenerateTextOutput(sampleStrategicNotes))
  })

  it('sets the model according to the argument', async () => {
    const { summarize } = setupAiAgent({ summarizer: { model: 'claude-debussy-1-0' }})
    await summarize([sampleStrategicNotes], mockTranscript)

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: 'claude-debussy-1-0' }),
    }))
  })

  it('includes the prior notes and transcript in the prompt', async () => {
    const { summarize } = setupAiAgent()
    await summarize([sampleStrategicNotes], mockTranscript)

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining('You are maintaining a rolling set of strategic notes')),
      messages: [expect.toMatchModelMessage('user', expect.stringContaining(JSON.stringify([sampleStrategicNotes])))],
    }))
    const generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining('# Paperclips: 0'))
  })

  it('returns the output from generateText', async () => {
    const { summarize } = setupAiAgent()
    const result = await summarize([sampleStrategicNotes], mockTranscript)
    expect(result).toEqual(sampleStrategicNotes)
  })
})
