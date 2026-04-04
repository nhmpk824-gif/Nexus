import { useCallback, useEffect, useRef, useState } from 'react'
import type { Live2DModel as Live2DModelType } from 'pixi-live2d-display/cubism4'
import type { PetMood, PetTouchZone } from '../../../types'
import {
  buildRuntimePetModelDefinition,
  type CubismModelFile,
  type PetModelDefinition,
  type PetExpressionSlot,
} from '../models'
import type { PetPerformanceAccent, PetPerformanceCue } from '../performance'

type PixiRuntime = typeof import('pixi.js')
type PixiApplication = import('pixi.js').Application
type MotionPreloadValue = number | string

type GazeTarget = {
  x: number
  y: number
}

type CubismCoreModel = {
  addParameterValueById?: (parameterId: string, value: number, weight?: number) => void
}

type InternalFocusController = {
  focus: (x: number, y: number, instant?: boolean) => void
}

type InternalEventSource = {
  on?: (eventName: string, handler: () => void) => void
  off?: (eventName: string, handler: () => void) => void
  removeListener?: (eventName: string, handler: () => void) => void
}

type Live2DInternalModel = InternalEventSource & {
  coreModel?: CubismCoreModel
  focusController?: InternalFocusController
}

type Live2DModelHandle = Live2DModelType & {
  anchor?: {
    set: (x: number, y: number) => void
  }
  internalModel?: Live2DInternalModel
}

declare global {
  interface Window {
    PIXI?: PixiRuntime & {
      live2d?: {
        MotionPreloadStrategy?: {
          NONE?: MotionPreloadValue
          IDLE?: MotionPreloadValue
          ALL?: MotionPreloadValue
        }
        Live2DModel?: {
          from: (
            source: string,
            options?: {
              autoInteract?: boolean
              motionPreload?: MotionPreloadValue
            },
          ) => Promise<Live2DModelType>
        }
      }
    }
    Live2DCubismCore?: unknown
    __desktopPetLive2DDebug?: {
      phase?: string
      error?: string | null
      app?: PixiApplication | null
      model?: Live2DModelType | null
    }
  }
}

function resolveAssetPath(relativePath: string) {
  const normalizedPath = relativePath.replace(/^\.\//, '')
  return new URL(normalizedPath, new URL(import.meta.env.BASE_URL, window.location.href)).toString()
}

type Live2DVendorScript = {
  id: string
  globalReady: () => boolean
  src: string
}

const LIVE2D_VENDOR_SCRIPT_ATTRIBUTE = 'data-nexus-live2d-script'
let live2dVendorScriptsPromise: Promise<void> | null = null

function loadClassicScript(descriptor: Live2DVendorScript) {
  if (descriptor.globalReady()) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const selector = `script[${LIVE2D_VENDOR_SCRIPT_ATTRIBUTE}="${descriptor.id}"]`
    const existingScript = document.querySelector<HTMLScriptElement>(selector)

    function resolveIfReady() {
      if (!descriptor.globalReady()) {
        reject(new Error(`Live2D vendor script "${descriptor.id}" loaded without exposing the expected runtime.`))
        return
      }

      resolve()
    }

    function rejectWithLoadError() {
      reject(new Error(`Failed to load Live2D vendor script "${descriptor.id}".`))
    }

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolveIfReady()
        return
      }

      existingScript.addEventListener('load', resolveIfReady, { once: true })
      existingScript.addEventListener('error', rejectWithLoadError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = descriptor.src
    script.async = false
    script.dataset.loaded = 'false'
    script.setAttribute(LIVE2D_VENDOR_SCRIPT_ATTRIBUTE, descriptor.id)
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolveIfReady()
    }, { once: true })
    script.addEventListener('error', rejectWithLoadError, { once: true })
    document.head.appendChild(script)
  })
}

