import 'vitest'
import type { ModelMessage } from "ai"

interface ModelMessageMatchers<T = any> {
  toMatchModelMessage(expectedRole: ModelMessage['role'], expectedText: unknown): R
  toMatchSystemModelMessage(expectedText: unknown): R
}
declare module 'vitest' {
  interface Assertion<T = any> extends ModelMessageMatchers<T> {}
  interface AsymmetricMatchersContaining extends ModelMessageMatchers {}
}
