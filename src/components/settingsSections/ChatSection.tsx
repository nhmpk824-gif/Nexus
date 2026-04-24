import { memo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PetModelDefinition } from '../../features/pet'
import {
  applyCharacterProfile,
  createCharacterProfile,
  removeCharacterProfile,
  syncCurrentToProfile,
  updateCharacterProfile,
} from '../../features/character/profiles'
import { pickTranslatedUiText } from '../../lib/uiLanguage'
import { loadLorebookEntries, saveLorebookEntries } from '../../lib/storage/lorebooks'
import type { AppSettings, CharacterProfile, CompanionRelationshipType } from '../../types'
import type { TranslationKey } from '../../types/i18n'

const RELATIONSHIP_OPTIONS: ReadonlyArray<{
  value: CompanionRelationshipType
  labelKey: TranslationKey
}> = [
  { value: 'open_ended', labelKey: 'onboarding.companion.relationship_open_ended' },
  { value: 'friend', labelKey: 'onboarding.companion.relationship_friend' },
  { value: 'mentor', labelKey: 'onboarding.companion.relationship_mentor' },
  { value: 'quiet_companion', labelKey: 'onboarding.companion.relationship_quiet_companion' },
]

type StatusMessage = {
  ok: boolean
  message: string
} | null

type ChatSectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
  petModelPresets: PetModelDefinition[]
  importingPetModel: boolean
  petModelStatus: StatusMessage
  onImportPetModel: () => void
}

