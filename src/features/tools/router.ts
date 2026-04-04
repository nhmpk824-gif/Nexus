import { confirmBuiltInToolExecution, resolveBuiltInToolPolicy } from './permissions'
import { executeBuiltInTool, isBuiltInToolAvailable } from './registry'
import type { BuiltInToolResult, MatchedBuiltInTool } from './toolTypes'

export type { BuiltInToolResult } from './toolTypes'

export async function maybeRunMatchedBuiltInTool(
  matchedTool: MatchedBuiltInTool | null,
  settings?: unknown,
): Promise<BuiltInToolResult | null> {
  if (!matchedTool) {
    return null
  }

  if (!isBuiltInToolAvailable(matchedTool.id)) {
    return null
  }

  const policy = resolveBuiltInToolPolicy(matchedTool.id, settings)
  if (!policy.enabled) {
    return null
  }

  if (!confirmBuiltInToolExecution(matchedTool, policy)) {
    return null
  }

  return executeBuiltInTool(matchedTool, policy, settings as Record<string, unknown>)
}
