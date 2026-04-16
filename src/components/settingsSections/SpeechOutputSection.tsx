import { memo } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import {
  buildVolcengineCredential,
  clampNumber,
  formatTtsAdjustmentValue,
  parseNumberInput,
  parseVolcengineCredentialParts,
  type ConnectionResult,
  type VolcengineCredentialParts,
} from '../settingsDrawerSupport'
import {
  getSpeechOutputAdjustmentSupport,
  getSpeechOutputModelOptions,
  getSpeechOutputProviderPreset,
  getSpeechOutputStyleOptions,
  isEdgeTtsSpeechOutputProvider,
  isMiniMaxSpeechOutputProvider,
  isSpeechOutputKeyless,
  isVolcengineSpeechOutputProvider,
  supportsCustomSpeechOutputVoiceId,
} from '../../lib/audioProviders'
import { SPEECH_OUTPUT_PROVIDERS } from '../../lib/providerCatalog'
import { updateCurrentSpeechOutputProviderProfile } from '../../lib/speechProviderProfiles'
import { resolveLocalizedText } from '../../lib/uiLanguage'
import type {
  AppSettings,
  ServiceConnectionCapability,
  SpeechVoiceOption,
} from '../../types'
import { UrlInput } from './UrlInput'

const speechOutputSelectOptions = SPEECH_OUTPUT_PROVIDERS
  .filter((p) => !p.hidden)
  .map((p) => ({ id: p.id, label: p.label }))

type SpeechOutputSectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
  speechVoiceOptions: SpeechVoiceOption[]
  speechVoiceStatus: ConnectionResult | null
  loadingSpeechVoices: boolean
  speechPreviewText: string
  setSpeechPreviewText: Dispatch<SetStateAction<string>>
  speechPreviewStatus: ConnectionResult | null
  previewingSpeech: boolean
  testingTarget: ServiceConnectionCapability | null
  onApplySpeechOutputPreset: (providerId: string) => void
  onLoadSpeechVoices: () => void
  onPreviewSpeech: () => void
  onRunSpeechOutputConnectionTest: () => void
  renderSpeechOutputTestResult: () => ReactNode
}

