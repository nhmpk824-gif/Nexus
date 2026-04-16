import { memo, type Dispatch, type SetStateAction } from 'react'
import {
  getWebSearchProviderPreset,
  resolveWebSearchApiBaseUrl,
  WEB_SEARCH_PROVIDER_PRESETS,
} from '../../lib/webSearchProviders'
import { resolveLocalizedText } from '../../lib/uiLanguage'
import type { AppSettings } from '../../types'
import { UrlInput } from './UrlInput'

type ToolsSectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
}

export const ToolsSection = memo(function ToolsSection({
  active,
  draft,
  setDraft,
}: ToolsSectionProps) {
  const t = (zhCN: string, enUS: string) =>
    resolveLocalizedText(draft.uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })
  const webSearchProvider = getWebSearchProviderPreset(draft.toolWebSearchProviderId)

  function applyWebSearchProviderPreset(providerId: string) {
    const preset = getWebSearchProviderPreset(providerId)

    setDraft((prev) => ({
      ...prev,
      toolWebSearchProviderId: preset.id,
      toolWebSearchApiBaseUrl: resolveWebSearchApiBaseUrl(preset.id, prev.toolWebSearchApiBaseUrl),
      toolWebSearchApiKey: preset.id === prev.toolWebSearchProviderId
        ? prev.toolWebSearchApiKey
        : '',
    }))
  }

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{t('内置工具', 'Built-in tools')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '大模型在回答你时可以主动调用下面这些工具。关掉开关后，助手就不会再自己去搜网页或查天气，需要的话你得自己动手。',
              'The companion can call these tools automatically while replying. Turning a switch off means it will never use that tool on its own — you will need to look the information up yourself.',
            )}
          </p>
        </div>
      </div>

      <label className="settings-toggle">
        <span>{t('网页搜索', 'Web search')}</span>
        <input
          type="checkbox"
          checked={draft.toolWebSearchEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolWebSearchEnabled: event.target.checked,
            }))
          }
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '关掉之后，当你问"最近的新闻 / 这个人是谁 / 这首歌叫什么"这类问题时，助手只能凭训练数据回答，可能过时。开启后你的问题会被发送给下方配置的搜索后端。',
          'When off, questions like "latest news / who is this person / what song is this" only use the model\'s training data and may be stale. When on, your query is sent to the search backend configured below.',
        )}
      </p>

      <label className="settings-toggle">
        <span>{t('天气查询', 'Weather lookup')}</span>
        <input
          type="checkbox"
          checked={draft.toolWeatherEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolWeatherEnabled: event.target.checked,
            }))
          }
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '使用免费的 Open-Meteo 查今天 / 明天的天气。开启时会把你提到的地名发给 Open-Meteo 用于查询，没有 API Key 也能工作。',
          'Uses the free Open-Meteo API to fetch current and next-day forecasts. When on, the location you mention is sent to Open-Meteo; no API key is required.',
        )}
      </p>

      <label className="settings-toggle">
        <span>{t('打开外部链接', 'Open external links')}</span>
        <input
          type="checkbox"
          checked={draft.toolOpenExternalEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolOpenExternalEnabled: event.target.checked,
            }))
          }
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '允许助手把 http/https 链接送到你的默认浏览器打开。常用于"帮我打开 GitHub"之类的请求。建议保留下面的"需要确认"选项，避免模型误判直接弹出网页。',
          'Lets the companion hand an http(s) URL off to your default browser. Useful for requests like "open GitHub for me". Keeping the confirmation switch below on is recommended so the model cannot pop pages on its own.',
        )}
      </p>

      <label className="settings-toggle">
        <span>{t('打开外链前需要确认', 'Confirm before opening')}</span>
        <input
          type="checkbox"
          checked={draft.toolOpenExternalRequiresConfirmation}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolOpenExternalRequiresConfirmation: event.target.checked,
            }))
          }
          disabled={!draft.toolOpenExternalEnabled}
        />
      </label>

      <div className="settings-section__title-row">
        <div>
          <h4>{t('网页搜索后端', 'Web search backend')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '选择助手调用网页搜索时用哪家服务。Tavily / Perplexity 这类商用 provider 需要 API Key 但质量更高；其他的免费或半免费。当前选中的 provider 无法访问时会自动降级到内置 Bing RSS。',
              'Pick which service the companion uses when it calls the web search tool. Commercial providers like Tavily / Perplexity require an API key but give the best results; the others are free or semi-free. If the selected provider can\'t be reached, Nexus falls back to built-in Bing RSS.',
            )}
          </p>
        </div>
      </div>

      <label>
        <span>{t('搜索服务商', 'Search provider')}</span>
        <select
          value={draft.toolWebSearchProviderId}
          onChange={(event) => applyWebSearchProviderPreset(event.target.value)}
          disabled={!draft.toolWebSearchEnabled}
        >
          {WEB_SEARCH_PROVIDER_PRESETS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <p className="settings-drawer__hint">
        {webSearchProvider.description}
        {webSearchProvider.baseUrl
          ? ` ${t('默认地址：', 'Default URL: ')}${webSearchProvider.baseUrl}`
          : ''}
      </p>

      <label>
        <span>{t('API Base URL', 'API base URL')}</span>
        <UrlInput
          value={draft.toolWebSearchApiBaseUrl}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolWebSearchApiBaseUrl: event.target.value,
            }))
          }
          placeholder={webSearchProvider.baseUrl || t('当前服务商不需要填写', 'Not required for this provider')}
          disabled={!draft.toolWebSearchEnabled || !webSearchProvider.supportsBaseUrlOverride}
        />
      </label>

      <label>
        <span>{t('API Key', 'API key')}</span>
        <input
          type="password"
          value={draft.toolWebSearchApiKey}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolWebSearchApiKey: event.target.value,
            }))
          }
          placeholder={webSearchProvider.apiKeyPlaceholder || t('当前服务商不需要填写', 'Not required for this provider')}
          disabled={!draft.toolWebSearchEnabled || !webSearchProvider.requiresApiKey}
        />
      </label>

      <label className="settings-toggle">
        <span>{t('服务商失败时自动回退到 Bing', 'Fall back to Bing on provider failure')}</span>
        <input
          type="checkbox"
          checked={draft.toolWebSearchFallbackToBing}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolWebSearchFallbackToBing: event.target.checked,
            }))
          }
          disabled={!draft.toolWebSearchEnabled}
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '关掉这个开关后，选中的服务商（比如 Tavily）报错就直接返回失败，助手会告诉你搜索不可用。开启后会无声降级到 Bing RSS，一定有结果但可能不如你选的服务商准。',
          'When off, a failure from your chosen provider (e.g. Tavily) surfaces directly and the companion will say search is unavailable. When on, Nexus silently falls back to Bing RSS — you always get a result but it may be less accurate than your chosen provider.',
        )}
      </p>

      <label>
        <span>{t('天气默认地点', 'Default weather location')}</span>
        <input
          value={draft.toolWeatherDefaultLocation}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              toolWeatherDefaultLocation: event.target.value,
            }))
          }
          placeholder={t('例如：深圳', 'e.g. Shenzhen')}
          disabled={!draft.toolWeatherEnabled}
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '当你问"今天天气怎么样"但没说城市时，助手用这个地点去查。可以填中文（深圳）、英文（Shenzhen）或带国家的组合（Shenzhen, CN）。',
          'Used when you ask "what\'s the weather" without naming a city. Accepts Chinese (深圳), English (Shenzhen), or a country-qualified form (Shenzhen, CN).',
        )}
      </p>
    </section>
  )
})
