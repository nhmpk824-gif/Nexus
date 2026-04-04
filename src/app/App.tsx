import { Suspense, lazy } from 'react'
import './App.css'
import { useAppController } from './controllers'
import { PetView, PanelView } from './views'

const SettingsDrawer = lazy(async () => {
  const module = await import('../components/SettingsDrawer')
  return { default: module.SettingsDrawer }
})

const OnboardingGuide = lazy(async () => {
  const module = await import('../features/onboarding')
  return { default: module.OnboardingGuide }
})

function App() {
  const controller = useAppController()

  const onboardingGuide = (
    <Suspense fallback={null}>
      <OnboardingGuide {...controller.overlays.onboardingGuideProps} />
    </Suspense>
  )

  const settingsDrawer = (
    <Suspense fallback={null}>
      <SettingsDrawer {...controller.overlays.settingsDrawerProps} />
    </Suspense>
  )

  if (controller.view === 'pet') {
    return (
      <PetView
        {...controller.petView}
        onboardingGuide={onboardingGuide}
      />
    )
  }

  return (
    <PanelView
      {...controller.panelView}
      settingsDrawer={settingsDrawer}
      onboardingGuide={onboardingGuide}
    />
  )
}

export default App
