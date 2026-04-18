/**
 * Python runtime detection for optional AI services (OmniVoice TTS, GLM-ASR).
 *
 * These services spawn long-running python processes. On a fresh install
 * users typically don't have Python + the heavy wheels (torch, transformers)
 * ready — spawning anyway produces a stream of ImportError tracebacks that
 * mask real startup problems and make the app look broken.
 *
 * Instead we probe once at startup:
 *   - Is there a python binary?
 *   - Can it import the modules each service needs?
 * If either check fails we mark the service as "disabled — requires Python"
 * and skip the spawn entirely. The renderer can query python:status to show
 * a friendly note in Settings instead of spinning forever.
 */

import { spawn, spawnSync } from 'node:child_process'

function resolveCandidateBinaries() {
  if (process.env.NEXUS_PYTHON) return [process.env.NEXUS_PYTHON]
  if (process.platform === 'win32') return ['python', 'python3']
  return ['python3', 'python']
}

function probeBinary(binary) {
  try {
    const result = spawnSync(binary, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 3000,
    })
    if (result.status !== 0 && result.error) return null
    const combined = `${result.stdout || ''}${result.stderr || ''}`.trim()
    const match = /Python (\d+)\.(\d+)\.(\d+)/.exec(combined)
    if (!match) return null
    const [, maj, min, patch] = match
    return {
      binary,
      version: `${maj}.${min}.${patch}`,
      major: Number(maj),
      minor: Number(min),
      patch: Number(patch),
    }
  } catch {
    return null
  }
}

function probeImports(binary, modules) {
  if (!modules?.length) return { ok: true, missing: [] }
  const code = modules.map(m => `import ${m}`).join('\n')
  try {
    const result = spawnSync(binary, ['-c', code], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 8000,
    })
    if (result.status === 0) return { ok: true, missing: [] }
    const stderr = String(result.stderr || '')
    const missing = []
    for (const mod of modules) {
      const re = new RegExp(`No module named ['"]?${mod.replace(/\./g, '\\.')}['"]?`)
      if (re.test(stderr)) missing.push(mod)
    }
    return { ok: false, missing: missing.length ? missing : ['unknown'], stderr }
  } catch (error) {
    return { ok: false, missing: ['unknown'], stderr: String(error?.message ?? error) }
  }
}

let _cachedStatus = null
let _inflightProbe = null

async function computeStatus() {
  const candidates = resolveCandidateBinaries()
  let detected = null
  for (const candidate of candidates) {
    detected = probeBinary(candidate)
    if (detected) break
  }

  if (!detected) {
    return {
      pythonAvailable: false,
      binary: null,
      version: null,
      omniVoice: { ready: false, missingImports: ['python'] },
      glmAsr: { ready: false, missingImports: ['python'] },
    }
  }

  // Probe the top-level imports each sidecar performs immediately at module
  // load. `omnivoice` is a separate pip package the user must install
  // alongside torch/transformers — without it the OmniVoice server crashes
  // with `ModuleNotFoundError: No module named 'omnivoice'` before the
  // FastAPI server can even bind a port. GLM-ASR only needs the common
  // stack — its runtime failure modes (wrong transformers version for the
  // GLM architecture) happen during model.from_pretrained() which we can't
  // cheaply probe without downloading weights.
  const omniVoiceModules = ['torch', 'torchaudio', 'transformers', 'fastapi', 'uvicorn', 'omnivoice']
  const glmAsrModules = ['torch', 'transformers', 'fastapi', 'uvicorn']

  const omni = probeImports(detected.binary, omniVoiceModules)
  const glm = probeImports(detected.binary, glmAsrModules)

  return {
    pythonAvailable: true,
    binary: detected.binary,
    version: detected.version,
    omniVoice: { ready: omni.ok, missingImports: omni.missing },
    glmAsr: { ready: glm.ok, missingImports: glm.missing },
  }
}

export function getPythonRuntimeStatus() {
  return _cachedStatus
}

export async function ensurePythonRuntimeStatus() {
  if (_cachedStatus) return _cachedStatus
  if (_inflightProbe) return _inflightProbe
  _inflightProbe = computeStatus().then((status) => {
    _cachedStatus = status
    _inflightProbe = null
    logStatus(status)
    return status
  })
  return _inflightProbe
}

function logStatus(status) {
  if (!status.pythonAvailable) {
    console.info('[Python] No Python interpreter found — OmniVoice TTS and GLM-ASR will be disabled. Install Python 3.10+ and pip install -r requirements.txt to enable them.')
    return
  }
  console.info(`[Python] Detected ${status.binary} ${status.version}`)
  if (!status.omniVoice.ready) {
    console.info(`[Python] OmniVoice TTS disabled — missing modules: ${status.omniVoice.missingImports.join(', ')}`)
  }
  if (!status.glmAsr.ready) {
    console.info(`[Python] GLM-ASR disabled — missing modules: ${status.glmAsr.missingImports.join(', ')}`)
  }
}

export { spawn }
