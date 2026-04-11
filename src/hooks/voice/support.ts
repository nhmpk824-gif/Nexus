export type AdaptiveRmsGate = {
  isSpeech: (rms: number) => boolean
  getThreshold: () => number
}

export function createAdaptiveRmsGate(
  baseThreshold: number,
  multiplier = 3.2,
): AdaptiveRmsGate {
  let noiseFloor = Math.max(0.0006, baseThreshold * 0.35)

  return {
    isSpeech(rms: number) {
      const normalizedRms = Number.isFinite(rms) && rms > 0 ? rms : 0
      const threshold = Math.max(baseThreshold, noiseFloor * multiplier)

      if (normalizedRms > 0 && normalizedRms <= threshold * 0.72) {
        noiseFloor = noiseFloor * 0.92 + normalizedRms * 0.08
      }

      return normalizedRms >= threshold
    },
    getThreshold() {
      return Math.max(baseThreshold, noiseFloor * multiplier)
    },
  }
}
