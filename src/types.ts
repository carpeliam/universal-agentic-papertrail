import { ProjectId } from "paperclips-remake"

export type AgentAction =
  | { type: 'makeClip' }
  | { type: 'buyWire' }
  | { type: 'buyAutoClipper' }
  | { type: 'wait'; turns: number }
  | { type: 'completeProject'; projectId: ProjectId }
