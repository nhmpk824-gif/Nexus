import { useEffect, useState } from 'react'
import {
  apiProviderRequiresApiKey,
  getApiProviderPreset,
} from '../../../lib/apiProviders'
import {
  getFallbackSpeechOutputVoices,
  getSpeechInputModelOptions,
  getSpeechInputProviderPreset,
  getSpeechOutputModelOptions,
  getSpeechOutputProviderPreset,
  isVolcengineSpeechOutputProvider,
} from '../../../lib/audioProviders'
import {
  switchSpeechInputProvider,
  switchSpeechOutputProvider,
} from '../../../lib/speechProviderProfiles'
import { switchTextProvider } from '../../../lib/textProviderProfiles'
import type { AppSettings, WindowView } from '../../../types'
import type { PetModelDefinition } from '../../pet'
import {
  CompanionStep,
  TextStep,
  VoiceStep,
  WelcomeStep,
} from './guideSteps'
import {
  getOnboardingFinishHint,
  getOnboardingStepError,
  ONBOARDING_STEPS,
  sanitizeOnboardingSettings,
} from './onboardingGuideSupport'

export type OnboardingGuideProps = {
  open: boolean
  view: WindowView
  settings: AppSettings
  petModelPresets: PetModelDefinition[]
  onDismiss: () => void
  onSave: (settings: AppSettings) => Promise<void>
}

export function OnboardingGuide({
  open,
  view,
  settings,
  petModelPresets,
  onDismiss,
  onSave,
}: OnboardingGuideProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0]
  const lastStepIndex = ONBOARDING_STEPS.length - 1
  const textProvider = getApiProviderPreset(draft.apiProviderId)
  const speechInputProvider = getSpeechInputProviderPreset(draft.speechInputProviderId)
  const speechOutputProvider = getSpeechOutputProviderPreset(draft.speechOutputProviderId)
  const speechInputModelOptions = getSpeechInputModelOptions(draft.speechInputProviderId)
  const speechOutputModelOptions = getSpeechOutputModelOptions(draft.speechOutputProviderId)
  const speechOutputVoiceOptions = getFallbackSpeechOutputVoices(draft.speechOutputProviderId)
  const isVolcengineSpeechOutput = isVolcengineSpeechOutputProvider(draft.speechOutputProviderId)
  const selectedPetModel = petModelPresets.find((preset) => preset.id === draft.petModelId) ?? petModelPresets[0]
  const finishHint = getOnboardingFinishHint(
    draft,
    apiProviderRequiresApiKey(draft.apiProviderId),
  )

  useEffect(() => {
    if (!open) return

    setDraft(settings)
    setStepIndex(0)
    setSaving(false)
    setError(null)
  }, [open, settings])

  useEffect(() => {
    if (!petModelPresets.length) return

    setDraft((current) => (
      petModelPresets.some((preset) => preset.id === current.petModelId)
        ? current
        : {
            ...current,
            petModelId: petModelPresets[0].id,
          }
    ))
  }, [petModelPresets])

  function applyTextProviderPreset(providerId: string) {
    setDraft((current) => switchTextProvider(current, providerId))
  }

  function applySpeechInputPreset(providerId: string) {
    setDraft((current) => switchSpeechInputProvider(current, providerId))
  }

  function applySpeechOutputPreset(providerId: string) {
    setDraft((current) => switchSpeechOutputProvider(current, providerId))
  }

  function goNextStep() {
    const nextError = getOnboardingStepError(draft, step.id)
    if (nextError) {
      setError(nextError)
      return
    }

    setError(null)
    setStepIndex((current) => Math.min(lastStepIndex, current + 1))
  }

  async function handleFinish() {
    const nextError = getOnboardingStepError(draft, step.id)
    if (nextError) {
      setError(nextError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave(sanitizeOnboardingSettings(draft, settings))
      onDismiss()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '首次设置保存失败，请稍后再试。')
    } finally {
      setSaving(false)
    }
  }

  function renderStepContent() {
    switch (step.id) {
      case 'welcome':
        return (
          <WelcomeStep
            draft={draft}
            setDraft={setDraft}
          />
        )
      case 'text':
        return (
          <TextStep
            draft={draft}
            setDraft={setDraft}
            textProvider={textProvider}
            onApplyTextProviderPreset={applyTextProviderPreset}
          />
        )
      case 'voice':
        return (
          <VoiceStep
            draft={draft}
            setDraft={setDraft}
            speechInputProvider={speechInputProvider}
            speechOutputProvider={speechOutputProvider}
            speechInputModelOptions={speechInputModelOptions}
            speechOutputModelOptions={speechOutputModelOptions}
            speechOutputVoiceOptions={speechOutputVoiceOptions}
            isVolcengineSpeechOutput={isVolcengineSpeechOutput}
            onApplySpeechInputPreset={applySpeechInputPreset}
            onApplySpeechOutputPreset={applySpeechOutputPreset}
          />
        )
      case 'companion':
      default:
        return (
          <CompanionStep
            draft={draft}
            setDraft={setDraft}
            petModelPresets={petModelPresets}
            selectedPetModel={selectedPetModel}
            finishHint={finishHint}
          />
        )
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className={`onboarding-backdrop onboarding-backdrop--${view}`}>
      <section className={`onboarding-card onboarding-card--${view}`}>
        <div className="onboarding-card__header">
          <div>
            <p className="eyebrow">首次配置</p>
            <h2>先把陪伴体配置到能聊、能听、能说</h2>
            <p className="onboarding-card__copy">
              这是一轮最小可用首配。先完成聊天、语音、角色和基础陪伴偏好，工具权限、记忆策略和桌面上下文都可以稍后在设置里继续细调。
            </p>
          </div>

          <button className="ghost-button" type="button" onClick={onDismiss} disabled={saving}>
            稍后再说
          </button>
        </div>

        <div className="onboarding-stepper">
          {ONBOARDING_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`onboarding-stepper__item ${index === stepIndex ? 'is-active' : ''} ${index < stepIndex ? 'is-complete' : ''}`}
              onClick={() => {
                if (index > stepIndex) return
                setStepIndex(index)
                setError(null)
              }}
              disabled={index > stepIndex || saving}
            >
              <span>{index + 1}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>

        <div className="onboarding-card__body">
          <div className="onboarding-section">
            <div className="onboarding-section__intro">
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>

            {renderStepContent()}

            {error ? <div className="settings-test-result is-error">{error}</div> : null}
          </div>
        </div>

        <div className="onboarding-card__actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setStepIndex((current) => Math.max(0, current - 1))
              setError(null)
            }}
            disabled={stepIndex === 0 || saving}
          >
            上一步
          </button>

          {stepIndex < lastStepIndex ? (
            <button className="primary-button" type="button" onClick={goNextStep} disabled={saving}>
              下一步
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={() => void handleFinish()} disabled={saving}>
              {saving ? '保存中...' : '完成引导并开始使用'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
