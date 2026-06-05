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

import { APICallError, generateText, NoObjectGeneratedError, type GenerateTextResult } from 'ai'
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

function mockGenerateTextOutput(output: object, reasoning = 'this seems like a good idea') {
  return {
    output,
    response: {
      messages: [{
        role: 'assistant', content: [
          { type: 'reasoning', text: reasoning },
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

  it('can start a conversation on the first generation', async () => {
    const player = createPlayer([])

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining("You're starting fresh with no prior context"),
      messages: [
        { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
      ],
    }))
    let generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.messages![0].content).toContain(JSON.stringify(actions.available))
    expect(generateTextPayload.messages![0].content).toContain(JSON.stringify(actions.unavailable))
    expect(generateTextPayload.messages![0].content).toContain(JSON.stringify(state))

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining("You're starting fresh with no prior context"),
      messages: [
        { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
        { role: 'assistant', content: expect.arrayContaining([{ type: 'text', text: JSON.stringify(mockAgentAction) }]) },
        { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
      ],
    }))
    generateTextPayload = mockGenerateText.mock.calls[1][0]
    expect(generateTextPayload.messages![2].content).toContain(JSON.stringify(actions.available))
    expect(generateTextPayload.messages![2].content).toContain(JSON.stringify(actions.unavailable))
    expect(generateTextPayload.messages![2].content).toContain(JSON.stringify(state))
  })

  it('can carry a conversation on the nth generation', async () => {
    const player = createPlayer([mockStrategicNotes])

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining('picking up where someone else left off'),
      messages: [
        { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
      ],
    }))
    let generateTextPayload = mockGenerateText.mock.calls[0][0]
    expect(generateTextPayload.system).toContain(JSON.stringify([mockStrategicNotes]))
    expect(generateTextPayload.messages![0].content).toContain(JSON.stringify(actions.available))
    expect(generateTextPayload.messages![0].content).toContain(JSON.stringify(actions.unavailable))
    expect(generateTextPayload.messages![0].content).toContain(JSON.stringify(state))

    await player.play(prompt())

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining('picking up where someone else left off'),
      messages: [
        { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
        { role: 'assistant', content: expect.arrayContaining([{ type: 'text', text: JSON.stringify(mockAgentAction) }]) },
        { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
      ],
    }))
    generateTextPayload = mockGenerateText.mock.calls[1][0]
    expect(generateTextPayload.messages![2].content).toContain(JSON.stringify(actions.available))
    expect(generateTextPayload.messages![2].content).toContain(JSON.stringify(actions.unavailable))
    expect(generateTextPayload.messages![2].content).toContain(JSON.stringify(state))
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
        system: expect.stringContaining("You're starting fresh with no prior context"),
        messages: [
          { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
        ],
      }))
      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.stringContaining("You're starting fresh with no prior context"),
        messages: [
          { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
          { role: 'assistant', content: '{"action":{"type":"wait"},"reasoning":"We have a healthy supply of wire"}' },
          { role: 'user', content: expect.stringContaining('Your previous response did not match the required schema.') },
        ],
      }))

      await player.play(prompt())

      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.stringContaining("You're starting fresh with no prior context"),
        messages: [
          { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
          { role: 'assistant', content: expect.arrayContaining([{ type: 'text', text: JSON.stringify(mockAgentAction) }]) },
          { role: 'user', content: expect.stringContaining('Choose one action from the set of available actions') },
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
      system: expect.stringContaining('You are maintaining a rolling set of strategic notes'),
      messages: [{ role: 'user', content: expect.stringContaining(JSON.stringify([mockStrategicNotes])) }],
    }))
  })

  it('returns the output from generateText', async () => {
    const result = await summarize([mockStrategicNotes], mockTranscript)
    expect(result).toEqual(mockStrategicNotes)
  })
})
