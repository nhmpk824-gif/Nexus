import { API_PROVIDER_PRESETS, getApiProviderPreset } from '../../../../lib/apiProviders'
import type { AppSettings } from '../../../../types'
import type { OnboardingDraftSetter } from './types'

type TextStepProps = {
  draft: AppSettings
  setDraft: OnboardingDraftSetter
  textProvider: {
    notes: string
  }
  onApplyTextProviderPreset: (providerId: string) => void
}

export function TextStep({
  draft,
  setDraft,
  textProvider,
  onApplyTextProviderPreset,
}: TextStepProps) {
  const currentPreset = getApiProviderPreset(draft.apiProviderId)
  const hasModelOptions = currentPreset.models.length > 0

  return (
    <div className="onboarding-grid onboarding-grid--stack">
      <label>
        <span>文本模型提供商</span>
        <select
          value={draft.apiProviderId}
          onChange={(event) => onApplyTextProviderPreset(event.target.value)}
        >
          {API_PROVIDER_PRESETS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <p className="onboarding-tip">{textProvider.notes}</p>

      <div className="onboarding-grid onboarding-grid--two">
        <label>
          <span>接口地址</span>
          <input
            value={draft.apiBaseUrl}
            onChange={(event) => setDraft((current) => ({
              ...current,
              apiBaseUrl: event.target.value,
            }))}
          />
        </label>

        <label>
          <span>模型名</span>
          {hasModelOptions ? (
            <select
              value={draft.model}
              onChange={(event) => setDraft((current) => ({
                ...current,
                model: event.target.value,
              }))}
            >
              {currentPreset.models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
              {!currentPreset.models.includes(draft.model) && draft.model && (
                <option value={draft.model}>{draft.model} (自定义)</option>
              )}
            </select>
          ) : (
            <input
              value={draft.model}
              onChange={(event) => setDraft((current) => ({
                ...current,
                model: event.target.value,
              }))}
            />
          )}
        </label>
      </div>

      <label>
        <span>接口密钥</span>
        <input
          type="password"
          value={draft.apiKey}
          onChange={(event) => setDraft((current) => ({
            ...current,
            apiKey: event.target.value,
          }))}
          placeholder="如果暂时没有，也可以先留空"
        />
      </label>
    </div>
  )
}
