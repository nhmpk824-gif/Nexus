import { memo, useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { API_PROVIDER_PRESETS, getApiProviderPreset } from '../../lib/apiProviders'
import {
  getCoreRuntime,
  removeAuthProfileFromRuntime,
  upsertAuthProfileInRuntime,
} from '../../lib/coreRuntime'
import type { AppSettings, ServiceConnectionCapability } from '../../types'
import { UrlInput } from './UrlInput'

type ModelSectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
  testingTarget: ServiceConnectionCapability | null
  textProvider: {
    notes: string
    baseUrl?: string
    defaultModel?: string
  }
  t: (zhCN: string, enUS: string) => string
  onApplyTextProviderPreset: (providerId: string) => void
  onRunTextConnectionTest: () => void
  renderTextTestResult: () => ReactNode
}

export const ModelSection = memo(function ModelSection({
  active,
  draft,
  setDraft,
  testingTarget,
  textProvider,
  t,
  onApplyTextProviderPreset,
  onRunTextConnectionTest,
  renderTextTestResult,
}: ModelSectionProps) {
  const currentPreset = getApiProviderPreset(draft.apiProviderId)
  const hasModelOptions = currentPreset.models.length > 0

  const [extraKeysText, setExtraKeysText] = useState('')
  useEffect(() => {
    const runtime = getCoreRuntime()
    const existing = runtime.authStore
      .list(draft.apiProviderId)
      .map((p) => p.apiKey)
      .filter((k) => k && k.trim().length > 0)
    setExtraKeysText(existing.join('\n'))
  }, [draft.apiProviderId])

  const commitExtraKeys = () => {
    const runtime = getCoreRuntime()
    const existingProfiles = runtime.authStore.list(draft.apiProviderId)
    const nextKeys = extraKeysText
      .split(/\r?\n/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    const nextSet = new Set(nextKeys)
    for (const profile of existingProfiles) {
      if (!nextSet.has(profile.apiKey)) {
        removeAuthProfileFromRuntime(profile.id)
      }
    }
    const have = new Set(existingProfiles.map((p) => p.apiKey))
    nextKeys.forEach((key, index) => {
      if (have.has(key)) return
      upsertAuthProfileInRuntime({
        id: `${draft.apiProviderId}:${Date.now()}:${index}`,
        providerId: draft.apiProviderId,
        apiKey: key,
        status: 'active',
        successCount: 0,
        failureCount: 0,
      })
    })
  }

  const textProviderOptions = useMemo(
    () => API_PROVIDER_PRESETS.filter((provider) => provider.defaultModel),
    [],
  )

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{t('模型与主链路', 'Model & Primary Route')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '选择大模型提供商和模型，填入 API 地址和密钥。可以开启自动切换，在主接口不可用时自动切到备选。',
              'Pick your LLM provider and model, then enter the API endpoint and key. You can enable failover so the app automatically switches to a backup when the primary goes down.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={onRunTextConnectionTest}
          disabled={testingTarget === 'text'}
        >
          {testingTarget === 'text'
            ? t('测试中...', 'Testing...')
            : t('测试文本接口', 'Test text endpoint')}
        </button>
      </div>

      <label>
        <span>{t('模型选择', 'Model selection')}</span>
        <select
          value={draft.apiProviderId}
          onChange={(event) => onApplyTextProviderPreset(event.target.value)}
        >
          {textProviderOptions.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <p className="settings-drawer__hint">
        {textProvider.notes}
        {textProvider.baseUrl
          ? ` ${t('默认地址：', 'Default endpoint: ')}${textProvider.baseUrl}`
          : ''}
        {textProvider.defaultModel
          ? `${t('，推荐模型：', ' · Recommended model: ')}${textProvider.defaultModel}`
          : ''}
      </p>

      <label>
        <span>{t('文本接口地址', 'Text endpoint URL')}</span>
        <UrlInput
          value={draft.apiBaseUrl}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, apiBaseUrl: event.target.value }))
          }
        />
      </label>

      <label>
        <span>{t('文本接口密钥', 'Text API key')}</span>
        <input
          type="password"
          value={draft.apiKey}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, apiKey: event.target.value }))
          }
        />
      </label>

      <label>
        <span>{t('文本模型', 'Text model')}</span>
        {hasModelOptions ? (
          <select
            value={draft.model}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, model: event.target.value }))
            }
          >
            {currentPreset.models.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
            {!currentPreset.models.includes(draft.model) && draft.model && (
              <option value={draft.model}>
                {draft.model} {t('(自定义)', '(custom)')}
              </option>
            )}
          </select>
        ) : (
          <input
            value={draft.model}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, model: event.target.value }))
            }
          />
        )}
      </label>

      <label className="settings-toggle">
        <span>{t('启用聊天模型自动切换', 'Enable chat model failover')}</span>
        <input
          type="checkbox"
          checked={draft.chatFailoverEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              chatFailoverEnabled: event.target.checked,
            }))
          }
        />
      </label>

      <p className="settings-drawer__hint">
        {t(
          '当前主链路失败时，会自动尝试切换到备用 provider，并对故障 provider 做短时冷却。',
          'When the primary route fails, the app automatically falls back to a backup provider and briefly cools down the failing one.',
        )}
      </p>

      <label>
        <span>{t('附加 API Keys（一行一个，用于自动轮换）', 'Additional API keys (one per line, used for auto-rotation)')}</span>
        <textarea
          rows={3}
          placeholder={'sk-extra-key-1\nsk-extra-key-2'}
          value={extraKeysText}
          onChange={(event) => setExtraKeysText(event.target.value)}
          onBlur={commitExtraKeys}
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '这些密钥会与主密钥一同加入失败转移轮换池，限流或报错时自动切换到下一把钥匙。',
          'These keys join the primary key in the failover rotation pool. On rate-limit or error, the app switches to the next key.',
        )}
      </p>

      <label className="settings-toggle">
        <span>{t('启用智能模型分级路由', 'Enable smart model tier routing')}</span>
        <input
          type="checkbox"
          checked={draft.smartModelRoutingEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              smartModelRoutingEnabled: event.target.checked,
            }))
          }
        />
      </label>
      <p className="settings-drawer__hint">
        {t(
          '开启后，会根据问题复杂度在下面三档模型之间自动切换，预算吃紧时自动降级。',
          'Once enabled, the app routes between the three tiers below based on question complexity, and downgrades when the budget runs low.',
        )}
      </p>

      <label>
        <span>{t('便宜档模型（短问答 / 闲聊）', 'Cheap tier (short Q&A / small talk)')}</span>
        <input
          value={draft.modelCheap}
          placeholder={currentPreset.defaultModel ?? ''}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, modelCheap: event.target.value }))
          }
        />
      </label>
      <label>
        <span>{t('标准档模型（默认）', 'Standard tier (default)')}</span>
        <input
          value={draft.modelStandard}
          placeholder={draft.model}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, modelStandard: event.target.value }))
          }
        />
      </label>
      <label>
        <span>{t('重型档模型（长推理 / 复杂代码）', 'Heavy tier (long reasoning / complex code)')}</span>
        <input
          value={draft.modelHeavy}
          placeholder={currentPreset.defaultModel ?? ''}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, modelHeavy: event.target.value }))
          }
        />
      </label>

      <label>
        <span>{t('日预算上限（USD）', 'Daily budget cap (USD)')}</span>
        <input
          type="number"
          step="0.1"
          min="0"
          value={draft.budgetDailyCapUsd || ''}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              budgetDailyCapUsd: Number(event.target.value) || 0,
            }))
          }
        />
      </label>
      <label>
        <span>{t('月预算上限（USD）', 'Monthly budget cap (USD)')}</span>
        <input
          type="number"
          step="1"
          min="0"
          value={draft.budgetMonthlyCapUsd || ''}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              budgetMonthlyCapUsd: Number(event.target.value) || 0,
            }))
          }
        />
      </label>
      <label>
        <span>{t('降级阈值（0 = 立刻降级，1 = 用完再降）', 'Downgrade threshold (0 = downgrade immediately, 1 = only at cap)')}</span>
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={draft.budgetDowngradeRatio}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              budgetDowngradeRatio: Number(event.target.value) || 0,
            }))
          }
        />
      </label>
      <label className="settings-toggle">
        <span>{t('超出预算时硬停止（不再发请求）', 'Hard-stop when over budget (block further requests)')}</span>
        <input
          type="checkbox"
          checked={draft.budgetHardStopEnabled}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              budgetHardStopEnabled: event.target.checked,
            }))
          }
        />
      </label>

      {renderTextTestResult()}
    </section>
  )
})
