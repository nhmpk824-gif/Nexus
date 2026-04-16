import { ipcMain } from 'electron'
import * as workspaceFs from '../services/workspaceFs.js'
import { requireTrustedSender } from './validate.js'

export function register() {
  ipcMain.handle('workspace:set-root', async (event, payload) => {
    requireTrustedSender(event)
    workspaceFs.setWorkspaceRoot(String(payload?.root ?? ''))
    return { ok: true, root: workspaceFs.getWorkspaceRoot() }
  })

  ipcMain.handle('workspace:get-root', async (event) => {
    requireTrustedSender(event)
    return { root: workspaceFs.getWorkspaceRoot() }
  })

  ipcMain.handle('workspace:read', async (event, payload) => {
    requireTrustedSender(event)
    return workspaceFs.readWorkspaceFile(String(payload?.path ?? ''))
  })

  ipcMain.handle('workspace:write', async (event, payload) => {
    requireTrustedSender(event)
    return workspaceFs.writeWorkspaceFile(
      String(payload?.path ?? ''),
      String(payload?.content ?? ''),
    )
  })

  ipcMain.handle('workspace:edit', async (event, payload) => {
    requireTrustedSender(event)
    return workspaceFs.editWorkspaceFile(
      String(payload?.path ?? ''),
      String(payload?.oldString ?? ''),
      String(payload?.newString ?? ''),
    )
  })

  ipcMain.handle('workspace:glob', async (event, payload) => {
    requireTrustedSender(event)
    return workspaceFs.globWorkspace(String(payload?.pattern ?? ''))
  })

  ipcMain.handle('workspace:grep', async (event, payload) => {
    requireTrustedSender(event)
    return workspaceFs.grepWorkspace(String(payload?.query ?? ''), {
      caseSensitive: Boolean(payload?.caseSensitive),
      maxResults: payload?.maxResults,
    })
  })
}
