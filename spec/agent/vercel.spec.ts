import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AgentAction, AgentPrompt, StrategicNotes, TickInteraction } from '@/types'

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

import { APICallError, generateText, NoObjectGeneratedError, Output, type GenerateTextResult } from 'ai'
import { z } from 'zod'
import { createInitialGameState } from 'paperclips-remake'
import createAiAgent from '@/agent/vercel'
import { getActions, toAgentState } from '@/agent-adapter'

const mockGenerateText = vi.mocked(generateText)

const mockAgentAction: AgentAction = { type: 'makeClip' }

const mockStrategicNotes: StrategicNotes = {
  importantUnlocks: [],
  surprisesAndUpdates: [],
  watchouts: [],
  strategicNarrative: 'Early game, exploring.',
}

const state = toAgentState(createInitialGameState())
const actions = getActions(createInitialGameState())

function prompt(): AgentPrompt {
  return { state, actions }
}

function mockGenerateTextOutput(output: object, reasoningText = 'this seems like a good idea') {
  return {
    output,
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
  mockGenerateText.mockResolvedValue(mockGenerateTextOutput(mockAgentAction, 'Just getting started!'))
})
afterEach(() => { vi.unstubAllEnvs() })

describe('player', () => {
  const { createPlayer } = createAiAgent({ agent: { provider: 'anthropic', model: 'claude-monet-1-0' }, summarizer: { provider: 'anthropic', model: 'claude-debussy-1-0' }, verbosity: 0 })

  it('sets the model according to the argument', async () => {
    const player = createPlayer([])

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: 'claude-monet-1-0' }),
    }))
  })

  it('returns the response', async () => {
    const player = createPlayer([])

    const response = await player.play(prompt())

    expect(response).toEqual({ action: mockAgentAction, reasoning: 'Just getting started!' })
  })

  it('sends a schema matching only available actions', async () => {
    const player = createPlayer([])

    await player.play(prompt())

    const schema = vi.mocked(Output.object).mock.calls[0][0].schema as z.ZodObject
    expect(schema.safeParse({ type: 'makeClip' }).success).toBe(true)
    expect(schema.safeParse({ type: 'wait', turns: 1 }).success).toBe(true)
    expect(schema.safeParse({ type: 'buyAutoClipper' }).success).toBe(false)
  })

  it('can start a conversation on the first generation', async () => {
    const player = createPlayer([])

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    let generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.available)))
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.unavailable)))
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(state)))

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    generateTextPayload = mockGenerateText.mock.calls[1][0]
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.available)))
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.unavailable)))
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(state)))
  })

  it('can carry a conversation on the nth generation', async () => {
    const player = createPlayer([mockStrategicNotes])

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining('picking up where someone else left off')),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    let generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.system).toMatchSystemModelMessage(expect.stringContaining(JSON.stringify([mockStrategicNotes])))
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.available)))
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.unavailable)))
    expect(generateTextPayload.messages![0]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(state)))

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining('picking up where someone else left off')),
      messages: [
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
    generateTextPayload = mockGenerateText.mock.calls[1][0]
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.available)))
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(actions.unavailable)))
    expect(generateTextPayload.messages![2]).toMatchModelMessage('user', expect.stringContaining(JSON.stringify(state)))
  })

  it('removes state/actions beyond the most recent 4 responses', async () => {
    const player = createPlayer([])

    for (let i = 0; i < 6; i++) {
      await player.play(prompt())
    }

    expect(mockGenerateText).toHaveBeenLastCalledWith(expect.objectContaining({
      messages: [
        expect.not.toMatchModelMessage('user', expect.stringContaining(JSON.stringify(state))),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
        expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
      ],
    }))
  })

  describe('when a schema validation is encountered', () => {
    it('submits again with an explanation of the error', async () => {
      const player = createPlayer([])
      mockGenerateText
        .mockRejectedValueOnce(new NoObjectGeneratedError({
          message: 'The operation was aborted',
          cause: new Error('Invalid input: expected number, received undefined'),
          text: '{"action":{"type":"wait"},"reasoning":"We have a healthy supply of wire"}',
        } as any))
        .mockResolvedValueOnce(mockGenerateTextOutput(mockAgentAction))

      const response = await player.play(prompt())

      expect(response).toEqual(expect.objectContaining({ action: mockAgentAction }))
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

      await player.play(prompt())

      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.toMatchSystemModelMessage(expect.stringContaining("You're starting fresh with no prior context")),
        messages: [
          expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
          expect.toMatchModelMessage('assistant', JSON.stringify(mockAgentAction)),
          expect.toMatchModelMessage('user', expect.stringContaining('Choose one action from the set of available actions')),
        ],
      }))
    })
  })

  describe('when an API error is thrown', () => {
    beforeEach(() => { vi.useFakeTimers() })
    it('waits a moment then tries again', async () => {
      const player = createPlayer([])
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({ message: 'The operation was aborted', isRetryable: false, data: { code: 504 } } as any))
        .mockResolvedValueOnce(mockGenerateTextOutput(mockAgentAction))

      const response = player.play(prompt())

      await vi.advanceTimersByTimeAsync(124)
      expect(mockGenerateText).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)

      expect(await response).toEqual(expect.objectContaining({ action: mockAgentAction }))
    })
  })
})

describe('summarize', () => {
  const { summarize } = createAiAgent({ agent: { provider: 'anthropic', model: 'claude-monet-1-0' }, summarizer: { provider: 'anthropic', model: 'claude-debussy-1-0' }, verbosity: 0 })

  const mockTranscript: TickInteraction[] = [
    {
      prompt: prompt(),
      response: { action: mockAgentAction, reasoning: '' },
    },
  ]

  beforeEach(() => {
    mockGenerateText.mockResolvedValue(mockGenerateTextOutput(mockStrategicNotes))
  })

  it('sets the model according to the argument', async () => {
    await summarize([mockStrategicNotes], mockTranscript)

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: 'claude-debussy-1-0' }),
    }))
  })

  it('includes the prior notes and transcript in the prompt', async () => {
    await summarize([mockStrategicNotes], mockTranscript)

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.toMatchSystemModelMessage(expect.stringContaining('You are maintaining a rolling set of strategic notes')),
      messages: [expect.toMatchModelMessage('user', expect.stringContaining(JSON.stringify([mockStrategicNotes])))],
    }))
  })

  it('returns the output from generateText', async () => {
    const result = await summarize([mockStrategicNotes], mockTranscript)
    expect(result).toEqual(mockStrategicNotes)
  })
})
