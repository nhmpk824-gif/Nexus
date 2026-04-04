import type { AppSettings } from '../../../../types'
import type { OnboardingDraftSetter } from './types'

type WelcomeStepProps = {
  draft: AppSettings
  setDraft: OnboardingDraftSetter
}

export function WelcomeStep({ draft, setDraft }: WelcomeStepProps) {
  return (
    <div className="onboarding-grid onboarding-grid--two">
      <label>
        <span>你的称呼</span>
        <input
          value={draft.userName}
          onChange={(event) => setDraft((current) => ({
            ...current,
            userName: event.target.value,
          }))}
          placeholder="比如：阿宁"
        />
      </label>

      <label>
        <span>桌宠名字</span>
        <input
          value={draft.companionName}
          onChange={(event) => setDraft((current) => ({
            ...current,
            companionName: event.target.value,
          }))}
          placeholder="比如：星绘"
        />
      </label>
    </div>
  )
}
