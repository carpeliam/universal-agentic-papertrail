import 'vitest'
import type { ModelMessage } from "ai"

declare module 'vitest' {
  interface Matchers<T = any> {
    toMatchModelMessage(expectedRole: ModelMessage['role'], expectedText: unknown): R
    toMatchSystemModelMessage(expectedText: unknown): R
  }
}
