/**
 * Nexus portrait-puppet package. One character image, optional expression
 * and part layers. The renderer uses the same speaking / listening / mood
 * slots as Live2D, swapping authored layers when the user supplied them.
 */

export const PORTRAIT_PUPPET_KIND = 'portrait-puppet'
export const PORTRAIT_PUPPET_FORMAT_VERSION = 3
export const PORTRAIT_PUPPET_PROCEDURAL_RENDER_MODE = 'procedural-rig-v1'
export const PORTRAIT_PUPPET_IMAGE_NAME = 'portrait.png'
export const PORTRAIT_PUPPET_IMAGE_GENERATION_PROMPT = `Create one single full-body character portrait for a desktop companion puppet. Front-facing orthographic view, neutral relaxed standing pose, centered vertically, with 10–15% clear margin on every side. Show the complete head and hair silhouette, both eyes open and unobstructed, mouth closed, shoulders, arms, hands, legs, and both feet. Keep arms slightly separated from the torso and keep hair tips, sleeves, clothing hems, and accessories visually separated. Use a transparent alpha background, clean even lighting, crisp readable edges, and a high-resolution 2:3 PNG (recommended 1024×1536 or larger). One character only. Do not crop any body part. Do not add scenery, floor shadows, text, watermark, frame, motion blur, dramatic perspective, tilted camera, props crossing the face or neck, hair covering the eyes or mouth, multiple views, character sheets, expression panels, or extra characters. Preserve the requested character design and art style. The result must be a single clean neutral portrait that Nexus can animate locally with head and hair follow, face parallax, blinking, lip movement, breathing, and cloth motion.`
export const DEFAULT_PORTRAIT_PUPPET_RIG = Object.freeze({
  headX: 0.5,
  headY: 0.16,
  headRadiusX: 0.37,
  headRadiusY: 0.16,
  neckY: 0.3,
  eyeLeftX: 0.4,
  eyeRightX: 0.6,
  eyeY: 0.22,
  eyeRadiusX: 0.072,
  eyeRadiusY: 0.028,
  mouthX: 0.5,
  mouthY: 0.255,
  mouthRadiusX: 0.052,
  mouthRadiusY: 0.018,
  chestY: 0.37,
  waistY: 0.49,
  motionIntensity: 1,
})
export const PORTRAIT_PUPPET_LAYER_KEYS = Object.freeze([
  'idle',
  'listening',
  'speaking',
  'thinking',
  'happy',
  'embarrassed',
  'sleepy',
  'surprised',
  'confused',
  'blink',
  'mouth',
  'head-left',
  'head-right',
])

const LAYER_ALIASES = Object.freeze({
  portrait: 'idle',
  base: 'idle',
  default: 'idle',
  face: 'idle',
  立绘: 'idle',
  smile: 'happy',
  高兴: 'happy',
  笑: 'happy',
  shy: 'embarrassed',
  害羞: 'embarrassed',
  think: 'thinking',
  想: 'thinking',
  listen: 'listening',
  听: 'listening',
  talk: 'speaking',
  speak: 'speaking',
  说: 'speaking',
  困: 'sleepy',
  sleep: 'sleepy',
  surprise: 'surprised',
  惊讶: 'surprised',
  confuse: 'confused',
  困惑: 'confused',
  'eyes-closed': 'blink',
  eyeclosed: 'blink',
  closedeyes: 'blink',
  眨眼: 'blink',
  闭眼: 'blink',
  'mouth-open': 'mouth',
  openmouth: 'mouth',
  张嘴: 'mouth',
  'turn-left': 'head-left',
  'head-turn-left': 'head-left',
  leftturn: 'head-left',
  左转: 'head-left',
  'turn-right': 'head-right',
  'head-turn-right': 'head-right',
  rightturn: 'head-right',
  右转: 'head-right',
})

/**
 * Keep user-authored rig anchors inside conservative normalized bounds.
 * Missing or invalid values fall back to the chibi/full-body portrait preset.
 *
 * @param {unknown} value
 * @returns {typeof DEFAULT_PORTRAIT_PUPPET_RIG}
 */
export function normalizePortraitPuppetRig(value) {
  const source = value && typeof value === 'object' ? value : {}
  const read = (key, min, max) => {
    const candidate = Number(source[key])
    return Number.isFinite(candidate)
      ? Math.min(max, Math.max(min, candidate))
      : DEFAULT_PORTRAIT_PUPPET_RIG[key]
  }

  const headY = read('headY', 0.08, 0.42)
  const neckY = Math.max(headY + 0.06, read('neckY', 0.18, 0.58))
  const chestY = Math.max(neckY + 0.04, read('chestY', 0.25, 0.72))
  const waistY = Math.max(chestY + 0.06, read('waistY', 0.38, 0.84))
  const headX = read('headX', 0.25, 0.75)
  const eyeLeftX = Math.min(headX - 0.035, read('eyeLeftX', 0.16, 0.7))
  const eyeRightX = Math.max(headX + 0.035, read('eyeRightX', 0.3, 0.84))

  return Object.freeze({
    headX,
    headY,
    headRadiusX: read('headRadiusX', 0.12, 0.48),
    headRadiusY: read('headRadiusY', 0.1, 0.38),
    neckY: Math.min(0.58, neckY),
    eyeLeftX,
    eyeRightX,
    eyeY: read('eyeY', Math.max(0.08, headY - 0.12), Math.min(0.48, neckY)),
    eyeRadiusX: read('eyeRadiusX', 0.025, 0.14),
    eyeRadiusY: read('eyeRadiusY', 0.012, 0.07),
    mouthX: read('mouthX', Math.max(0.2, headX - 0.16), Math.min(0.8, headX + 0.16)),
    mouthY: read('mouthY', Math.max(0.1, headY - 0.04), Math.min(0.52, neckY + 0.02)),
    mouthRadiusX: read('mouthRadiusX', 0.018, 0.11),
    mouthRadiusY: read('mouthRadiusY', 0.008, 0.055),
    chestY: Math.min(0.72, chestY),
    waistY: Math.min(0.84, waistY),
    motionIntensity: read('motionIntensity', 0, 1.6),
  })
}

/** @param {unknown} manifest */
export function isPortraitPuppetManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return false
  }
  const kind = String(manifest.kind ?? '').trim()
  return kind === PORTRAIT_PUPPET_KIND || Boolean(String(manifest.portraitPath ?? '').trim())
}

/**
 * Map a file name onto a portrait layer. Unknown names return null so the
 * first leftover image can become the base portrait.
 *
 * @param {string} fileName
 * @returns {string | null}
 */
export function classifyPortraitLayerKey(fileName) {
  const stem = String(fileName ?? '')
    .trim()
    .replace(/\.[^.]+$/u, '')
    .toLowerCase()
    .replace(/[\s_]+/gu, '-')
    .replace(/^\d+-/u, '')
  if (!stem) {
    return null
  }
  if (PORTRAIT_PUPPET_LAYER_KEYS.includes(stem)) {
    return stem
  }
  const compact = stem.replace(/-/gu, '')
  return LAYER_ALIASES[stem] || LAYER_ALIASES[compact] || null
}
