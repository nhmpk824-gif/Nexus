/**
 * Sherpa-onnx offline TTS service for Electron main process.
 *
 * Wraps OfflineTts to synthesize PCM audio from text, then encodes
 * the result as a WAV buffer so the renderer can play it via HTMLAudioElement.
 */

import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { createRequire } from 'node:module'
import { encodeFloat32ToWav, enhanceSpeechSamples } from './audioPostprocess.js'

let sherpa = null
try {
  const require = createRequire(import.meta.url)
  sherpa = require('sherpa-onnx-node')
} catch {
  console.warn('[SherpaTTS] sherpa-onnx-node is not installed or failed to load.')
}

function resolveModelsRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sherpa-models')
  }
  return path.join(app.getAppPath(), 'sherpa-models')
}

const VITS_MODEL_CANDIDATES = [
  {
    dir: 'vits-zh-hf-fanchen-C',
    modelFile: 'vits-zh-hf-fanchen-C.onnx',
    needsEspeak: false,
  },
  {
    dir: 'vits-melo-tts-zh_en',
    modelFile: 'model.onnx',
    needsEspeak: true,
  },
]

function findVitsModelConfig() {
  const root = resolveModelsRoot()

  for (const candidate of VITS_MODEL_CANDIDATES) {
    const dir = path.join(root, candidate.dir)
    const modelPath = path.join(dir, candidate.modelFile)

    if (!fs.existsSync(modelPath)) continue
    if (!fs.existsSync(path.join(dir, 'lexicon.txt'))) continue
    if (!fs.existsSync(path.join(dir, 'tokens.txt'))) continue

    const dictDir = path.join(dir, 'dict')
    const hasDictDir = fs.existsSync(dictDir)

    if (candidate.needsEspeak) {
      const espeakDir = path.join(dir, 'espeak-ng-data')
      if (!fs.existsSync(path.join(espeakDir, 'phontab'))) continue
      console.info('[SherpaTTS] Using model:', candidate.dir, '(with espeak, dict:', hasDictDir, ')')
      return {
        model: modelPath,
        lexicon: path.join(dir, 'lexicon.txt'),
        tokens: path.join(dir, 'tokens.txt'),
        dataDir: espeakDir,
        dictDir: hasDictDir ? dictDir : '',
      }
    }

    console.info('[SherpaTTS] Using model:', candidate.dir, '(lexicon-based, dict:', hasDictDir, ')')
    return {
      model: modelPath,
      lexicon: path.join(dir, 'lexicon.txt'),
      tokens: path.join(dir, 'tokens.txt'),
      dataDir: '',
      dictDir: hasDictDir ? dictDir : '',
    }
  }

  return null
}

let ttsInstance = null
let ttsInitError = null

function normalizeSpeakerId(rawSid, numSpeakers = 1) {
  const maxSpeakerId = Math.max(0, Math.trunc(Number(numSpeakers) || 1) - 1)
  const parsed = Number.parseInt(String(rawSid ?? '').trim(), 10)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.min(maxSpeakerId, Math.max(0, parsed))
}

let ttsInitPromiseInFlight = null

async function getTts() {
  if (ttsInstance) return ttsInstance
  if (ttsInitError) throw ttsInitError
  if (ttsInitPromiseInFlight) return ttsInitPromiseInFlight

  if (!sherpa) {
    ttsInitError = new Error('sherpa-onnx-node 未加载，无法使用本地 TTS。')
    throw ttsInitError
  }

  const config = findVitsModelConfig()
  if (!config) {
    ttsInitError = new Error(
      '找不到可用的本地 TTS 模型。请确认 sherpa-models 目录下存在 vits-melo-tts-zh_en 或 vits-zh-hf-fanchen-C。',
    )
    throw ttsInitError
  }

  try {
    const vitsConfig = {
      model: config.model,
      lexicon: config.lexicon,
      tokens: config.tokens,
    }
    if (config.dataDir) {
      vitsConfig.dataDir = config.dataDir
    }
    if (config.dictDir) {
      vitsConfig.dictDir = config.dictDir
    }

    const rawInitPromise = sherpa.OfflineTts.createAsync({
      model: { vits: vitsConfig },
      numThreads: 2,
      provider: 'cpu',
      debug: 0,
    })

    // Allow background recovery if timeout fires first but init eventually succeeds.
    rawInitPromise.then((instance) => {
      if (!ttsInstance) {
        ttsInstance = instance
        ttsInitError = null
        ttsInitPromiseInFlight = null
        console.info('[SherpaTTS] OfflineTts ready (background recovery) — sampleRate:', instance.sampleRate)
      }
    }).catch(() => {})

    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('TTS 模型加载超时（30 秒），请检查模型文件是否完整。')), 30_000)
    })

    ttsInitPromiseInFlight = Promise.race([rawInitPromise, timeoutPromise]).then((instance) => {
      clearTimeout(timeoutId)
      ttsInstance = instance
      ttsInitPromiseInFlight = null
      console.info('[SherpaTTS] OfflineTts ready — sampleRate:', instance.sampleRate, 'speakers:', instance.numSpeakers)
      return instance
    }).catch((error) => {
      clearTimeout(timeoutId)
      ttsInitPromiseInFlight = null
      // Only latch permanently for non-timeout errors. Timeout is recoverable.
      if (!error?.message?.includes('超时')) {
        ttsInitError = error
      }
      throw error
    })

    return ttsInitPromiseInFlight
  } catch (error) {
    throw error
  }
}