export const SpeechOutputSection = memo(function SpeechOutputSection({
  active,
  draft,
  setDraft,
  speechVoiceOptions,
  speechVoiceStatus,
  loadingSpeechVoices,
  speechPreviewText,
  setSpeechPreviewText,
  speechPreviewStatus,
  previewingSpeech,
  testingTarget,
  onApplySpeechOutputPreset,
  onLoadSpeechVoices,
  onPreviewSpeech,
  onRunSpeechOutputConnectionTest,
  renderSpeechOutputTestResult,
}: SpeechOutputSectionProps) {
  const t = (zhCN: string, enUS: string) =>
    resolveLocalizedText(draft.uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })

  const speechOutputProvider = getSpeechOutputProviderPreset(draft.speechOutputProviderId)
  const speechOutputAdjustmentSupport = getSpeechOutputAdjustmentSupport(draft.speechOutputProviderId)
  const speechOutputModelOptions = getSpeechOutputModelOptions(draft.speechOutputProviderId)
  const speechOutputStyleOptions = getSpeechOutputStyleOptions(draft.speechOutputProviderId)
  const isMiniMaxSpeechOutput = isMiniMaxSpeechOutputProvider(draft.speechOutputProviderId)
  const isVolcengineSpeechOutput = isVolcengineSpeechOutputProvider(draft.speechOutputProviderId)
  const isEdgeTtsSpeechOutput = isEdgeTtsSpeechOutputProvider(draft.speechOutputProviderId)
  const hideApiCredentials = isSpeechOutputKeyless(draft.speechOutputProviderId)
  const showCustomVoiceInput = supportsCustomSpeechOutputVoiceId(draft.speechOutputProviderId)
  const speechOutputVolcengineCredentials = parseVolcengineCredentialParts(draft.speechOutputApiKey)
  const speechOutputBaseUrlLabel = t('语音输出接口地址', 'Speech output API base URL')
  const speechOutputModelLabel = isVolcengineSpeechOutput
    ? t('语音业务集群', 'Speech service cluster')
    : t('语音输出模型', 'Speech output model')
  const speechOutputVoiceLabel = isVolcengineSpeechOutput
    ? t('播报音色类型', 'Voice type')
    : t('播报音色 / 音色 ID', 'Voice / Voice ID')

  function updateSpeechOutputVolcengineCredential(partial: Partial<VolcengineCredentialParts>) {
    setDraft((prev) => {
      const current = parseVolcengineCredentialParts(prev.speechOutputApiKey)
      return updateCurrentSpeechOutputProviderProfile(prev, {
        apiKey: buildVolcengineCredential({
          ...current,
          ...partial,
        }),
      })
    })
  }

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{t('语音输出 TTS', 'Speech Output (TTS)')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '浏览器本地播报是回退方案，云端 TTS 支持更稳定的内置声音。',
              'Browser-local speech is the fallback. Cloud TTS provides more stable built-in voices.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={onRunSpeechOutputConnectionTest}
          disabled={testingTarget === 'speech-output'}
        >
          {testingTarget === 'speech-output'
            ? t('测试中...', 'Testing...')
            : t('测试语音输出', 'Test speech output')}
        </button>
      </div>

      <label>
        <span>{t('语音输出提供商', 'Speech output provider')}</span>
        <select
          value={draft.speechOutputProviderId}
          onChange={(event) => onApplySpeechOutputPreset(event.target.value)}
        >
          {speechOutputSelectOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>


      <p className="settings-drawer__hint">
        {speechOutputProvider.notes}
        {speechOutputProvider.baseUrl
          ? ` ${t('默认地址：', 'Default URL: ')}${speechOutputProvider.baseUrl}`
          : ''}
        {speechOutputProvider.defaultModel
          ? `${t('，默认模型：', ', default model: ')}${speechOutputProvider.defaultModel}`
          : ''}
      </p>

      {!isEdgeTtsSpeechOutput ? (
        <label>
          <span>{speechOutputBaseUrlLabel}</span>
          <UrlInput
            value={draft.speechOutputApiBaseUrl}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                apiBaseUrl: event.target.value,
              }))
            }
          />
        </label>
      ) : null}

      {isVolcengineSpeechOutput ? (
        <>
          <div className="settings-grid settings-grid--two">
            <label>
              <span>{t('火山 App ID', 'Volcengine App ID')}</span>
              <input
                value={speechOutputVolcengineCredentials.appId}
                onChange={(event) =>
                  updateSpeechOutputVolcengineCredential({
                    appId: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>{t('火山访问令牌', 'Volcengine access token')}</span>
              <input
                type="password"
                value={speechOutputVolcengineCredentials.accessToken}
                onChange={(event) =>
                  updateSpeechOutputVolcengineCredential({
                    accessToken: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <p className="settings-drawer__hint">
            {t(
              '这里分开填写即可，保存时会自动拼成 `APP_ID:ACCESS_TOKEN`。如果你复制的是带标签的两行文本，也可以直接粘进"访问令牌"一栏试一下。',
              'Fill these in separately — on save they are combined into `APP_ID:ACCESS_TOKEN`. If you copied a two-line labeled block, you can paste it straight into the access token field and it will try to parse.',
            )}
          </p>
        </>
      ) : !hideApiCredentials ? (
        <label>
          <span>{t('语音输出密钥', 'Speech output API key')}</span>
          <input
            type="password"
            value={draft.speechOutputApiKey}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                apiKey: event.target.value,
              }))
            }
          />
        </label>
      ) : null}

      {speechOutputModelOptions.length || speechOutputProvider.defaultModel ? (
        <label>
          <span>{speechOutputModelLabel}</span>
          {speechOutputModelOptions.length ? (
            <select
              value={draft.speechOutputModel}
              onChange={(event) =>
                setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                  model: event.target.value,
                }))
              }
            >
              {speechOutputModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={draft.speechOutputModel}
              onChange={(event) =>
                setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                  model: event.target.value,
                }))
              }
            />
          )}
        </label>
      ) : null}

      {isVolcengineSpeechOutput ? (
        <p className="settings-drawer__hint">
          {t(
            '火山 TTS 的"模型"这一栏实际填写的是业务集群，默认推荐 `volcano_tts`。如果你只是先验证能不能播报，音色先用 `BV001_streaming` 最稳；下拉里标了"需授权"的音色如果没有在控制台开通，程序会自动回退到 `BV001_streaming` 或 `BV002_streaming`。',
            'The "model" field for Volcengine TTS is actually the service cluster — `volcano_tts` is the recommended default. To just verify playback works, `BV001_streaming` is the safest voice. Voices marked "needs authorization" in the dropdown will fall back to `BV001_streaming` or `BV002_streaming` if you have not enabled them in the console.',
          )}
        </p>
      ) : null}

      {isMiniMaxSpeechOutput ? (
        <>
          <div className="settings-section__title-row">
            <div>
              <p className="settings-drawer__hint">
                {t(
                  'MiniMax 已接入在线音色列表。保存前可以先刷新一次，确认下拉选项和当前密钥都正常。',
                  'MiniMax supports a live voice catalog. Refresh once before saving to confirm the dropdown and your current API key both work.',
                )}
              </p>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={onLoadSpeechVoices}
              disabled={loadingSpeechVoices}
            >
              {loadingSpeechVoices
                ? t('拉取中...', 'Fetching...')
                : t('刷新 MiniMax 音色', 'Refresh MiniMax voices')}
            </button>
          </div>

          <label>
            <span>{t('MiniMax 可选音色', 'Available MiniMax voices')}</span>
            <select
              value={speechVoiceOptions.some((voice) => voice.id === draft.speechOutputVoice)
                ? draft.speechOutputVoice
                : '__keep-current__'}
              onChange={(event) => {
                if (event.target.value === '__keep-current__') return
                setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                  voice: event.target.value,
                }))
              }}
            >
              <option value="__keep-current__">
                {draft.speechOutputVoice
                  ? `${t('保留当前值：', 'Keep current: ')}${draft.speechOutputVoice}`
                  : t('请选择一个 MiniMax 音色', 'Select a MiniMax voice')}
              </option>
              {speechVoiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label === voice.id ? voice.id : `${voice.label} (${voice.id})`}
                </option>
              ))}
            </select>
          </label>

          {speechVoiceOptions.length ? (
            <p className="settings-drawer__hint">
              {speechVoiceOptions.find((voice) => voice.id === draft.speechOutputVoice)?.description
                ?? t(
                  '已加载 MiniMax 音色列表，也可以继续手动填写音色 ID。',
                  'MiniMax voice catalog loaded. You can still enter a voice ID manually.',
                )}
            </p>
          ) : null}
        </>
      ) : null}

      {isEdgeTtsSpeechOutput ? (
        <>
          <label>
            <span>{t('音色', 'Voice')}</span>
            {speechVoiceOptions.length ? (
              <select
                value={draft.speechOutputVoice}
                onChange={(event) =>
                  setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                    voice: event.target.value,
                  }))
                }
              >
                {speechVoiceOptions.map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.label}</option>
                ))}
              </select>
            ) : (
              <input
                value={draft.speechOutputVoice}
                placeholder="zh-CN-XiaoxiaoNeural"
                onChange={(event) =>
                  setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                    voice: event.target.value,
                  }))
                }
              />
            )}
          </label>
          <p className="settings-drawer__hint">
            {t(
              'Edge TTS 免费，无需 API key。音色名称形如 `zh-CN-XiaoxiaoNeural`，可在微软文档查看所有支持的音色。',
              'Edge TTS is free and needs no API key. Voice names look like `zh-CN-XiaoxiaoNeural`; see Microsoft docs for the full list.',
            )}
          </p>
        </>
      ) : null}

      {!isMiniMaxSpeechOutput && !isEdgeTtsSpeechOutput && speechVoiceOptions.length ? (
        <>
          <label>
            <span>{isVolcengineSpeechOutput
              ? t('火山推荐音色', 'Recommended Volcengine voices')
              : t('播报音色', 'Voice')}</span>
            <select
              value={speechVoiceOptions.some((voice) => voice.id === draft.speechOutputVoice)
                ? draft.speechOutputVoice
                : '__keep-current__'}
              onChange={(event) => {
                if (event.target.value === '__keep-current__') return
                setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                  voice: event.target.value,
                }))
              }}
            >
              <option value="__keep-current__">
                {draft.speechOutputVoice
                  ? `${t('保留当前值：', 'Keep current: ')}${draft.speechOutputVoice}`
                  : t('请选择一个音色', 'Select a voice')}
              </option>
              {speechVoiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label === voice.id ? voice.id : `${voice.label} (${voice.id})`}
                </option>
              ))}
            </select>
          </label>

          <p className="settings-drawer__hint">
            {speechVoiceOptions.find((voice) => voice.id === draft.speechOutputVoice)?.description
              ?? t(
                '从内置音色列表里挑一个，避免手动输入错名导致播报失败。',
                'Pick from the built-in voice catalog to avoid typos that break playback.',
              )}
          </p>
        </>
      ) : null}

      {showCustomVoiceInput && !isEdgeTtsSpeechOutput ? (
        <label>
          <span>{speechOutputVoiceLabel}</span>
          <input
            value={draft.speechOutputVoice}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                voice: event.target.value,
              }))
            }
          />
        </label>
      ) : null}

      {speechVoiceStatus ? (
        <div className={speechVoiceStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {speechVoiceStatus.message}
        </div>
      ) : null}

      {speechOutputStyleOptions.length ? (
        <>
          <label>
            <span>{t('播报风格', 'Speaking style')}</span>
            <select
              value={speechOutputStyleOptions.some((opt) => opt.value === draft.speechOutputInstructions)
                ? draft.speechOutputInstructions
                : ''}
              onChange={(event) =>
                setDraft((prev) => updateCurrentSpeechOutputProviderProfile(prev, {
                  instructions: event.target.value,
                }))
              }
            >
              {speechOutputStyleOptions.map((opt) => (
                <option key={opt.value || '__default__'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <p className="settings-drawer__hint">
            {speechOutputStyleOptions.find((opt) => opt.value === draft.speechOutputInstructions)?.description
              ?? t(
                '从内置播报风格中选择一个，程序会自动发送对应的英文 prompt 给模型。',
                'Choose a built-in speaking style — the app sends the matching English prompt to the model.',
              )}
          </p>
        </>
      ) : null}

      <label>
        <span>{t('播报语言', 'Speech language')}</span>
        <input
          value={draft.speechSynthesisLang}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              speechSynthesisLang: event.target.value,
            }))
          }
        />
      </label>

      <div className="settings-drawer__card">
        <div className="settings-section__title-row">
          <div>
            <h5>{t('播报调校', 'Speech tuning')}</h5>
            <p className="settings-drawer__hint">{speechOutputAdjustmentSupport.note}</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                speechRate: 0.92,
                speechPitch: 1.08,
                speechVolume: 1,
              }))
            }
          >
            {t('恢复默认', 'Restore defaults')}
          </button>
        </div>

        <div className="settings-tts-tuning">
          <div className={`settings-tts-tuning__item ${speechOutputAdjustmentSupport.rate ? '' : 'is-disabled'}`}>
            <div className="settings-tts-tuning__header">
              <strong>{t('语速', 'Rate')}</strong>
              <span>{formatTtsAdjustmentValue('rate', draft.speechRate)}</span>
            </div>
            <div className="settings-tts-tuning__controls">
              <input
                className="settings-tts-tuning__range"
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={draft.speechRate}
                disabled={!speechOutputAdjustmentSupport.rate}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    speechRate: clampNumber(parseNumberInput(event.target.value, prev.speechRate), 0.5, 2),
                  }))
                }
              />
              <input
                className="settings-tts-tuning__number"
                type="number"
                min="0.5"
                max="2"
                step="0.05"
                value={draft.speechRate}
                disabled={!speechOutputAdjustmentSupport.rate}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    speechRate: clampNumber(parseNumberInput(event.target.value, prev.speechRate), 0.5, 2),
                  }))
                }
              />
            </div>
            <p className="settings-drawer__hint">
              {speechOutputAdjustmentSupport.rate
                ? t('值越大，说话越快。', 'Higher values speak faster.')
                : t('当前提供商暂不直通语速调节。', 'The current provider does not expose rate control.')}
            </p>
          </div>

          <div className={`settings-tts-tuning__item ${speechOutputAdjustmentSupport.pitch ? '' : 'is-disabled'}`}>
            <div className="settings-tts-tuning__header">
              <strong>{t('语调', 'Pitch')}</strong>
              <span>{formatTtsAdjustmentValue('pitch', draft.speechPitch)}</span>
            </div>
            <div className="settings-tts-tuning__controls">
              <input
                className="settings-tts-tuning__range"
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={draft.speechPitch}
                disabled={!speechOutputAdjustmentSupport.pitch}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    speechPitch: clampNumber(parseNumberInput(event.target.value, prev.speechPitch), 0.5, 2),
                  }))
                }
              />
              <input
                className="settings-tts-tuning__number"
                type="number"
                min="0.5"
                max="2"
                step="0.05"
                value={draft.speechPitch}
                disabled={!speechOutputAdjustmentSupport.pitch}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    speechPitch: clampNumber(parseNumberInput(event.target.value, prev.speechPitch), 0.5, 2),
                  }))
                }
              />
            </div>
            <p className="settings-drawer__hint">
              {speechOutputAdjustmentSupport.pitch
                ? t('值越大，整体音调越高。', 'Higher values raise the overall pitch.')
                : t('当前提供商暂不支持直接调节语调。', 'The current provider does not support direct pitch control.')}
            </p>
          </div>

          <div className={`settings-tts-tuning__item ${speechOutputAdjustmentSupport.volume ? '' : 'is-disabled'}`}>
            <div className="settings-tts-tuning__header">
              <strong>{t('音量', 'Volume')}</strong>
              <span>{formatTtsAdjustmentValue('volume', draft.speechVolume)}</span>
            </div>
            <div className="settings-tts-tuning__controls">
              <input
                className="settings-tts-tuning__range"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={draft.speechVolume}
                disabled={!speechOutputAdjustmentSupport.volume}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    speechVolume: clampNumber(parseNumberInput(event.target.value, prev.speechVolume), 0, 1),
                  }))
                }
              />
              <input
                className="settings-tts-tuning__number"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.speechVolume}
                disabled={!speechOutputAdjustmentSupport.volume}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    speechVolume: clampNumber(parseNumberInput(event.target.value, prev.speechVolume), 0, 1),
                  }))
                }
              />
            </div>
            <p className="settings-drawer__hint">
              {speechOutputAdjustmentSupport.volume
                ? t('这里只调 TTS 输出响度，不会改系统总音量。', 'This only adjusts TTS output loudness — system volume is unchanged.')
                : t('当前提供商暂不支持直接调节音量。', 'The current provider does not support direct volume control.')}
            </p>
          </div>
        </div>
      </div>

      <label>
        <span>{t('试听文本', 'Preview text')}</span>
        <textarea
          rows={3}
          value={speechPreviewText}
          onChange={(event) => setSpeechPreviewText(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="ghost-button"
        onClick={onPreviewSpeech}
        disabled={previewingSpeech}
      >
        {previewingSpeech
          ? t('试听中...', 'Previewing...')
          : t('试听当前音色', 'Preview current voice')}
      </button>

      {speechPreviewStatus ? (
        <div className={speechPreviewStatus.ok ? 'settings-test-result is-success' : 'settings-test-result is-error'}>
          {speechPreviewStatus.message}
        </div>
      ) : null}

      {renderSpeechOutputTestResult()}
    </section>
  )
})
