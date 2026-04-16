import { useEffect } from 'react'
import type { AppSettings } from '../../types'

/**
 * Reject traversal segments (../ or ..\) anywhere in the path.
 * Accepts either forward slashes or backslashes on any platform.
 */
const TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)/

/**
 * Require a drive letter prefix on Windows (e.g. "C:\" or "C:/").
 */
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:[\\/]/

function isWindowsUserAgent(): boolean {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
}

/**
 * Push the agent workspace root into the main process so the sandboxed fs
 * tools (Read/Edit/Glob/Grep) know where they're allowed to operate.
 *
 * Performs two guard checks before handing off:
 *   - Rejects paths containing ".." segments (directory traversal).
 *   - On Windows, rejects paths that lack a drive letter prefix.
 *
 * Invalid paths surface through the provided onError callback rather than
 * silently pushing a bad value to the main process.
 */
export function useWorkspaceRootBridge(
  settings: AppSettings,
  onError: (message: string) => void,
): void {
  useEffect(() => {
    const root = settings.agentWorkspaceRoot.trim()
    if (root) {
      if (TRAVERSAL_PATTERN.test(root)) {
        console.error('[workspaceRoot] Rejected: path must not contain ".." segments:', root)
        onError('Workspace root must not contain ".." path segments.')
        return
      }
      if (isWindowsUserAgent() && !WINDOWS_DRIVE_PATTERN.test(root)) {
        console.error('[workspaceRoot] Rejected: Windows path must start with a drive letter:', root)
        onError('On Windows, workspace root must start with a drive letter (e.g. C:\\).')
        return
      }
    }
    void window.desktopPet?.workspaceSetRoot?.({ root })
    // `onError` is intentionally omitted — it's a ref-backed setter that is
    // stable across renders but doesn't participate in what value to push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.agentWorkspaceRoot])
}
