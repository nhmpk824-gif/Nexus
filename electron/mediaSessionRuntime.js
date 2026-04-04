import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MEDIA_SESSION_SCRIPT_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'mediaSession.ps1')
  : path.join(__dirname, 'mediaSession.ps1')
const MEDIA_SESSION_TIMEOUT_MS = 8_000
const MEDIA_SESSION_MAX_BUFFER_BYTES = 6 * 1024 * 1024

function executeMediaSessionScript(args = []) {
  if (process.platform !== 'win32') {
    return Promise.resolve(JSON.stringify({
      ok: true,
      hasSession: false,
    }))
  }

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        MEDIA_SESSION_SCRIPT_PATH,
        ...args,
      ],
      {
        timeout: MEDIA_SESSION_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: MEDIA_SESSION_MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr ?? '').trim() || error.message))
          return
        }

        resolve(String(stdout ?? '').trim())
      },
    )
  })
}

function parseMediaSessionJson(stdout) {
  try {
    return JSON.parse(String(stdout ?? '').trim() || '{}')
  } catch (error) {
    throw new Error(`系统媒体会话返回了无法解析的内容。${error instanceof Error ? ` ${error.message}` : ''}`)
  }
}

function normalizeMediaSessionSnapshot(value = {}) {
  return {
    ok: value.ok !== false,
    hasSession: value.hasSession === true,
    sessionKey: String(value.sessionKey ?? '').trim() || undefined,
    sourceAppUserModelId: String(value.sourceAppUserModelId ?? '').trim() || undefined,
    title: String(value.title ?? '').trim() || undefined,
    artist: String(value.artist ?? '').trim() || undefined,
    albumTitle: String(value.albumTitle ?? '').trim() || undefined,
    artworkDataUrl: String(value.artworkDataUrl ?? '').trim() || undefined,
    playbackStatus: String(value.playbackStatus ?? '').trim() || undefined,
    isPlaying: value.isPlaying === true,
    positionSeconds: Number.isFinite(Number(value.positionSeconds))
      ? Number(value.positionSeconds)
      : undefined,
    durationSeconds: Number.isFinite(Number(value.durationSeconds))
      ? Number(value.durationSeconds)
      : undefined,
    supports: {
      play: value?.supports?.play === true,
      pause: value?.supports?.pause === true,
      toggle: value?.supports?.toggle === true,
      next: value?.supports?.next === true,
      previous: value?.supports?.previous === true,
    },
  }
}

function normalizeMediaSessionControlResponse(value = {}, requestedAction = 'toggle') {
  return {
    ok: value.ok === true,
    hasSession: value.hasSession === true,
    action: String(value.action ?? requestedAction).trim() || requestedAction,
    message: String(value.message ?? '').trim() || undefined,
  }
}

export async function getSystemMediaSessionSnapshot() {
  const stdout = await executeMediaSessionScript(['-Action', 'snapshot'])
  return normalizeMediaSessionSnapshot(parseMediaSessionJson(stdout))
}

export async function controlSystemMediaSession(action) {
  const normalizedAction = String(action ?? '').trim() || 'toggle'
  const stdout = await executeMediaSessionScript([
    '-Action',
    'control',
    '-Control',
    normalizedAction,
  ])

  return normalizeMediaSessionControlResponse(parseMediaSessionJson(stdout), normalizedAction)
}