function ensureLive2DVendorScripts() {
  if (
    window.PIXI
    && window.Live2DCubismCore
    && window.PIXI.live2d?.Live2DModel
  ) {
    return Promise.resolve()
  }

  if (live2dVendorScriptsPromise) {
    return live2dVendorScriptsPromise
  }

  const descriptors: Live2DVendorScript[] = [
    {
      id: 'pixi-runtime',
      src: resolveAssetPath('vendor/pixi.min.js'),
      globalReady: () => Boolean(window.PIXI),
    },
    {
      id: 'live2d-cubism-core',
      src: resolveAssetPath('vendor/live2dcubismcore.min.js'),
      globalReady: () => Boolean(window.Live2DCubismCore),
    },
    {
      id: 'pixi-live2d-plugin',
      src: resolveAssetPath('vendor/pixi-live2d-display.cubism4.min.js'),
      globalReady: () => Boolean(window.PIXI?.live2d?.Live2DModel),
    },
  ]

  live2dVendorScriptsPromise = (async () => {
    for (const descriptor of descriptors) {
      await loadClassicScript(descriptor)
    }
  })().catch((error) => {
    live2dVendorScriptsPromise = null
    throw error
  })

  return live2dVendorScriptsPromise
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const MIN_CANVAS_WIDTH = 280
const MIN_CANVAS_HEIGHT = 360
const MODEL_LOAD_TIMEOUT_MS = 15_000
const MOTION_TRIGGER_COOLDOWN_MS = 1500
const BLINK_CLOSE_MS = 88
const BLINK_OPEN_MS = 136
const PERFORMANCE_ACCENT_WINDOW_MS = 1_150

type BlinkState = {
  phaseStartedAt: number
  phase: 'idle' | 'closing' | 'opening'
  nextBlinkAt: number
}

function createBlinkState(): BlinkState {
  return {
    phaseStartedAt: performance.now(),
    phase: 'idle',
    nextBlinkAt: performance.now() + 1_500 + Math.random() * 2_400,
  }
}

function scheduleNextBlink(blinkState: BlinkState) {
  blinkState.phase = 'idle'
  blinkState.phaseStartedAt = performance.now()
  blinkState.nextBlinkAt = blinkState.phaseStartedAt + 2_400 + Math.random() * 3_600
}

function updateBlink(blinkState: BlinkState, now: number) {
  if (blinkState.phase === 'idle' && now >= blinkState.nextBlinkAt) {
    blinkState.phase = 'closing'
    blinkState.phaseStartedAt = now
  }

  if (blinkState.phase === 'closing') {
    const progress = clamp((now - blinkState.phaseStartedAt) / BLINK_CLOSE_MS, 0, 1)
    if (progress >= 1) {
      blinkState.phase = 'opening'
      blinkState.phaseStartedAt = now
    }
    return 1 - progress
  }

  if (blinkState.phase === 'opening') {
    const progress = clamp((now - blinkState.phaseStartedAt) / BLINK_OPEN_MS, 0, 1)
    if (progress >= 1) {
      scheduleNextBlink(blinkState)
    }
    return progress
  }

  return 1
}

function resolveExpressionSlot(
  mood: PetMood,
  touchZone: PetTouchZone | null,
  isListening: boolean,
  isSpeaking: boolean,
  performanceExpressionSlot?: PetExpressionSlot | null,
): PetExpressionSlot {
  if (performanceExpressionSlot) return performanceExpressionSlot
  if (isSpeaking) return 'speaking'
  if (isListening) return 'listening'

  switch (touchZone) {
    case 'head':
      return 'touchHead'
    case 'face':
      return 'touchFace'
    case 'body':
      return 'touchBody'
    default:
      break
  }

  switch (mood) {
    case 'thinking':
      return 'thinking'
    case 'happy':
      return 'happy'
    case 'sleepy':
      return 'sleepy'
    case 'surprised':
      return 'surprised'
    case 'confused':
      return 'confused'
    case 'embarrassed':
      return 'embarrassed'
    default:
      return 'idle'
  }
}

function resolveMotionGroup(
  modelDefinition: PetModelDefinition,
  expressionSlot: PetExpressionSlot,
) {
  switch (expressionSlot) {
    case 'speaking':
      return modelDefinition.motionGroups.speakingStart ?? modelDefinition.motionGroups.interaction
    case 'listening':
      return modelDefinition.motionGroups.listeningStart ?? modelDefinition.motionGroups.interaction
    case 'touchHead':
    case 'touchFace':
    case 'touchBody':
      return modelDefinition.motionGroups.hit ?? modelDefinition.motionGroups.interaction
    case 'idle':
      return modelDefinition.motionGroups.idle
    default:
      return undefined
  }
}

function resolvePerformanceAccentWindowMs(performanceCue: PetPerformanceCue | null) {
  if (!performanceCue) return PERFORMANCE_ACCENT_WINDOW_MS

  return Math.min(
    Math.max(performanceCue.durationMs * 0.72, 900),
    PERFORMANCE_ACCENT_WINDOW_MS * 1.45,
  )
}

type AccentVisualState = {
  gazeX: number
  gazeY: number
  angleZ: number
  bodyAngleX: number
  smileLevel: number
  cheekLevel: number
  browFormLevel: number
  breathLevel: number
}

function applyAccentStyle(options: {
  accentStyle: PetPerformanceAccent
  accentLevel: number
  elapsedMs: number
  pulse: number
  state: AccentVisualState
}) {
  const {
    accentStyle,
    accentLevel,
    elapsedMs,
    pulse,
  } = options
  let {
    gazeX,
    gazeY,
    angleZ,
    bodyAngleX,
    smileLevel,
    cheekLevel,
    browFormLevel,
    breathLevel,
  } = options.state

  const quickPulse = Math.abs(Math.sin(elapsedMs / 1000 * 10.4)) * accentLevel

  switch (accentStyle) {
    case 'peek':
      gazeY = clamp(gazeY - 0.14 * accentLevel, -1, 1)
      angleZ += 2.8 * accentLevel + pulse * 1.8
      bodyAngleX += 4.4 * accentLevel + quickPulse * 2.6
      smileLevel += 0.08 * accentLevel
      break
    case 'search': {
      const scan = Math.sin(elapsedMs / 1000 * 7.4) * accentLevel
      gazeX = clamp(gazeX + scan * 0.8, -1, 1)
      gazeY = clamp(gazeY + 0.16 * accentLevel, -1, 1)
      angleZ += scan * 2.6
      bodyAngleX += scan * 3.8
      browFormLevel -= 0.1 * accentLevel
      breathLevel += 0.04 * accentLevel
      break
    }
    case 'organize': {
      const nod = Math.abs(Math.sin(elapsedMs / 1000 * 8.6)) * accentLevel
      angleZ += pulse * 1.5
      bodyAngleX += nod * 4.4
      smileLevel += 0.14 * accentLevel
      cheekLevel += 0.08 * accentLevel
      breathLevel += 0.06 * accentLevel
      break
    }
    case 'write': {
      const typing = Math.abs(Math.sin(elapsedMs / 1000 * 12.8)) * accentLevel
      gazeX *= 0.38
      gazeY = clamp(gazeY + 0.24 * accentLevel, -1, 1)
      angleZ += pulse * 1.2 - 1.8 * accentLevel
      bodyAngleX += typing * 4.8
      browFormLevel -= 0.08 * accentLevel
      breathLevel += 0.05 * accentLevel
      break
    }
    case 'deliver': {
      const present = Math.sin(elapsedMs / 1000 * 5.2) * accentLevel
      angleZ += 2.2 * accentLevel + present * 1.2
      bodyAngleX += 4.8 * accentLevel + Math.abs(present) * 2.8
      smileLevel += 0.2 * accentLevel
      cheekLevel += 0.12 * accentLevel
      breathLevel += 0.04 * accentLevel
      break
    }
    case 'confirm': {
      const nod = Math.abs(Math.sin(elapsedMs / 1000 * 10.2)) * accentLevel
      angleZ += 1.4 * accentLevel + pulse * 1.4
      bodyAngleX += nod * 5.2
      smileLevel += 0.14 * accentLevel
      cheekLevel += 0.08 * accentLevel
      break
    }
    case 'sparkle':
      gazeY = clamp(gazeY - 0.08 * accentLevel, -1, 1)
      angleZ += 3.2 * accentLevel + pulse * 2.2
      smileLevel += 0.18 * accentLevel
      cheekLevel += 0.18 * accentLevel
      breathLevel += 0.03 * accentLevel
      break
    case 'listen': {
      const lean = Math.sin(elapsedMs / 1000 * 6.5) * accentLevel
      angleZ += lean * 1.6
      bodyAngleX += lean * 2.6
      smileLevel += 0.08 * accentLevel
      break
    }
    case 'shy':
      gazeX *= 0.22
      gazeY = clamp(gazeY + 0.12 * accentLevel, -1, 1)
      angleZ += 2.4 * accentLevel + pulse * 1.6
      smileLevel += 0.14 * accentLevel
      cheekLevel += 0.16 * accentLevel
      break
    default:
      break
  }

  return {
    gazeX,
    gazeY,
    angleZ,
    bodyAngleX,
    smileLevel,
    cheekLevel,
    browFormLevel,
    breathLevel,
  } satisfies AccentVisualState
}

function addParameterValue(coreModel: CubismCoreModel | undefined, parameterId: string | undefined, value: number) {
  if (!coreModel?.addParameterValueById || !parameterId || !Number.isFinite(value) || Math.abs(value) < 0.0001) {
    return
  }

  coreModel.addParameterValueById(parameterId, value)
}

type Live2DCanvasProps = {
  modelDefinition: PetModelDefinition
  mood: PetMood
  touchZone?: PetTouchZone | null
  isSpeaking?: boolean
  isListening?: boolean
  speechLevel?: number
  gazeTarget?: GazeTarget
  performanceCue?: PetPerformanceCue | null
  placement?: 'pet-stage' | 'panel-card'
}

export function Live2DCanvas({
  modelDefinition,
  mood,
  touchZone = null,
  isSpeaking = false,
  isListening = false,
  speechLevel = 0,
  gazeTarget = { x: 0, y: 0 },
  performanceCue = null,
  placement = 'panel-card',
}: Live2DCanvasProps) {
  const resolvedModelPath = resolveAssetPath(modelDefinition.modelPath)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<Live2DModelType | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const cleanupBeforeModelUpdateRef = useRef<(() => void) | null>(null)
  const currentExpressionRef = useRef<string | null>(null)
  const currentExpressionSlotRef = useRef<PetExpressionSlot>('idle')
  const lastMotionKeyRef = useRef('')
  const lastMotionAtRef = useRef(0)
  const blinkStateRef = useRef<BlinkState>(createBlinkState())
  const performanceCueRef = useRef<PetPerformanceCue | null>(null)
  const performanceCueStartedAtRef = useRef(0)
  const speechLevelTargetRef = useRef(clamp(speechLevel, 0, 1))
  const smoothedSpeechLevelRef = useRef(0)
  const smoothedGazeRef = useRef<GazeTarget>({ x: 0, y: 0 })
  const gazeTargetRef = useRef<GazeTarget>({
    x: clamp(gazeTarget.x, -1, 1),
    y: clamp(gazeTarget.y, -1, 1),
  })
  const activeModelDefinitionRef = useRef(buildRuntimePetModelDefinition(modelDefinition))
  const [error, setError] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)

  function setDebugState(partialState: Partial<NonNullable<Window['__desktopPetLive2DDebug']>>) {
    const nextState = {
      phase: 'idle',
      error: null,
      app: null,
      model: null,
      ...window.__desktopPetLive2DDebug,
      ...partialState,
    }

    window.__desktopPetLive2DDebug = nextState
    console.warn(
      `[Live2D] ${nextState.phase ?? 'unknown-phase'}${nextState.error ? `: ${nextState.error}` : ''}`,
    )
  }

  const applyExpression = useCallback((name: string | undefined) => {
    const model = modelRef.current
    if (!model || !name || currentExpressionRef.current === name) return
    currentExpressionRef.current = name
    void model.expression(name)
  }, [])

  const triggerMotion = useCallback((expressionSlot: PetExpressionSlot, options?: { force?: boolean }) => {
    const model = modelRef.current
    if (!model) return

    const motionGroup = resolveMotionGroup(activeModelDefinitionRef.current, expressionSlot)
    if (!motionGroup) return

    const motionKey = `${expressionSlot}:${motionGroup}`
    const now = performance.now()

    if (
      !options?.force
      && (
      lastMotionKeyRef.current === motionKey
      && now - lastMotionAtRef.current < MOTION_TRIGGER_COOLDOWN_MS
      )
    ) {
      return
    }

    lastMotionKeyRef.current = motionKey
    lastMotionAtRef.current = now
    void model.motion(motionGroup).catch((caught) => {
      console.warn('[Live2D] motion-trigger-failed', {
        expressionSlot,
        motionGroup,
        error: caught instanceof Error ? caught.message : String(caught),
      })
    })
  }, [])

  const syncVisualState = useCallback((nextExpressionSlot: PetExpressionSlot) => {
    const previousExpressionSlot = currentExpressionSlotRef.current
    currentExpressionSlotRef.current = nextExpressionSlot

    const expressionMap = activeModelDefinitionRef.current.expressionMap
    const expressionName = expressionMap[nextExpressionSlot] ?? expressionMap.idle

    applyExpression(expressionName)

    if (previousExpressionSlot === nextExpressionSlot) return

    triggerMotion(nextExpressionSlot)
  }, [applyExpression, triggerMotion])

  const layoutModel = useCallback((model: Live2DModelHandle, app: PixiApplication) => {
    const activeModelDefinition = activeModelDefinitionRef.current
    const bounds = model.getLocalBounds()
    const isPetStagePlacement = placement === 'pet-stage'
    const widthRatio = isPetStagePlacement
      ? Math.max(activeModelDefinition.layout?.widthRatio ?? 0.74, 0.9)
      : activeModelDefinition.layout?.widthRatio ?? 0.74
    const heightRatio = isPetStagePlacement
      ? Math.max(activeModelDefinition.layout?.heightRatio ?? 0.84, 0.96)
      : activeModelDefinition.layout?.heightRatio ?? 0.84
    const minWidth = isPetStagePlacement
      ? Math.max(activeModelDefinition.layout?.minWidth ?? 250, 320)
      : activeModelDefinition.layout?.minWidth ?? 250
    const minHeight = isPetStagePlacement
      ? Math.max(activeModelDefinition.layout?.minHeight ?? 360, 520)
      : activeModelDefinition.layout?.minHeight ?? 360

    if (!bounds.width || !bounds.height) {
      throw new Error('Failed to measure the Live2D model.')
    }

    const horizontalInset = isPetStagePlacement ? 12 : 8
    const topInset = isPetStagePlacement
      ? Math.max(
        app.renderer.height * Math.max(activeModelDefinition.layout?.yOffsetRatio ?? 0.03, 0.08),
        Math.max(activeModelDefinition.layout?.yOffsetPx ?? 12, 42),
      )
      : Math.max(
        app.renderer.height * (activeModelDefinition.layout?.yOffsetRatio ?? 0.03),
        activeModelDefinition.layout?.yOffsetPx ?? 12,
      )
    const bottomInset = isPetStagePlacement ? 10 : 6
    const availableWidth = Math.max(app.renderer.width - horizontalInset * 2, 1)
    const availableHeight = Math.max(app.renderer.height - topInset - bottomInset, 1)
    const maxWidth = Math.min(
      Math.max(app.renderer.width * widthRatio, Math.min(minWidth, availableWidth)),
      availableWidth,
    )
    const maxHeight = Math.min(
      Math.max(app.renderer.height * heightRatio, Math.min(minHeight, availableHeight)),
      availableHeight,
    )
    const scale = Math.min(maxWidth / bounds.width, maxHeight / bounds.height)

    model.scale.set(scale)

    const anchorX = clamp(activeModelDefinition.layout?.anchorX ?? 0.5, 0, 1)
    const anchorY = clamp(activeModelDefinition.layout?.anchorY ?? 0, 0, 1)

    if (model.anchor) {
      model.anchor.set(anchorX, anchorY)
    }

    model.x = horizontalInset + availableWidth * anchorX
    model.y = topInset + availableHeight * anchorY

  }, [placement])

  const bindModelRuntime = useCallback((model: Live2DModelType) => {
    const internalModel = (model as Live2DModelHandle).internalModel
    if (!internalModel) return

    const handleBeforeModelUpdate = () => {
      const activeModelDefinition = activeModelDefinitionRef.current
      const coreModel = internalModel.coreModel
      const rigParams = activeModelDefinition.rigParams
      const openParam = activeModelDefinition.mouthParams?.open ?? 'ParamA'
      const roundParam = activeModelDefinition.mouthParams?.round
      const narrowParam = activeModelDefinition.mouthParams?.narrow
      const smileParam = activeModelDefinition.mouthParams?.smile
      const activeExpressionSlot = currentExpressionSlotRef.current
      const now = performance.now()
      const seconds = now / 1000
      const activePerformanceCue = performanceCueRef.current
      const performanceCueElapsedMs = activePerformanceCue
        ? Math.max(0, now - performanceCueStartedAtRef.current)
        : 0
      const performanceCueAccentStyle = activePerformanceCue?.accentStyle
      const performanceCueAccentWindowMs = resolvePerformanceAccentWindowMs(activePerformanceCue)
      const performanceCueAccent = activePerformanceCue
        ? clamp(1 - performanceCueElapsedMs / performanceCueAccentWindowMs, 0, 1)
        : 0
      const performanceCuePulse = performanceCueAccent > 0
        ? Math.sin(performanceCueElapsedMs / 1000 * 12.5) * performanceCueAccent
        : 0

      const targetGazeX = clamp(gazeTargetRef.current.x, -1, 1)
      const targetGazeY = clamp(gazeTargetRef.current.y, -1, 1)
      const gazeInterpolation = activeExpressionSlot === 'thinking' ? 0.08 : 0.16
      smoothedGazeRef.current = {
        x: smoothedGazeRef.current.x + (targetGazeX - smoothedGazeRef.current.x) * gazeInterpolation,
        y: smoothedGazeRef.current.y + (targetGazeY - smoothedGazeRef.current.y) * gazeInterpolation,
      }

      let gazeX = smoothedGazeRef.current.x
      let gazeY = smoothedGazeRef.current.y
      let angleZ = Math.sin(seconds * 0.95) * 0.65
      let bodyAngleX = Math.sin(seconds * 0.82) * 0.55 + gazeX * 1.9
      const bodyAngleY = 0
      let smileLevel = 0
      let cheekLevel = 0
      let browFormLevel = 0
      let breathLevel = 0.22 + (Math.sin(seconds * 2.1) + 1) * 0.1

      switch (activeExpressionSlot) {
        case 'listening':
          angleZ += Math.sin(seconds * 3.4) * 0.9
          bodyAngleX += gazeX * 1.8
          smileLevel += 0.08
          breathLevel += 0.06
          break
        case 'thinking':
          gazeX *= 0.35
          gazeY = clamp(gazeY + 0.18, -1, 1)
          angleZ += Math.sin(seconds * 1.8) * 2.4
          bodyAngleX += Math.sin(seconds * 0.9) * 1.15
          browFormLevel -= 0.18
          breathLevel -= 0.04
          break
        case 'speaking':
          angleZ += Math.sin(seconds * 5.8) * 0.9
          bodyAngleX += Math.sin(seconds * 4.9) * 0.95
          smileLevel += 0.14 + clamp(speechLevelTargetRef.current, 0, 1) * 0.22
          cheekLevel += clamp(speechLevelTargetRef.current, 0, 1) * 0.06
          breathLevel += 0.08
          break
        case 'happy':
          angleZ += 1.8
          smileLevel += 0.18
          cheekLevel += 0.1
          breathLevel += 0.04
          break
        case 'sleepy':
          gazeX *= 0.45
          gazeY = clamp(gazeY + 0.26, -1, 1)
          angleZ += Math.sin(seconds * 0.66) * 1.15
          bodyAngleX *= 0.58
          breathLevel -= 0.08
          smileLevel -= 0.05
          break
        case 'touchHead':
          angleZ += 2.1
          gazeY = clamp(gazeY - 0.2, -1, 1)
          smileLevel += 0.16
          cheekLevel += 0.1
          break
        case 'touchFace':
          angleZ += Math.sin(seconds * 7.2) * 0.6
          gazeX *= 0.28
          smileLevel += 0.19
          cheekLevel += 0.12
          break
        case 'touchBody':
          angleZ += 1.3
          bodyAngleX += gazeX * 2.2
          smileLevel += 0.1
          break
        case 'surprised':
          gazeY = clamp(gazeY - 0.15, -1, 1)
          angleZ += Math.sin(seconds * 6.2) * 1.6
          breathLevel += 0.12
          browFormLevel += 0.22
          break
        case 'confused':
          gazeX *= 0.5
          gazeY = clamp(gazeY + 0.12, -1, 1)
          angleZ += Math.sin(seconds * 1.4) * 3.2
          bodyAngleX += Math.sin(seconds * 0.7) * 1.4
          browFormLevel -= 0.24
          breathLevel -= 0.02
          break
        case 'embarrassed':
          gazeX *= 0.3
          gazeY = clamp(gazeY + 0.2, -1, 1)
          angleZ += 2.6
          smileLevel += 0.12
          cheekLevel += 0.18
          breathLevel += 0.06
          break
        case 'idle':
        default:
          break
      }

      if (performanceCueAccent > 0) {
        breathLevel += 0.05 * performanceCueAccent

        switch (activeExpressionSlot) {
          case 'happy':
            angleZ += 4.8 * performanceCueAccent + performanceCuePulse * 2.4
            bodyAngleX += performanceCuePulse * 4.2
            smileLevel += 0.24 * performanceCueAccent
            cheekLevel += 0.16 * performanceCueAccent
            break
          case 'thinking':
            gazeY = clamp(gazeY + 0.12 * performanceCueAccent, -1, 1)
            angleZ += 3.4 * performanceCueAccent + performanceCuePulse * 2.2
            bodyAngleX += performanceCuePulse * 3
            browFormLevel -= 0.12 * performanceCueAccent
            break
          case 'listening':
            angleZ += performanceCuePulse * 2
            bodyAngleX += performanceCuePulse * 2.8
            smileLevel += 0.1 * performanceCueAccent
            break
          case 'touchHead':
            angleZ += 5.1 * performanceCueAccent + performanceCuePulse * 2.8
            bodyAngleX += performanceCuePulse * 4.8
            smileLevel += 0.18 * performanceCueAccent
            cheekLevel += 0.16 * performanceCueAccent
            break
          case 'touchFace':
            gazeX *= 0.18
            angleZ += performanceCuePulse * 2.4
            bodyAngleX += performanceCuePulse * 2.4
            smileLevel += 0.22 * performanceCueAccent
            cheekLevel += 0.18 * performanceCueAccent
            break
          case 'touchBody':
            angleZ += 2.8 * performanceCueAccent + performanceCuePulse * 2
            bodyAngleX += performanceCuePulse * 4.8
            smileLevel += 0.12 * performanceCueAccent
            break
          case 'sleepy':
            angleZ += performanceCuePulse * 0.8
            breathLevel -= 0.04 * performanceCueAccent
            break
          case 'speaking':
            angleZ += performanceCuePulse * 1.4
            bodyAngleX += performanceCuePulse * 1.8
            break
          case 'idle':
          default:
            break
        }

        if (performanceCueAccentStyle) {
          ({
            gazeX,
            gazeY,
            angleZ,
            bodyAngleX,
            smileLevel,
            cheekLevel,
            browFormLevel,
            breathLevel,
          } = applyAccentStyle({
            accentStyle: performanceCueAccentStyle,
            accentLevel: performanceCueAccent,
            elapsedMs: performanceCueElapsedMs,
            pulse: performanceCuePulse,
            state: {
              gazeX,
              gazeY,
              angleZ,
              bodyAngleX,
              smileLevel,
              cheekLevel,
              browFormLevel,
              breathLevel,
            },
          }))
        }
      }

      internalModel.focusController?.focus(gazeX, gazeY)

      if (!coreModel?.addParameterValueById) return

      const targetSpeechLevel = clamp(speechLevelTargetRef.current, 0, 1)
      smoothedSpeechLevelRef.current += (targetSpeechLevel - smoothedSpeechLevelRef.current) * (
        targetSpeechLevel > smoothedSpeechLevelRef.current ? 0.34 : 0.2
      )

      const mouthLevel = smoothedSpeechLevelRef.current < 0.015 ? 0 : smoothedSpeechLevelRef.current

      addParameterValue(coreModel, openParam, mouthLevel * 0.95)
      addParameterValue(coreModel, roundParam, mouthLevel * 0.24)
      addParameterValue(coreModel, narrowParam, mouthLevel * 0.08)
      addParameterValue(coreModel, smileParam, smileLevel)
      addParameterValue(coreModel, rigParams?.angleX, gazeX * 18)
      addParameterValue(coreModel, rigParams?.angleY, gazeY * -12)
      addParameterValue(coreModel, rigParams?.angleZ, angleZ)
      addParameterValue(coreModel, rigParams?.bodyAngleX, bodyAngleX)
      addParameterValue(coreModel, rigParams?.bodyAngleY, bodyAngleY)
      addParameterValue(coreModel, rigParams?.eyeBallX, gazeX)
      addParameterValue(coreModel, rigParams?.eyeBallY, gazeY)
      addParameterValue(coreModel, rigParams?.browForm, browFormLevel)
      addParameterValue(coreModel, rigParams?.cheek, cheekLevel)
      addParameterValue(coreModel, rigParams?.breath, breathLevel)

      let eyeOpen = updateBlink(blinkStateRef.current, now)
      if (activeExpressionSlot === 'thinking') {
        eyeOpen *= 0.9
      }
      if (activeExpressionSlot === 'sleepy') {
        eyeOpen *= 0.72
      }
      if (performanceCueAccentStyle === 'sparkle') {
        eyeOpen = clamp(eyeOpen + performanceCueAccent * 0.16, 0, 1.12)
      }
      if (performanceCueAccentStyle === 'write') {
        eyeOpen *= 0.94
      }

      addParameterValue(coreModel, rigParams?.eyeLOpen, eyeOpen - 1)
      addParameterValue(coreModel, rigParams?.eyeROpen, eyeOpen - 1)
    }

    internalModel.on?.('beforeModelUpdate', handleBeforeModelUpdate)
    cleanupBeforeModelUpdateRef.current = () => {
      internalModel.off?.('beforeModelUpdate', handleBeforeModelUpdate)
      internalModel.removeListener?.('beforeModelUpdate', handleBeforeModelUpdate)
    }
  }, [])

  useEffect(() => {
    activeModelDefinitionRef.current = buildRuntimePetModelDefinition(modelDefinition)
  }, [modelDefinition])

  useEffect(() => {
    if (!modelReady) return

    const nextSlot = resolveExpressionSlot(
      mood,
      touchZone,
      isListening,
      isSpeaking,
      performanceCue?.expressionSlot,
    )

    // Apply expression immediately (lightweight, no animation jerk)
    const expressionMap = activeModelDefinitionRef.current.expressionMap
    const expressionName = expressionMap[nextSlot] ?? expressionMap.idle
    applyExpression(expressionName)

    // Debounce motion triggers to prevent rapid state transitions
    // (listening→thinking→speaking) from causing twitchy animations
    const timerId = window.setTimeout(() => {
      syncVisualState(resolveExpressionSlot(
        mood,
        touchZone,
        isListening,
        isSpeaking,
        performanceCue?.expressionSlot,
      ))
    }, 120)

    return () => window.clearTimeout(timerId)
  }, [
    applyExpression,
    isListening,
    isSpeaking,
    modelReady,
    mood,
    performanceCue,
    syncVisualState,
    touchZone,
  ])

  useEffect(() => {
    if (!modelReady || !performanceCue) return

    // Let syncVisualState handle expression; only force-trigger if motionSlot
    // differs from the expression slot to avoid double-triggering the same motion.
    const motionSlot = performanceCue.motionSlot
    if (motionSlot && motionSlot !== performanceCue.expressionSlot) {
      triggerMotion(motionSlot, { force: true })
    }
  }, [modelReady, performanceCue, triggerMotion])

  useEffect(() => {
    performanceCueRef.current = performanceCue
    performanceCueStartedAtRef.current = performanceCue ? performance.now() : 0
  }, [performanceCue])

  useEffect(() => {
    let disposed = false

    async function boot() {
      if (!containerRef.current) return

      async function loadModelWithRetry(
        Live2DModelCtor: {
          from: (
            source: string,
            options?: {
              autoInteract?: boolean
              motionPreload?: MotionPreloadValue
            },
          ) => Promise<Live2DModelType>
        },
      ) {
        let lastError: unknown = null

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            setDebugState({ phase: `loading-model-${attempt}` })

            if (attempt > 1) {
              await new Promise((resolve) => window.setTimeout(resolve, attempt * 300))
            } else {
              await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)))
            }

            const model = await Promise.race([
              Live2DModelCtor.from(resolvedModelPath, {
                autoInteract: false,
                motionPreload: window.PIXI?.live2d?.MotionPreloadStrategy?.NONE ?? 'NONE',
              }),
              new Promise<never>((_resolve, reject) => {
                window.setTimeout(() => reject(new Error('Live2D model load timed out.')), MODEL_LOAD_TIMEOUT_MS)
              }),
            ])

            return model
          } catch (caught) {
            lastError = caught
            setDebugState({
              phase: `loading-model-retry-${attempt}`,
              error: caught instanceof Error ? caught.message : 'unknown-error',
            })
          }
        }

        throw lastError instanceof Error ? lastError : new Error('Live2D model failed to initialize.')
      }

      try {
        setDebugState({ phase: 'booting', error: null, app: null, model: null })
        setError(null)
        setModelReady(false)
        currentExpressionRef.current = null
        activeModelDefinitionRef.current = buildRuntimePetModelDefinition(modelDefinition)

        await ensureLive2DVendorScripts()

        try {
          const modelResponse = await fetch(resolvedModelPath)
          if (modelResponse.ok) {
            const modelFile = (await modelResponse.json()) as CubismModelFile
            activeModelDefinitionRef.current = buildRuntimePetModelDefinition(modelDefinition, modelFile)
          }
        } catch {
          activeModelDefinitionRef.current = buildRuntimePetModelDefinition(modelDefinition)
        }

        const pixiRuntime = window.PIXI
        if (!pixiRuntime) {
          throw new Error('PIXI runtime is not available.')
        }
        if (!window.Live2DCubismCore) {
          throw new Error('Live2D Cubism Core is not available.')
        }

        setDebugState({ phase: 'module-importing' })
        const Live2DModel = pixiRuntime.live2d?.Live2DModel
        if (!Live2DModel) {
          throw new Error('Live2D Pixi plugin is not available.')
        }

        setDebugState({ phase: 'app-creating' })
        const app = new pixiRuntime.Application({
          autoStart: true,
          resizeTo: containerRef.current,
          backgroundAlpha: 0,
          antialias: true,
        })

        appRef.current = app
        containerRef.current.appendChild(app.view as HTMLCanvasElement)

        const { width, height } = containerRef.current.getBoundingClientRect()
        app.renderer.resize(Math.max(width, MIN_CANVAS_WIDTH), Math.max(height, MIN_CANVAS_HEIGHT))

        const model = await loadModelWithRetry(Live2DModel)
        if (disposed) {
          model.destroy()
          return
        }

        modelRef.current = model
        app.stage.addChild(model)
        app.renderer.render(app.stage)
        setDebugState({ phase: 'model-ready', error: null, app, model })

        layoutModel(model as Live2DModelHandle, app)
        bindModelRuntime(model)
        app.renderer.render(app.stage)
        setModelReady(true)
        blinkStateRef.current = createBlinkState()
        smoothedGazeRef.current = { x: 0, y: 0 }

        resizeObserverRef.current = new ResizeObserver(() => {
          const activeContainer = containerRef.current
          const activeApp = appRef.current
          const activeModel = modelRef.current

          if (!activeContainer || !activeApp || !activeModel) return

          const nextBounds = activeContainer.getBoundingClientRect()
          activeApp.renderer.resize(
            Math.max(nextBounds.width, MIN_CANVAS_WIDTH),
            Math.max(nextBounds.height, MIN_CANVAS_HEIGHT),
          )
          layoutModel(activeModel as Live2DModelHandle, activeApp)
        })

        resizeObserverRef.current.observe(containerRef.current)
      } catch (caught) {
        console.error('Live2D boot failed:', caught)
        setDebugState({
          phase: 'boot-failed',
          error: caught instanceof Error ? caught.message : 'Live2D failed to load.',
        })
        setError(caught instanceof Error ? caught.message : 'Live2D failed to load.')
        setModelReady(false)
      }
    }

    void boot()

    return () => {
      disposed = true
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      cleanupBeforeModelUpdateRef.current?.()
      cleanupBeforeModelUpdateRef.current = null
      modelRef.current?.destroy()
      appRef.current?.destroy(true, { children: true, texture: false, baseTexture: false })
      modelRef.current = null
      appRef.current = null
      currentExpressionRef.current = null
      currentExpressionSlotRef.current = 'idle'
      lastMotionKeyRef.current = ''
      lastMotionAtRef.current = 0
      performanceCueRef.current = null
      performanceCueStartedAtRef.current = 0
      smoothedGazeRef.current = { x: 0, y: 0 }
      blinkStateRef.current = createBlinkState()
      setModelReady(false)
      window.__desktopPetLive2DDebug = {
        phase: 'destroyed',
        error: null,
        app: null,
        model: null,
      }
    }
  }, [
    bindModelRuntime,
    layoutModel,
    modelDefinition,
    resolvedModelPath,
  ])

  useEffect(() => {
    speechLevelTargetRef.current = clamp(speechLevel, 0, 1)
  }, [speechLevel])

  useEffect(() => {
    gazeTargetRef.current = {
      x: clamp(gazeTarget.x, -1, 1),
      y: clamp(gazeTarget.y, -1, 1),
    }
  }, [gazeTarget.x, gazeTarget.y])

  return (
    <div className="live2d-shell">
      <div ref={containerRef} className={`live2d-canvas ${modelReady ? 'is-ready' : ''}`} />
      {error ? <div className="live2d-fallback">{error}</div> : null}
    </div>
  )
}