export const ChatSection = memo(function ChatSection({
  active,
  draft,
  setDraft,
  petModelPresets,
  importingPetModel,
  petModelStatus,
  onImportPetModel,
}: ChatSectionProps) {
  const ti = (key: Parameters<typeof pickTranslatedUiText>[1], params?: Parameters<typeof pickTranslatedUiText>[2]) =>
    pickTranslatedUiText(draft.uiLanguage, key, params)

  const petModel = petModelPresets.find((preset) => preset.id === draft.petModelId) ?? petModelPresets[0]

  function handleCreateProfile() {
    const profile = createCharacterProfile(draft, draft.companionName)
    setDraft((prev) => ({
      ...prev,
      characterProfiles: [...prev.characterProfiles, profile],
      activeCharacterProfileId: profile.id,
    }))
  }

  function handleUpdateCurrentProfile() {
    setDraft((prev) => syncCurrentToProfile(prev))
  }

  const hasActiveProfile = Boolean(
    draft.activeCharacterProfileId &&
      draft.characterProfiles.some((p) => p.id === draft.activeCharacterProfileId),
  )

  function handleSwitchProfile(profile: CharacterProfile) {
    setDraft((prev) => applyCharacterProfile(prev, profile))
  }

  function handleDeleteProfile(profileId: string) {
    setDraft((prev) => ({
      ...prev,
      characterProfiles: removeCharacterProfile(prev.characterProfiles, profileId),
      activeCharacterProfileId: prev.activeCharacterProfileId === profileId
        ? ''
        : prev.activeCharacterProfileId,
    }))
  }

  function handleUpdateProfileLabel(profileId: string, label: string) {
    setDraft((prev) => ({
      ...prev,
      characterProfiles: updateCharacterProfile(prev.characterProfiles, profileId, { label }),
    }))
  }

  const [importingCard, setImportingCard] = useState(false)
  const [cardStatus, setCardStatus] = useState<StatusMessage>(null)

  async function handleImportCard() {
    if (!window.desktopPet?.personaImportCard) return
    setImportingCard(true)
    setCardStatus(null)
    try {
      const result = await window.desktopPet.personaImportCard()
      if (!result) { setImportingCard(false); return }

      const profile: CharacterProfile = {
        id: result.profile.id,
        label: result.profile.label,
        companionName: result.profile.companionName,
        systemPrompt: result.profile.systemPrompt,
        petModelId: result.profile.petModelId || draft.petModelId,
      }

      setDraft((prev) => ({
        ...prev,
        companionName: profile.companionName,
        systemPrompt: profile.systemPrompt,
        characterProfiles: [...prev.characterProfiles, profile],
        activeCharacterProfileId: profile.id,
      }))

      if (result.lorebookEntries.length) {
        const existing = loadLorebookEntries()
        saveLorebookEntries([...existing, ...result.lorebookEntries])
      }

      setCardStatus({
        ok: true,
        message: ti('settings.chat.import_card_success', {
          name: profile.companionName,
          count: result.lorebookEntries.length,
        }),
      })
    } catch (err) {
      setCardStatus({
        ok: false,
        message: ti('settings.chat.import_card_error', {
          error: err instanceof Error ? err.message : String(err),
        }),
      })
    } finally {
      setImportingCard(false)
    }
  }

  const profileCount = draft.characterProfiles.length
  const profileCountLabel = ti('settings.chat.profiles_label', { count: profileCount })

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{ti('settings.chat.title')}</h4>
          <p className="settings-drawer__hint">
            {ti('settings.chat.note')}
          </p>
        </div>
      </div>

      {profileCount > 0 ? (
        <div className="settings-drawer__card">
          <div className="settings-section__title-row">
            <div>
              <h5>{ti('settings.chat.profiles')}</h5>
              <p className="settings-drawer__hint">
                {ti('settings.chat.profiles_hint')}
              </p>
            </div>
            <div className="settings-page__meta">
              <span>{profileCountLabel}</span>
            </div>
          </div>

          <div className="settings-choice-grid" role="list">
            {draft.characterProfiles.map((profile) => {
              const isActive = draft.activeCharacterProfileId === profile.id
              const profileModel = petModelPresets.find((p) => p.id === profile.petModelId)

              return (
                <div key={profile.id} className={`settings-choice-card ${isActive ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="settings-choice-card__body"
                    aria-pressed={isActive}
                    onClick={() => handleSwitchProfile(profile)}
                  >
                    <span className="settings-choice-card__header">
                      <strong>{profile.label || profile.companionName}</strong>
                    </span>
                    <span className="settings-choice-card__description">
                      {profileModel?.label ?? profile.petModelId}
                      {profile.speechOutputVoice ? ` · ${profile.speechOutputVoice}` : ''}
                    </span>
                  </button>
                  <div className="settings-choice-card__actions">
                    <input
                      className="settings-choice-card__label-input"
                      value={profile.label}
                      placeholder={profile.companionName}
                      onChange={(event) => handleUpdateProfileLabel(profile.id, event.target.value)}
                    />
                    <button
                      type="button"
                      className="settings-inline-delete"
                      onClick={() => handleDeleteProfile(profile.id)}
                      title={ti('settings.chat.delete_profile')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <label>
        <span>{ti('settings.chat.companion_name')}</span>
        <input
          value={draft.companionName}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, companionName: event.target.value }))
          }
        />
      </label>

      <label>
        <span>{ti('settings.chat.user_name')}</span>
        <input
          value={draft.userName}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, userName: event.target.value }))
          }
        />
      </label>

      <div className="onboarding-relationship">
        <span className="onboarding-relationship__label">
          {ti('settings.chat.relationship_type_label')}
        </span>
        <div className="onboarding-relationship__options">
          {RELATIONSHIP_OPTIONS.map((opt) => {
            const isActive = draft.companionRelationshipType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                className={`onboarding-relationship__chip${isActive ? ' is-active' : ''}`}
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  companionRelationshipType: opt.value,
                }))}
              >
                {ti(opt.labelKey)}
              </button>
            )
          })}
        </div>
        <small className="onboarding-relationship__hint">
          {ti('settings.chat.relationship_type_hint')}
        </small>
      </div>

      <label>
        <span>{ti('settings.chat.system_prompt')}</span>
        <textarea
          rows={6}
          value={draft.systemPrompt}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, systemPrompt: event.target.value }))
          }
        />
      </label>

      <p className="settings-drawer__hint">
        {ti('settings.chat.system_prompt_hint')}
      </p>

      <div className="settings-choice-field settings-choice-field--pet-model">
        <span className="settings-choice-field__label">{ti('settings.chat.live2d_model')}</span>
        <div className="settings-choice-grid" role="list">
          {petModelPresets.map((preset) => {
            const selected = draft.petModelId === preset.id

            return (
              <button
                key={preset.id}
                type="button"
                className={`settings-choice-card ${selected ? 'is-active' : ''}`}
                aria-pressed={selected}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, petModelId: preset.id }))
                }
              >
                <span className="settings-choice-card__header">
                  <strong>{ti(preset.label as TranslationKey)}</strong>
                </span>
                <span className="settings-choice-card__description">
                  {ti(preset.description as TranslationKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="settings-drawer__card">
        <div className="settings-section__title-row">
          <div>
            <h5>{ti('settings.chat.character_voice')}</h5>
            <p className="settings-drawer__hint">
              {ti('settings.chat.character_voice_hint')}
            </p>
          </div>
        </div>

        <label>
          <span>{ti('settings.chat.voice_id')}</span>
          <input
            value={draft.speechOutputVoice}
            placeholder={ti('settings.chat.voice_id_placeholder')}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, speechOutputVoice: event.target.value }))
            }
          />
        </label>

        <label>
          <span>{ti('settings.chat.speaking_instructions')}</span>
          <textarea
            rows={3}
            value={draft.speechOutputInstructions}
            placeholder={ti('settings.chat.speaking_instructions_placeholder')}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, speechOutputInstructions: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="settings-drawer__card">
        <div className="settings-section__title-row">
          <div>
            <h5>{ti('settings.chat.vts_title')}</h5>
            <p className="settings-drawer__hint">
              {ti('settings.chat.vts_hint')}
            </p>
          </div>
        </div>
        <label className="settings-toggle">
          <span>{ti('settings.chat.vts_enabled')}</span>
          <input
            type="checkbox"
            checked={draft.vtsEnabled}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, vtsEnabled: event.target.checked }))
            }
          />
        </label>
        {draft.vtsEnabled ? (
          <label>
            <span>{ti('settings.chat.vts_port')}</span>
            <input
              type="number"
              value={draft.vtsPort}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, vtsPort: Number(event.target.value) || 8001 }))
              }
            />
          </label>
        ) : null}
      </div>

      <div className="settings-inline-row">
        <button
          type="button"
          className="ghost-button"
          onClick={handleImportCard}
          disabled={importingCard}
        >
          {importingCard
            ? ti('settings.chat.importing_card')
            : ti('settings.chat.import_card')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onImportPetModel}
          disabled={importingPetModel}
        >
          {importingPetModel
            ? ti('settings.chat.importing_model')
            : ti('settings.chat.import_model')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={handleUpdateCurrentProfile}
          disabled={!hasActiveProfile}
          title={hasActiveProfile
            ? ti('settings.chat.update_profile_title')
            : ti('settings.chat.no_profile_selected')}
        >
          {ti('settings.chat.update_profile')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={handleCreateProfile}
          title={ti('settings.chat.new_profile_title')}
        >
          {ti('settings.chat.new_profile')}
        </button>
      </div>

      <p className="settings-drawer__hint">
        {petModel?.description ?? ''}
        {' '}
        {ti('settings.chat.model_import_hint')}
      </p>

      {petModelStatus ? (
        <div className={petModelStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {petModelStatus.message}
        </div>
      ) : null}

      {cardStatus ? (
        <div className={cardStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {cardStatus.message}
        </div>
      ) : null}
    </section>
  )
})
