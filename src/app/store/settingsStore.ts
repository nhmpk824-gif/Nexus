import {
  SETTINGS_STORAGE_KEY,
  SETTINGS_UPDATED_EVENT,
  loadSettings,
  saveSettings,
} from '../../lib'
import {
  dehydrateSettingsKeys,
  hydrateSettingsKeys,
  migrateKeysToVault,
} from '../../lib/keyVaultBridge.ts'
import type { AppSettings } from '../../types'

let vaultMigrationDone = false
let cachedHydratedSettings: AppSettings | null = null

export function getSettingsSnapshot(): AppSettings {
  if (cachedHydratedSettings) return cachedHydratedSettings
  return loadSettings()
}

export function setSettingsSnapshot(nextSettings: AppSettings) {
  cachedHydratedSettings = nextSettings
  // Save synchronously first (with keys in plaintext temporarily),
  // then dehydrate keys to vault asynchronously.
  saveSettings(nextSettings)
  void dehydrateSettingsKeys(nextSettings).then((stripped) => {
    // Re-save with keys stripped (vault has them now).
    // Use silent: true to avoid dispatching an event that would trigger
    // subscribeToSettings → hydrateSettingsKeys → setSettings → infinite loop.
    saveSettings(stripped, { silent: true })
  })
}

/**
 * Async initialization: migrate plaintext keys to vault on first run,
 * then hydrate the settings object with decrypted keys from vault.
 */
export async function initializeSettingsWithVault(): Promise<AppSettings> {
  let settings = loadSettings()

  if (!vaultMigrationDone) {
    vaultMigrationDone = true

    const hasPlaintextKeys = Boolean(
      settings.apiKey
      || settings.speechInputApiKey
      || settings.speechOutputApiKey
      || settings.voiceCloneApiKey
      || settings.toolWebSearchApiKey,
    )

    if (hasPlaintextKeys) {
      settings = await migrateKeysToVault(settings)
      saveSettings(settings)
    }
  }

  const hydrated = await hydrateSettingsKeys(settings)
  cachedHydratedSettings = hydrated
  return hydrated
}

export function subscribeToSettings(listener: (settings: AppSettings) => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleSettingsUpdated = (event: Event) => {
    const customEvent = event as CustomEvent<AppSettings>
    if (customEvent.detail) {
      hydrateSettingsKeys(customEvent.detail).then((hydrated) => {
        cachedHydratedSettings = hydrated
        listener(hydrated)
      })
      return
    }

    hydrateSettingsKeys(loadSettings()).then((hydrated) => {
      cachedHydratedSettings = hydrated
      listener(hydrated)
    })
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_STORAGE_KEY) {
      return
    }

    hydrateSettingsKeys(loadSettings()).then((hydrated) => {
      cachedHydratedSettings = hydrated
      listener(hydrated)
    })
  }

  window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener)
    window.removeEventListener('storage', handleStorage)
  }
}

export function createSettingsStore() {
  return {
    getSnapshot: getSettingsSnapshot,
    setSnapshot: setSettingsSnapshot,
    subscribe: subscribeToSettings,
  }
}
