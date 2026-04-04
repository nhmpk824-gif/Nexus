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
  return (
    <div className="onboarding-grid onboarding-grid--stack">
      <label>
        <span>角色模型</span>
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
        <strong>当前角色</strong>
        <p>
          {selectedPetModel
            ? `${selectedPetModel.label} · ${selectedPetModel.description}`
            : '当前还没有可选模型，稍后也可以在设置里继续导入。'}
        </p>
      </div>

      <div className="onboarding-grid onboarding-grid--two">
        <label className="onboarding-toggle">
          <span>开启连续语音</span>
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
          <span>开机自启</span>
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
