import { useEffect, useRef, useState } from 'react'

import type { PortraitPuppetV4Manifest } from '../../../../shared/portraitPuppetV4Contract.js'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion.ts'
import { useSpeechLevelSnapshot } from '../../../hooks/voice/speechLevelPublishing.ts'
import type { PetMood, PetTouchZone, SpeechLevelSource } from '../../../types/index.ts'
import {
  applyPortraitPuppetDebugPose,
  planPortraitPuppetPose,
  resolvePortraitPuppetExpression,
  type PortraitPuppetInput,
} from '../portraitPuppet.ts'
import {
  createPortraitPuppetV4MotionState,
  planPortraitPuppetV4Motion,
} from '../portraitPuppetV4Motion.ts'
import {
  createPortraitPuppetV4Runtime,
  stepPortraitPuppetV4Runtime,
} from '../portraitPuppetV4Runtime.ts'
import { resolvePortraitPuppetPerformanceElapsedMs } from '../portraitPuppetActions.ts'
import type { PetPerformanceCue } from '../performance.ts'
import { resolveAssetPath, type GazeTarget } from './live2d/types.ts'
import { loadPortraitPuppetImage } from '../portraitPuppetRenderer.ts'
import {
  drawPortraitPuppetV4Frame,
  type PortraitPuppetV4RenderAssets,
} from './portraitPuppetV4Renderer.ts'

type PortraitPuppetV4CanvasProps = {
  manifest: PortraitPuppetV4Manifest
  fallbackImagePath: string
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

export function PortraitPuppetV4Canvas({
  manifest,
  fallbackImagePath,
  mood,
  isSpeaking = false,
  isListening = false,
  isBusy = false,
  touchZone = null,
  speechLevelSource,
  gazeTarget = { x: 0, y: 0 },
  performanceCue = null,
  placement = 'panel-card',
  label = 'Nexus layered portrait pet',
}: PortraitPuppetV4CanvasProps) {
  const subscribedSpeechLevel = useSpeechLevelSnapshot(
    speechLevelSource ?? EMPTY_SPEECH_LEVEL_SOURCE,
  )
  const prefersReducedMotion = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inputRef = useRef<PortraitPuppetInput>({ mood })
  const performanceCueIdRef = useRef('')
  const performanceCueStartedAtRef = useRef(0)
  const runtimeRef = useRef(createPortraitPuppetV4Runtime(manifest))
  const motionStateRef = useRef(createPortraitPuppetV4MotionState())
  const drawOnceRef = useRef<((timestamp: number) => void) | null>(null)
  const [assets, setAssets] = useState<PortraitPuppetV4RenderAssets | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

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
    runtimeRef.current = createPortraitPuppetV4Runtime(manifest)
    motionStateRef.current = createPortraitPuppetV4MotionState()
    const loadEntries = async (entries: Array<{ id: string; path: string }>) => Object.fromEntries(
      await Promise.all(entries.map(async (entry) => [
        entry.id,
        await loadPortraitPuppetImage(resolveAssetPath(entry.path)),
      ])),
    )
    void Promise.all([
      loadEntries(manifest.parts),
      loadEntries(manifest.masks),
    ]).then(([parts, masks]) => {
      if (cancelled) return
      setAssets({ parts, masks })
      setImageLoadFailed(false)
    }).catch(() => {
      if (cancelled) return
      setAssets(null)
      setImageLoadFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [manifest])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    const context = canvas.getContext('2d')
    if (!context) return

    let frameId: number | null = null
    let previousTimestamp = 0
    let disposed = false

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

      const frameInput = {
        ...inputRef.current,
        nowMs: timestamp,
        performanceElapsedMs: resolvePortraitPuppetPerformanceElapsedMs(
          inputRef.current.performanceCue,
          performanceCueStartedAtRef.current,
          timestamp,
        ),
      }
      let motion = planPortraitPuppetV4Motion(frameInput, motionStateRef.current)
      if (new URLSearchParams(window.location.search).get('portraitDebug') === '1') {
        const debugPose = applyPortraitPuppetDebugPose(
          planPortraitPuppetPose(frameInput),
          window.location.search,
        )
        motion = {
          ...motion,
          headYaw: debugPose.headYaw,
          headPitch: debugPose.eyeY * 0.42,
          headTilt: debugPose.headTilt / 7,
          eyeX: debugPose.eyeX,
          eyeY: debugPose.eyeY,
          blinkLeft: debugPose.blink,
          blinkRight: debugPose.blink,
          mouthOpen: debugPose.mouth,
        }
      }
      const deltaMs = previousTimestamp > 0 ? timestamp - previousTimestamp : 16
      previousTimestamp = timestamp
      const parameters = stepPortraitPuppetV4Runtime(
        runtimeRef.current,
        motion,
        prefersReducedMotion ? 100 : deltaMs,
      )
      canvas.dataset.portraitExpression = resolvePortraitPuppetExpression(frameInput)
      canvas.dataset.portraitBlink = (motion.blinkLeft ?? 0).toFixed(3)
      canvas.dataset.portraitHeadYaw = (motion.headYaw ?? 0).toFixed(3)
      canvas.dataset.portraitMouth = (motion.mouthOpen ?? 0).toFixed(3)
      canvas.dataset.portraitHairSway = (parameters.ParamHairSway ?? 0).toFixed(3)
      drawPortraitPuppetV4Frame(context, assets, manifest, parameters, width, height)
    }
    drawOnceRef.current = draw

    const tick = (timestamp: number) => {
      if (disposed) return
      draw(timestamp)
      frameId = window.requestAnimationFrame(tick)
    }
    const stop = () => {
      if (frameId === null) return
      window.cancelAnimationFrame(frameId)
      frameId = null
    }
    const start = () => {
      if (disposed || prefersReducedMotion || document.visibilityState === 'hidden') return
      if (frameId === null) frameId = window.requestAnimationFrame(tick)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop()
      else {
        previousTimestamp = 0
        runtimeRef.current = createPortraitPuppetV4Runtime(manifest)
        motionStateRef.current = createPortraitPuppetV4MotionState()
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
  }, [assets, manifest, prefersReducedMotion])

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
    touchZone,
  ])

  const fallbackPath = resolveAssetPath(fallbackImagePath || manifest.portraitPath)
  return (
    <div className={`portrait-puppet-shell portrait-puppet-shell--${placement}`}>
      <div
        className="portrait-puppet portrait-puppet--v4"
        role="img"
        aria-label={label}
        data-portrait-renderer="layered-artmesh-2d"
        data-portrait-layer-mode="layered-artmesh-v1"
        data-portrait-quality={manifest.qualityTier}
        data-portrait-parts={manifest.parts.length}
      >
        <canvas ref={canvasRef} className="portrait-puppet__canvas" aria-hidden="true" />
        {!assets || imageLoadFailed ? (
          <img className="portrait-puppet__fallback" src={fallbackPath} alt="" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  )
}
