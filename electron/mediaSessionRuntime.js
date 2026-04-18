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

const EMPTY_SESSION_JSON = JSON.stringify({ ok: true, hasSession: false })

/**
 * JXA (JavaScript for Automation) script run via `osascript -l JavaScript`
 * to query Now Playing info from Apple Music and Spotify without launching
 * either one if they're not already running. Output is JSON in the same
 * shape produced by mediaSession.ps1 on Windows.
 *
 * Music.app is preferred over Spotify when both are active.
 */
const MAC_SNAPSHOT_JXA = `function run() {
  const result = { ok: true, hasSession: false };
  const candidates = [
    { bundle: 'com.apple.Music', name: 'Music' },
    { bundle: 'com.spotify.client', name: 'Spotify' },
  ];
  let se;
  try { se = Application('System Events'); } catch (e) { return JSON.stringify(result); }
  for (const entry of candidates) {
    try {
      const procs = se.processes.whose({ bundleIdentifier: { '=': entry.bundle } });
      let running = false;
      try { running = procs && procs.length && procs.length() > 0; } catch (e) { running = false; }
      if (!running) continue;
      const app = Application(entry.name);
      let state = '';
      try { state = String(app.playerState()); } catch (e) { continue; }
      if (!state || state === 'stopped') continue;
      const track = app.currentTrack;
      let title = '', artist = '', album = '';
      try { title = String(track.name()); } catch (e) {}
      try { artist = String(track.artist()); } catch (e) {}
      try { album = String(track.album()); } catch (e) {}
      if (!title && !artist) continue;
      let duration = 0, position = 0;
      try { duration = Number(track.duration()) || 0; } catch (e) {}
      try { position = Number(app.playerPosition()) || 0; } catch (e) {}
      result.hasSession = true;
      result.sessionKey = entry.bundle;
      result.sourceAppUserModelId = entry.bundle;
      result.title = title;
      result.artist = artist;
      result.albumTitle = album;
      result.isPlaying = state === 'playing';
      result.playbackStatus = state;
      result.positionSeconds = position;
      result.durationSeconds = duration;
      result.supports = { play: true, pause: true, toggle: true, next: true, previous: true };
      break;
    } catch (e) { /* try next candidate */ }
  }
  return JSON.stringify(result);
}`

/**
 * Sends a playback command to whichever of Music.app / Spotify currently has
 * an active (non-stopped) session. Does NOT launch either app.
 */
const MAC_CONTROL_JXA = `function run(argv) {
  const action = (argv && argv[0]) ? String(argv[0]) : 'toggle';
  const result = { ok: false, hasSession: false, action };
  const candidates = [
    { bundle: 'com.apple.Music', name: 'Music' },
    { bundle: 'com.spotify.client', name: 'Spotify' },
  ];
  let se;
  try { se = Application('System Events'); } catch (e) { return JSON.stringify(result); }
  for (const entry of candidates) {
    try {
      const procs = se.processes.whose({ bundleIdentifier: { '=': entry.bundle } });
      let running = false;
      try { running = procs && procs.length && procs.length() > 0; } catch (e) { running = false; }
      if (!running) continue;
      const app = Application(entry.name);
      let state = '';
      try { state = String(app.playerState()); } catch (e) { continue; }
      if (!state || state === 'stopped') continue;
      result.hasSession = true;
      try {
        switch (action) {
          case 'play': app.play(); break;
          case 'pause': app.pause(); break;
          case 'next': app.nextTrack(); break;
          case 'previous': app.previousTrack(); break;
          case 'toggle':
          default: app.playpause(); break;
        }
        result.ok = true;
      } catch (err) {
        result.message = (err && err.message) ? String(err.message) : String(err);
      }
      break;
    } catch (e) { /* try next candidate */ }
  }
  return JSON.stringify(result);
}`

function executeWindowsMediaSessionScript(args = []) {
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

function executeMacOsaScript(source, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', source, ...args],
      {
        timeout: MEDIA_SESSION_TIMEOUT_MS,
        maxBuffer: MEDIA_SESSION_MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        if (error) {
          // osascript exits non-zero when the target app isn't scriptable or
          // AppleEvents are denied by TCC. Return an empty-session snapshot
          // so the caller can continue without a hard failure.
          const message = String(stderr ?? '').trim() || error.message
          console.warn('[mediaSession] osascript failed:', message)
          resolve(EMPTY_SESSION_JSON)
          return
        }
        resolve(String(stdout ?? '').trim() || EMPTY_SESSION_JSON)
      },
    )
  })
}

function executeMediaSessionScript(args = []) {
  if (process.platform === 'win32') {
    return executeWindowsMediaSessionScript(args)
  }
  if (process.platform === 'darwin') {
    // Translate the shared ['-Action', 'snapshot'] / ['-Action', 'control', '-Control', X]
    // arg shape used on Windows into an osascript invocation.
    let action = 'snapshot'
    let control = 'toggle'
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === '-Action' && args[i + 1]) { action = String(args[i + 1]); i += 1 }
      else if (args[i] === '-Control' && args[i + 1]) { control = String(args[i + 1]); i += 1 }
    }
    if (action === 'control') {
      return executeMacOsaScript(MAC_CONTROL_JXA, [control])
    }
    return executeMacOsaScript(MAC_SNAPSHOT_JXA)
  }
  // Linux / other platforms: no system media session API wired up yet.
  return Promise.resolve(EMPTY_SESSION_JSON)
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
