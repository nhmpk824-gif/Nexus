import { memo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PetModelDefinition } from '../../features/pet'
import {
  applyCharacterProfile,
  createCharacterProfile,
  removeCharacterProfile,
  syncCurrentToProfile,
  updateCharacterProfile,
} from '../../features/character/profiles'
import { resolveLocalizedText } from '../../lib/uiLanguage'
import type { AppSettings, CharacterProfile } from '../../types'

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
  const petModel = petModelPresets.find((preset) => preset.id === draft.petModelId) ?? petModelPresets[0]
  const t = (zhCN: string, enUS: string) =>
    resolveLocalizedText(draft.uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })

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

  const profileCount = draft.characterProfiles.length
  const profileCountLabel = t(
    `${profileCount} 个角色`,
    `${profileCount} profile${profileCount === 1 ? '' : 's'}`,
  )

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{t('角色与设定', 'Companion Profile')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '创建多个角色档案，每个角色包含独立的名字、提示词、Live2D 模型和语音设置。',
              'Create multiple companion profiles. Each one carries its own name, system prompt, Live2D model and voice.',
            )}
          </p>
        </div>
      </div>

      {profileCount > 0 ? (
        <div className="settings-drawer__card">
          <div className="settings-section__title-row">
            <div>
              <h5>{t('角色档案', 'Profiles')}</h5>
              <p className="settings-drawer__hint">
                {t(
                  '点击卡片切换角色，编辑后用下方「更新当前档案」按钮写回。',
                  'Click a card to switch profiles. Use "Update current profile" below to save edits back.',
                )}
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
                      title={t('删除此角色', 'Delete this profile')}
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
        <span>{t('角色名字', 'Companion name')}</span>
        <input
          value={draft.companionName}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, companionName: event.target.value }))
          }
        />
      </label>

      <label>
        <span>{t('你的名字', 'Your name')}</span>
        <input
          value={draft.userName}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, userName: event.target.value }))
          }
        />
      </label>

      <label>
        <span>{t('系统提示词', 'System prompt')}</span>
        <textarea
          rows={6}
          value={draft.systemPrompt}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, systemPrompt: event.target.value }))
          }
        />
      </label>

      <p className="settings-drawer__hint">
        {t(
          '这里定义的是角色的长期说话边界。建议重点写语气、关系感和回答风格，不要塞过长的一次性任务指令。',
          'This is the long-term voice and relationship of the character. Focus on tone, persona, and how the character relates to you — avoid one-off task instructions.',
        )}
      </p>

      <div className="settings-choice-field settings-choice-field--pet-model">
        <span className="settings-choice-field__label">{t('角色模型', 'Live2D model')}</span>
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
                  <strong>{preset.label}</strong>
                </span>
                <span className="settings-choice-card__description">
                  {preset.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="settings-drawer__card">
        <div className="settings-section__title-row">
          <div>
            <h5>{t('角色专属语音', 'Voice for this character')}</h5>
            <p className="settings-drawer__hint">
              {t(
                '只改音色和朗读风格。完整的提供商和密钥配置请到「语音输出」选项卡。',
                'Tune the voice id and speaking instructions. Provider and API credentials live in the Speech Output tab.',
              )}
            </p>
          </div>
        </div>

        <label>
          <span>{t('音色 / Voice ID', 'Voice ID')}</span>
          <input
            value={draft.speechOutputVoice}
            placeholder={t('例如 female-shaonv、zh-CN-XiaoxiaoNeural', 'e.g. female-shaonv, zh-CN-XiaoxiaoNeural')}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, speechOutputVoice: event.target.value }))
            }
          />
        </label>

        <label>
          <span>{t('朗读风格说明', 'Speaking instructions')}</span>
          <textarea
            rows={3}
            value={draft.speechOutputInstructions}
            placeholder={t(
              '例如 "温柔，略带沙哑" —— 部分提供商支持',
              'e.g. "gentle, slightly husky" — supported by some providers',
            )}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, speechOutputInstructions: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="settings-inline-row">
        <button
          type="button"
          className="ghost-button"
          onClick={onImportPetModel}
          disabled={importingPetModel}
        >
          {importingPetModel
            ? t('导入模型中...', 'Importing...')
            : t('导入本地 Live2D 模型', 'Import local Live2D model')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={handleUpdateCurrentProfile}
          disabled={!hasActiveProfile}
          title={hasActiveProfile
            ? t('把当前修改写回到选中的角色档案', 'Write current edits back to the selected profile')
            : t('没有选中任何档案', 'No profile selected')}
        >
          {t('更新当前档案', 'Update current profile')}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={handleCreateProfile}
          title={t('把当前设置另存为一个新的角色档案', 'Save current settings as a new profile')}
        >
          {t('新建角色档案', 'New profile')}
        </button>
      </div>

      <p className="settings-drawer__hint">
        {petModel?.description ?? ''}
        {' '}
        {t(
          '选择 `.model3.json` 文件后，应用会把整套模型复制到本地目录，后续切换不需要重新打包。',
          'Pick a `.model3.json` file. The app copies the whole model folder into the local directory so you can switch between models without rebuilding.',
        )}
      </p>

      {petModelStatus ? (
        <div className={petModelStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {petModelStatus.message}
        </div>
      ) : null}
    </section>
  )
})
