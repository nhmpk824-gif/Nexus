/**
 * RMS-based audio normalization with soft tanh limiter.
 * Ported from tryvoice-oss to ensure consistent TTS playback volume.
 */

const TARGET_RMS = 0.1585
const WINDOW_SIZE = 1600
const SILENCE_THRESHOLD = 0.01
const MIN_GAIN = 0.1
const MAX_GAIN = 6.0
const LIMITER_CEILING = 0.95

export function normalizeAudioSamples(samples: Float32Array): Float32Array {
  if (samples.length < WINDOW_SIZE) return samples

  // 1. Scan windows, accumulate RMS from active (non-silent) regions
  let totalSquared = 0
  let activeCount = 0

  for (let i = 0; i + WINDOW_SIZE <= samples.length; i += WINDOW_SIZE) {
    let winSq = 0
    for (let j = i; j < i + WINDOW_SIZE; j++) {
      winSq += samples[j] * samples[j]
    }
    const winRms = Math.sqrt(winSq / WINDOW_SIZE)
    if (winRms > SILENCE_THRESHOLD) {
      totalSquared += winSq
      activeCount += WINDOW_SIZE
    }
  }

  if (activeCount < 100) return samples

  // 2. Compute and clamp gain
  const activeRms = Math.sqrt(totalSquared / activeCount)
  if (activeRms < 0.001) return samples

  const gain = Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_RMS / activeRms))

  // 3. Apply gain with tanh soft limiter
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] * gain
    if (s > LIMITER_CEILING) {
      out[i] = LIMITER_CEILING + (1 - LIMITER_CEILING) * Math.tanh((s - LIMITER_CEILING) / (1 - LIMITER_CEILING))
    } else if (s < -LIMITER_CEILING) {
      out[i] = -LIMITER_CEILING - (1 - LIMITER_CEILING) * Math.tanh((-s - LIMITER_CEILING) / (1 - LIMITER_CEILING))
    } else {
      out[i] = s
    }
  }

  return out
}
