import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentAction, AgentPrompt, StrategicNotes, TickInteraction } from '@/types'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => ({ schema })),
  },
}))

import { generateText, type GenerateTextResult } from 'ai'
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
  const { maker } = createAiAgent('sonnet')

  it('sets the model according to the argument', async () => {
    await maker(prompt({ priorNotes: [] }))

    expect(mockGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: 'claude-sonnet-4-6' }),
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

  it('returns the output from generateText', async () => {
    const result = await maker(prompt({ priorNotes: [] }))
    expect(result).toEqual(mockAgentResponse)
  })
})

describe('summarize', () => {
  const { summarize } = createAiAgent('sonnet')

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
      model: expect.objectContaining({ modelId: 'claude-sonnet-4-6' }),
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
