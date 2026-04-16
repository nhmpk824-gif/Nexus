import { memo } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import {
  buildVolcengineCredential,
  parseVolcengineCredentialParts,
  type VolcengineCredentialParts,
} from '../settingsDrawerSupport'
import {
  getSpeechInputModelOptions,
  getSpeechInputProviderPreset,
  isSenseVoiceSpeechInputProvider,
  isSpeechInputLocal,
  isVolcengineSpeechInputProvider,
} from '../../lib/audioProviders'
import { SPEECH_INPUT_PROVIDERS } from '../../lib/providerCatalog'
import {
  switchSpeechInputProvider,
  updateCurrentSpeechInputProviderProfile,
} from '../../lib/speechProviderProfiles'
import { resolveLocalizedText } from '../../lib/uiLanguage'
import type { AppSettings, ServiceConnectionCapability } from '../../types'
import { UrlInput } from './UrlInput'

const speechInputSelectOptions = SPEECH_INPUT_PROVIDERS
  .filter((p) => !p.hidden)
  .map((p) => ({ id: p.id, label: p.label }))

type SpeechInputSectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
  testingTarget: ServiceConnectionCapability | null
  onRunSpeechInputConnectionTest: () => void
  renderSpeechInputTestResult: () => ReactNode
}

export const SpeechInputSection = memo(function SpeechInputSection({
  active,
  draft,
  setDraft,
  testingTarget,
  onRunSpeechInputConnectionTest,
  renderSpeechInputTestResult,
}: SpeechInputSectionProps) {
  const t = (zhCN: string, enUS: string) =>
    resolveLocalizedText(draft.uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })
  const speechInputProvider = getSpeechInputProviderPreset(draft.speechInputProviderId)
  const speechInputModelOptions = getSpeechInputModelOptions(draft.speechInputProviderId)
  const isSenseVoiceSpeechInput = isSenseVoiceSpeechInputProvider(draft.speechInputProviderId)
  const isLocalSpeechInput = isSpeechInputLocal(draft.speechInputProviderId)
  const isVolcengineSpeechInput = isVolcengineSpeechInputProvider(draft.speechInputProviderId)
  const showSpeechInputBaseUrl = !isLocalSpeechInput || !!speechInputProvider.baseUrl
  const showSpeechInputCredentials = !isLocalSpeechInput
  const speechInputVolcengineCredentials = parseVolcengineCredentialParts(draft.speechInputApiKey)
  const speechInputModelLabel = isSenseVoiceSpeechInput
    ? t('SenseVoice 模型', 'SenseVoice model')
    : t('语音输入模型', 'Speech input model')
  const speechInputModelHint = isSenseVoiceSpeechInput
    ? t(
        '需要先把 sherpa-onnx-sense-voice-zh-en-2024-07-17 目录放到 `sherpa-models` 下。10秒音频仅需70ms，中文识别准确率极高。',
        'First drop the `sherpa-onnx-sense-voice-zh-en-2024-07-17` directory into `sherpa-models`. 10 s of audio only takes ~70 ms and Chinese recognition accuracy is excellent.',
      )
    : ''

  function applySpeechInputPreset(providerId: string) {
    setDraft((prev) => switchSpeechInputProvider(prev, providerId))
  }

  function updateSpeechInputVolcengineCredential(partial: Partial<VolcengineCredentialParts>) {
    setDraft((prev) => {
      const current = parseVolcengineCredentialParts(prev.speechInputApiKey)
      return updateCurrentSpeechInputProviderProfile(prev, {
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
          <h4>{t('语音输入 STT', 'Speech Input (STT)')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '支持浏览器本地识别，也支持内置云端语音转文字。',
              'Supports in-browser recognition as well as built-in cloud speech-to-text.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={onRunSpeechInputConnectionTest}
          disabled={testingTarget === 'speech-input'}
        >
          {testingTarget === 'speech-input'
            ? t('测试中...', 'Testing...')
            : t('测试语音输入', 'Test speech input')}
        </button>
      </div>

      <label>
        <span>{t('语音输入提供商', 'Speech input provider')}</span>
        <select
          value={draft.speechInputProviderId}
          onChange={(event) => applySpeechInputPreset(event.target.value)}
        >
          {speechInputSelectOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>

      <p className="settings-drawer__hint">
        {speechInputProvider.notes}
        {speechInputProvider.baseUrl
          ? ` ${t('默认地址：', 'Default endpoint: ')}${speechInputProvider.baseUrl}`
          : ''}
        {speechInputProvider.defaultModel
          ? `${t('，默认模型：', ' · Default model: ')}${speechInputProvider.defaultModel}`
          : ''}
      </p>

      {showSpeechInputBaseUrl ? (
        <label>
          <span>{t('语音输入接口地址', 'Speech input endpoint URL')}</span>
          <UrlInput
            value={draft.speechInputApiBaseUrl}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechInputProviderProfile(prev, {
                apiBaseUrl: event.target.value,
              }))
            }
          />
        </label>
      ) : null}

      {showSpeechInputCredentials && isVolcengineSpeechInput ? (
        <>
          <div className="settings-grid settings-grid--two">
            <label>
              <span>{t('火山 App ID', 'Volcengine App ID')}</span>
              <input
                value={speechInputVolcengineCredentials.appId}
                onChange={(event) =>
                  updateSpeechInputVolcengineCredential({
                    appId: event.target.value,
                  })
                }
              />
            </label>

            <label>
              <span>{t('火山访问令牌', 'Volcengine access token')}</span>
              <input
                type="password"
                value={speechInputVolcengineCredentials.accessToken}
                onChange={(event) =>
                  updateSpeechInputVolcengineCredential({
                    accessToken: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <p className="settings-drawer__hint">
            {t(
              '这里分开填写即可，保存时会自动拼成 `APP_ID:ACCESS_TOKEN`。如果你复制的是带标签的两行文本，也可以直接粘进"访问令牌"一栏试一下。',
              'Fill these in separately — on save they are combined into `APP_ID:ACCESS_TOKEN`. If you copied a labeled two-line block, you can also paste it straight into the access token field.',
            )}
          </p>
        </>
      ) : showSpeechInputCredentials ? (
        <label>
          <span>{t('语音输入密钥', 'Speech input API key')}</span>
          <input
            type="password"
            value={draft.speechInputApiKey}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechInputProviderProfile(prev, {
                apiKey: event.target.value,
              }))
            }
          />
        </label>
      ) : null}

      <label>
        <span>{speechInputModelLabel}</span>
        {speechInputModelOptions.length ? (
          <select
            value={draft.speechInputModel}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechInputProviderProfile(prev, {
                model: event.target.value,
              }))
            }
          >
            {speechInputModelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={draft.speechInputModel}
            onChange={(event) =>
              setDraft((prev) => updateCurrentSpeechInputProviderProfile(prev, {
                model: event.target.value,
              }))
            }
          />
        )}
      </label>

      {speechInputModelHint ? (
        <p className="settings-drawer__hint">{speechInputModelHint}</p>
      ) : null}

      <label>
        <span>{t('识别语言', 'Recognition language')}</span>
        <input
          value={draft.speechRecognitionLang}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              speechRecognitionLang: event.target.value,
            }))
          }
        />
      </label>

      {draft.speechInputProviderId === 'zhipu-stt' ? (
        <label>
          <span>{t('热词（提升人名/专有名词识别）', 'Hotwords (improves recognition of names and proper nouns)')}</span>
          <input
            value={draft.speechInputHotwords}
            placeholder={t('周传雄,黄昏,以逗号分隔', 'e.g. Steve Chou, Dusk, comma separated')}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                speechInputHotwords: event.target.value,
              }))
            }
          />
          <p className="settings-drawer__hint">
            {t(
              '容易被识别错的人名、歌名、专有名词，用逗号分隔，最多 100 个。',
              'Easily misrecognized names, song titles and proper nouns, comma separated, up to 100 entries.',
            )}
          </p>
        </label>
      ) : null}

      {renderSpeechInputTestResult()}
    </section>
  )
})
