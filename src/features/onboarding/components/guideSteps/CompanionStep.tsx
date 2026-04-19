import { pickTranslatedUiText } from '../../../../lib/uiLanguage'
import type { AppSettings } from '../../../../types'
import type { PetModelDefinition } from '../../../pet'
import type { OnboardingDraftSetter } from './types'

type CompanionStepProps = {
  draft: AppSettings
  setDraft: OnboardingDraftSetter
  petModelPresets: PetModelDefinition[]
  selectedPetModel: PetModelDefinition | undefined
  finishHint: string
}

export function CompanionStep({
  draft,
  setDraft,
  petModelPresets,
  selectedPetModel,
  finishHint,
}: CompanionStepProps) {
  const ti = (key: Parameters<typeof pickTranslatedUiText>[1]) =>
    pickTranslatedUiText(draft.uiLanguage, key)
  return (
    <div className="onboarding-grid onboarding-grid--stack">
      <label>
        <span>{ti('onboarding.companion.model_label')}</span>
        <select
          value={draft.petModelId}
          onChange={(event) => setDraft((current) => ({
            ...current,
            petModelId: event.target.value,
          }))}
          disabled={!petModelPresets.length}
        >
          {petModelPresets.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </label>

      <div className="onboarding-summary">
        <strong>{ti('onboarding.companion.current_label')}</strong>
        <p>
          {selectedPetModel
            ? `${selectedPetModel.label} · ${selectedPetModel.description}`
            : ti('onboarding.companion.no_models')}
        </p>
      </div>

      <div className="onboarding-grid onboarding-grid--two">
        <label className="onboarding-toggle">
          <span>{ti('onboarding.companion.enable_continuous_voice')}</span>
          <input
            type="checkbox"
            checked={draft.continuousVoiceModeEnabled}
            onChange={(event) => setDraft((current) => ({
              ...current,
              continuousVoiceModeEnabled: event.target.checked,
            }))}
          />
        </label>

        <label className="onboarding-toggle">
          <span>{ti('onboarding.companion.launch_on_startup')}</span>
          <input
            type="checkbox"
            checked={draft.launchOnStartup}
            onChange={(event) => setDraft((current) => ({
              ...current,
              launchOnStartup: event.target.checked,
            }))}
          />
        </label>
      </div>

      <p className="onboarding-tip onboarding-tip--strong">{finishHint}</p>
    </div>
  )
}
