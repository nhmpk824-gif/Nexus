import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from '../../i18n/useTranslation.ts'
import type { PetModelDefinition } from '../../features/pet'
import type { ConnectionResult } from '../settingsDrawerSupport'
import type { AppSettings } from '../../types'

export type UsePetModelImportOptions = {
  onImportPetModel: () => Promise<{
    model: PetModelDefinition
    message: string
  } | null>
  setDraft: Dispatch<SetStateAction<AppSettings>>
}

export function usePetModelImport({
  onImportPetModel,
  setDraft,
}: UsePetModelImportOptions) {
  const { t } = useTranslation()
  const [importingPetModel, setImportingPetModel] = useState(false)
  const [petModelStatus, setPetModelStatus] = useState<ConnectionResult | null>(null)

  async function handleImportPetModel() {
    setImportingPetModel(true)
    setPetModelStatus(null)

    try {
      const result = await onImportPetModel()

      if (!result) {
        return
      }

      setDraft((current) => ({
        ...current,
        petModelId: result.model.id,
      }))
      setPetModelStatus({
        ok: true,
        message: result.message,
      })
    } catch (error) {
      setPetModelStatus({
        ok: false,
        message: error instanceof Error ? error.message : t('settings.pet.import_error'),
      })
    } finally {
      setImportingPetModel(false)
    }
  }

  function resetPetModelImport() {
    setPetModelStatus(null)
    setImportingPetModel(false)
  }

  return {
    importingPetModel,
    petModelStatus,
    handleImportPetModel,
    resetPetModelImport,
  }
}