function buildEnhanceOptions(options) {
  return {
    prependSilenceMs: Number.isFinite(options.leadingSilenceMs) ? options.leadingSilenceMs : 18,
    fadeInMs: Number.isFinite(options.fadeInMs) ? options.fadeInMs : 12,
    fadeOutMs: Number.isFinite(options.fadeOutMs) ? options.fadeOutMs : 6,
    normalizePeak: options.normalizePeak !== false,
  }
}

export function isAvailable() {
  if (!sherpa) return false
  return findVitsModelConfig() !== null
}

export async function ensureReady() {
  return getTts()
}

export async function listVoices() {
  const tts = await getTts()
  const numSpeakers = Math.max(1, Math.trunc(Number(tts?.numSpeakers) || 1))

  return Array.from({ length: numSpeakers }, (_, index) => ({
    id: String(index),
    label: index === 0 ? '默认说话人 (sid 0)' : `说话人 ${index} (sid ${index})`,
    description: index === 0
      ? '本地 Sherpa TTS 当前模型的默认 speaker。'
      : '本地 Sherpa TTS 当前模型可用的 speaker sid。',
  }))
}

async function getTtsAudio(text, options = {}) {
  const tts = await getTts()
  const rawSpeed = Number.isFinite(options.speed) ? options.speed : 1.0
  const speed = Math.max(0.35, Math.min(2.2, rawSpeed * 1.12))
  const sid = normalizeSpeakerId(options.sid, tts.numSpeakers)

  const audio = await tts.generateAsync({
    text,
    sid,
    speed,
    enableExternalBuffer: false,
  })

  console.info('[SherpaTTS] generateAsync done — samples:', audio.samples?.length, 'sampleRate:', tts.sampleRate)

  if (!audio.samples || audio.samples.length === 0) {
    throw new Error('TTS 合成返回了空音频，请检查模型是否支持当前文本。')
  }

  return {
    samples: enhanceSpeechSamples(audio.samples, tts.sampleRate, buildEnhanceOptions(options)),
    sampleRate: tts.sampleRate,
  }
}

export async function synthesizeSamples(text, options = {}) {
  return getTtsAudio(text, options)
}

export async function synthesize(text, options = {}) {
  const { samples, sampleRate } = await getTtsAudio(text, {
    ...options,
    leadingSilenceMs: Number.isFinite(options.leadingSilenceMs) ? options.leadingSilenceMs : 18,
    fadeInMs: Number.isFinite(options.fadeInMs) ? options.fadeInMs : 12,
    fadeOutMs: Number.isFinite(options.fadeOutMs) ? options.fadeOutMs : 8,
  })

  const wav = encodeFloat32ToWav(samples, sampleRate)

  if (process.env.NEXUS_DEBUG_TTS) {
    try {
      fs.writeFileSync(path.join(app.getPath('temp'), 'sherpa-tts-debug.wav'), wav)
      console.info('[SherpaTTS] Debug WAV written to temp/sherpa-tts-debug.wav, size:', wav.length)
    } catch {
      // ignore debug write failures
    }
  }

  return {
    audioBase64: wav.toString('base64'),
    mimeType: 'audio/wav',
  }
}
