import { SystemModelMessage } from 'ai'
import { expect } from 'vitest'

expect.extend({
  toMatchModelMessage(received, expectedRole, expectedText) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected a model message object, but received ${typeof received}`,
      }
    }

    const roleMatches = received.role === expectedRole
    const actualText = (typeof received.content === 'string')
      ? received.content
      : (Array.isArray(received.content))
        ? received.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text).join('')
        : undefined
    const textMatches = this.equals(actualText, expectedText)
    const pass = roleMatches && textMatches

    return {
      pass,
      message: () =>
        pass
          ? `Expected message to NOT match role "${expectedRole}" with text condition.`
          : `Expected message to match role "${expectedRole}" with text condition. Received: ${JSON.stringify(received)}`,
    }
  },

  toMatchSystemModelMessage(received, expectedText) {
    if (!received) {
      return { pass: false, message: () => `Expected a system message but received ${received}` }
    }

    const actualText = (typeof received === 'string')
        ? received
        : (Array.isArray(received)) ? received.map((m: SystemModelMessage) => m.content).join('') : received?.content
    const pass = this.equals(actualText, expectedText)

    return {
      pass,
      message: () => pass
        ? `Expected system message NOT to match text condition.`
        : `Expected system message to match text condition. Actual: "${actualText}"`,
    }
  },
})
