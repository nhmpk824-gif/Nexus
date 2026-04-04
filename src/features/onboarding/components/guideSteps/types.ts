import type { Dispatch, SetStateAction } from 'react'
import type { AppSettings } from '../../../../types'

export type OnboardingStepId = 'welcome' | 'text' | 'voice' | 'companion'

export type OnboardingStep = {
  id: OnboardingStepId
  title: string
  description: string
}

export type OnboardingDraftSetter = Dispatch<SetStateAction<AppSettings>>
