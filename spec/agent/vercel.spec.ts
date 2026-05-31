import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentAction, AgentPrompt, StrategicNotes, TickInteraction } from '@/types'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => ({ schema })),
  },
  NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
    readonly cause?: Error
    constructor({ message, cause }: { message: string, cause?: Error }) {
      super(message)
      this.cause = cause
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

import { APICallError, generateText, NoObjectGeneratedError, type GenerateTextResult } from 'ai'
import createAiAgent from '@/agent/vercel'
import { createInitialGameState } from 'paperclips-remake'
import { getActions, toAgentState } from '@/agent-adapter'
import { anthropic } from '@ai-sdk/anthropic'

const mockGenerateText = vi.mocked(generateText)

const mockAgentResponse = {
  action: { type: 'makeClip' } as AgentAction,
  reasoning: 'Just getting started',
}

const mockStrategicNotes: StrategicNotes = {
  importantUnlocks: [],
  surprisesAndUpdates: [],
  watchouts: [],
  strategicNarrative: 'Early game, exploring.',
}

const state = toAgentState(createInitialGameState())
const actions = getActions(createInitialGameState())

function prompt(overrides: Partial<AgentPrompt> = {}): AgentPrompt {
  return { state, actions, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateText.mockResolvedValue({ output: mockAgentResponse } as GenerateTextResult<{}, any>)
})

describe('maker', () => {
  const { maker } = createAiAgent({ agent: { provider: 'anthropic', model: 'claude-monet-1-0' }, summarizer: { provider: 'anthropic', model: 'claude-debussy-1-0' }, verbosity: 0 })

  it('sets the model according to the argument', async () => {
    await maker(prompt({ priorNotes: [] }))

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: 'claude-monet-1-0' }),
    }))
  })

  describe('first generation, first tick, empty prior notes', () => {
    it('uses the fresh-start prompt with action instructions', async () => {
      await maker(prompt({ priorNotes: [] }))

      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringMatching(/you're starting fresh with no prior context.*choose one action from the available actions/i),
      }))
    })
  })

  describe('nth generation, first tick, some prior notes', () => {
    it('uses the handoff prompt with action instructions', async () => {
      await maker(prompt({ priorNotes: [mockStrategicNotes] }))

      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringMatching(/picking up where someone else left off.*choose one action from the available actions/i),
      }))
    })
  })

  describe('nth tick, same generation, notes are undefined', () => {
    it('uses the tick-reflection prompt', async () => {
      await maker(prompt({ priorNotes: undefined }))

      expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringMatching(/did your last action have the effect you expected/i),
      }))
    })
  })

  describe('when a schema validation is encountered', () => {
    it('submits again with an explanation of the error', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new NoObjectGeneratedError({ message: 'The operation was aborted', cause: new Error('Invalid input: expected number, received undefined') } as any))
        .mockResolvedValueOnce({ output: mockAgentResponse } as GenerateTextResult<{}, any>)

      const result = await maker(prompt({ priorNotes: [] }))
      expect(mockGenerateText).toHaveBeenCalledTimes(2)

      expect(result).toEqual(mockAgentResponse)
    })
  })

  describe('when an API error is thrown', () => {
    beforeEach(() => { vi.useFakeTimers() })
    it('waits a moment then tries again', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new APICallError({ message: 'The operation was aborted', isRetryable: false, data: { code: 504 } } as any))
        .mockResolvedValueOnce({ output: mockAgentResponse } as GenerateTextResult<{}, any>)

      const result = maker(prompt({ priorNotes: [] }))
      await vi.advanceTimersByTimeAsync(124)
      expect(mockGenerateText).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(mockGenerateText).toHaveBeenCalledTimes(2)

      expect(await result).toEqual(mockAgentResponse)
    })
  })

  it('returns the output from generateText', async () => {
    const result = await maker(prompt({ priorNotes: [] }))
    expect(result).toEqual(mockAgentResponse)
  })
})

describe('summarize', () => {
  const { summarize } = createAiAgent({ agent: { provider: 'anthropic', model: 'claude-monet-1-0' }, summarizer: { provider: 'anthropic', model: 'claude-debussy-1-0' }, verbosity: 0 })

  const mockTranscript: TickInteraction[] = [
    {
      prompt: prompt({ priorNotes: [] }),
      response: mockAgentResponse,
    },
  ]

  beforeEach(() => {
    mockGenerateText.mockResolvedValue({ output: mockStrategicNotes } as GenerateTextResult<{}, any>)
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
      prompt: expect.stringContaining(JSON.stringify([mockStrategicNotes])),
    }))
    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining(JSON.stringify(mockTranscript)),
    }))
  })

  it('returns the output from generateText', async () => {
    const result = await summarize([mockStrategicNotes], mockTranscript)
    expect(result).toEqual(mockStrategicNotes)
  })
})
