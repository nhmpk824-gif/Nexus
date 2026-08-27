import { useEffect, useMemo, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.ts'
import type { PetMood, PetTouchZone, SpeechLevelSource } from '../../../types/index.ts'
import { useSpeechLevelSnapshot } from '../../../hooks/voice/speechLevelPublishing.ts'
import type { GazeTarget } from './live2d/types.ts'
import { resolveAssetPath } from './live2d/types.ts'
import type { PetPerformanceCue } from '../performance.ts'
import {
  applyPortraitPuppetDebugPose,
  interpolatePortraitPuppetPose,
  planPortraitPuppetPose,
  resolvePortraitPuppetExpression,
  resolvePortraitPuppetFaceImage,
  type PortraitPuppetDefinition,
  type PortraitPuppetInput,
  type PortraitPuppetPose,
} from '../portraitPuppet.ts'
import {
  createPortraitPuppetPhysicsState,
  stepPortraitPuppetPhysics,
} from '../portraitPuppetPhysics.ts'
import {
  createPortraitPuppetProceduralPalette,
  createPortraitPuppetMesh,
  drawPortraitPuppetFrame,
  loadPortraitPuppetImage,
  type PortraitPuppetRenderAssets,
} from '../portraitPuppetRenderer.ts'
import { resolvePortraitPuppetPerformanceElapsedMs } from '../portraitPuppetActions.ts'
import { PortraitPuppetV4Canvas } from './PortraitPuppetV4Canvas.tsx'

type PortraitPuppetCanvasProps = {
  puppet: PortraitPuppetDefinition
  mood: PetMood
  isSpeaking?: boolean
  isListening?: boolean
  isBusy?: boolean
  touchZone?: PetTouchZone | null
  speechLevelSource?: SpeechLevelSource
  gazeTarget?: GazeTarget
  performanceCue?: PetPerformanceCue | null
  placement?: 'pet-stage' | 'panel-card'
  label?: string
}

const EMPTY_SPEECH_LEVEL_SOURCE: SpeechLevelSource = {
  current: 0,
  getSnapshot: () => 0,
  subscribe: () => () => undefined,
}

export function PortraitPuppetCanvas(props: PortraitPuppetCanvasProps) {
  if (props.puppet.layeredRig) {
    return (
      <PortraitPuppetV4Canvas
        {...props}
        manifest={props.puppet.layeredRig}
        fallbackImagePath={props.puppet.imagePath}
      />
    )
  }
  return <LegacyPortraitPuppetCanvas {...props} />
}

function LegacyPortraitPuppetCanvas({
  puppet,
  mood,
  isSpeaking = false,
  isListening = false,
  isBusy = false,
  touchZone = null,
  speechLevelSource,
  gazeTarget = { x: 0, y: 0 },
  performanceCue = null,
  placement = 'panel-card',
  label = 'Nexus portrait pet',
}: PortraitPuppetCanvasProps) {
  const subscribedSpeechLevel = useSpeechLevelSnapshot(
    speechLevelSource ?? EMPTY_SPEECH_LEVEL_SOURCE,
  )
  const prefersReducedMotion = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const poseRef = useRef<PortraitPuppetPose | null>(null)
  const physicsRef = useRef(createPortraitPuppetPhysicsState())
  const drawOnceRef = useRef<((timestamp: number) => void) | null>(null)
  const inputRef = useRef<PortraitPuppetInput>({ mood })
  const performanceCueIdRef = useRef('')
  const performanceCueStartedAtRef = useRef(0)
  const [assets, setAssets] = useState<PortraitPuppetRenderAssets | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  const expression = resolvePortraitPuppetExpression({
    mood,
    isSpeaking,
    isListening,
    isBusy,
    touchZone,
    performanceCue,
  })
  const isProcedural = puppet.renderMode === 'procedural-rig-v1'
    || Number(puppet.formatVersion) >= 3
  const facePath = resolveAssetPath(resolvePortraitPuppetFaceImage(puppet, expression))
  const blinkPath = !isProcedural && puppet.layers?.blink ? resolveAssetPath(puppet.layers.blink) : ''
  const mouthPath = !isProcedural && puppet.layers?.mouth ? resolveAssetPath(puppet.layers.mouth) : ''
  const headLeftPath = !isProcedural && puppet.layers?.['head-left']
    ? resolveAssetPath(puppet.layers['head-left'])
    : ''
  const headRightPath = !isProcedural && puppet.layers?.['head-right']
    ? resolveAssetPath(puppet.layers['head-right'])
    : ''
  const layerMode = isProcedural
    ? 'procedural-v3' as const
    : Number(puppet.formatVersion) >= 2
      ? 'rig-v2-overlay' as const
      : 'legacy-full-frame' as const
  const mesh = useMemo(() => createPortraitPuppetMesh(puppet.rig), [puppet.rig])

  useEffect(() => {
    const cueId = performanceCue?.id ?? ''
    if (cueId !== performanceCueIdRef.current) {
      performanceCueIdRef.current = cueId
      performanceCueStartedAtRef.current = performanceCue ? performance.now() : 0
    }
    inputRef.current = {
      mood,
      isSpeaking,
      isListening,
      isBusy,
      speechLevel: isSpeaking ? subscribedSpeechLevel : 0,
      gazeX: gazeTarget.x,
      gazeY: gazeTarget.y,
      touchZone,
      performanceCue,
      prefersReducedMotion,
    }
  }, [
    gazeTarget.x,
    gazeTarget.y,
    isBusy,
    isListening,
    isSpeaking,
    mood,
    performanceCue,
    prefersReducedMotion,
    subscribedSpeechLevel,
    touchZone,
  ])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadPortraitPuppetImage(facePath),
      blinkPath ? loadPortraitPuppetImage(blinkPath) : Promise.resolve(null),
      mouthPath ? loadPortraitPuppetImage(mouthPath) : Promise.resolve(null),
      headLeftPath ? loadPortraitPuppetImage(headLeftPath) : Promise.resolve(null),
      headRightPath ? loadPortraitPuppetImage(headRightPath) : Promise.resolve(null),
    ]).then(([base, blink, mouth, headLeft, headRight]) => {
      if (cancelled) return
      setAssets({
        base,
        blink,
        mouth,
        headLeft,
        headRight,
        layerMode,
        ...(layerMode === 'procedural-v3'
          ? { proceduralPalette: createPortraitPuppetProceduralPalette(base, puppet.rig) }
          : {}),
      })
      setImageLoadFailed(false)
    }).catch(() => {
      if (cancelled) return
      setImageLoadFailed(true)
    })

    return () => {
      cancelled = true
    }
  }, [blinkPath, facePath, headLeftPath, headRightPath, layerMode, mouthPath, puppet.rig])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    const context = canvas.getContext('2d')
    if (!context) return

    let frameId: number | null = null
    let previousTimestamp = 0
    let disposed = false
    physicsRef.current = createPortraitPuppetPhysicsState()

    const draw = (timestamp: number) => {
      if (disposed) return
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return
      const deviceScale = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(bounds.width * deviceScale))
      const height = Math.max(1, Math.round(bounds.height * deviceScale))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      const target = planPortraitPuppetPose({
        ...inputRef.current,
        nowMs: timestamp,
        performanceElapsedMs: resolvePortraitPuppetPerformanceElapsedMs(
          inputRef.current.performanceCue,
          performanceCueStartedAtRef.current,
          timestamp,
        ),
      })
      const previous = poseRef.current
      const deltaMs = previousTimestamp > 0 ? timestamp - previousTimestamp : 16
      const physical = stepPortraitPuppetPhysics(physicsRef.current, target, deltaMs)
      const interpolated = !previous || prefersReducedMotion
        ? target
        : interpolatePortraitPuppetPose(previous, target, deltaMs)
      const physicalPose = prefersReducedMotion ? interpolated : {
        ...interpolated,
        ...physical,
      }
      const pose = applyPortraitPuppetDebugPose(physicalPose, window.location.search)
      poseRef.current = pose
      previousTimestamp = timestamp
      canvas.dataset.portraitExpression = pose.expression
      canvas.dataset.portraitBlink = pose.blink.toFixed(3)
      canvas.dataset.portraitHeadYaw = pose.headYaw.toFixed(3)
      canvas.dataset.portraitMouth = pose.mouth.toFixed(3)
      canvas.dataset.portraitBreath = pose.breath.toFixed(3)
      canvas.dataset.portraitBodyLean = pose.bodyLean.toFixed(3)
      canvas.dataset.portraitArmSway = pose.armSway.toFixed(3)
      canvas.dataset.portraitHairSway = pose.hairSway.toFixed(3)
      canvas.dataset.portraitClothSway = pose.clothSway.toFixed(3)
      canvas.dataset.portraitPendantSway = pose.pendantSway.toFixed(3)
      drawPortraitPuppetFrame(context, assets, mesh, pose, width, height, puppet.rig)
    }
    drawOnceRef.current = draw

    const tick = (timestamp: number) => {
      if (disposed) return
      draw(timestamp)
      frameId = window.requestAnimationFrame(tick)
    }
    const start = () => {
      if (disposed || prefersReducedMotion || document.visibilityState === 'hidden') return
      if (frameId === null) frameId = window.requestAnimationFrame(tick)
    }
    const stop = () => {
      if (frameId === null) return
      window.cancelAnimationFrame(frameId)
      frameId = null
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop()
      else {
        physicsRef.current = createPortraitPuppetPhysicsState()
        previousTimestamp = 0
        start()
      }
    }

    if (prefersReducedMotion) draw(performance.now())
    else start()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (drawOnceRef.current === draw) drawOnceRef.current = null
    }
  }, [assets, mesh, prefersReducedMotion, puppet.rig])

  useEffect(() => {
    if (!prefersReducedMotion) return
    const frameId = window.requestAnimationFrame((timestamp) => drawOnceRef.current?.(timestamp))
    return () => window.cancelAnimationFrame(frameId)
  }, [
    gazeTarget.x,
    gazeTarget.y,
    isBusy,
    isListening,
    isSpeaking,
    mood,
    performanceCue,
    prefersReducedMotion,
    subscribedSpeechLevel,
  ])

  return (
    <div className={`portrait-puppet-shell portrait-puppet-shell--${placement}`}>
      <div
        className="portrait-puppet"
        role="img"
        aria-label={label}
        data-portrait-expression={expression}
        data-portrait-renderer={isProcedural ? 'procedural-mesh-2d' : 'mesh-2d'}
        data-portrait-generator={isProcedural ? 'local-deterministic' : undefined}
        data-portrait-layer-mode={layerMode}
        data-portrait-authored-blink={blinkPath ? 'true' : undefined}
        data-portrait-authored-mouth={mouthPath ? 'true' : undefined}
        data-portrait-authored-turn={headLeftPath && headRightPath ? 'true' : undefined}
      >
        <canvas ref={canvasRef} className="portrait-puppet__canvas" aria-hidden="true" />
        {!assets || imageLoadFailed ? (
          <img className="portrait-puppet__fallback" src={facePath} alt="" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  )
}
