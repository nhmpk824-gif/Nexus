import { memo, type Dispatch, type SetStateAction, useCallback, useState } from 'react'
import { parseNumberInput } from '../settingsDrawerSupport'
import { clampPresenceIntervalMinutes } from '../../lib/settings'
import { resolveLocalizedText } from '../../lib/uiLanguage'
import type { AppSettings, NotificationChannel } from '../../types'

// ── Channel management types ─────────────────────────────────────────────────

type ChannelManagerProps = {
  channels: NotificationChannel[]
  channelsLoading: boolean
  onAddChannel: (draft: Omit<NotificationChannel, 'id'>) => Promise<void>
  onUpdateChannel: (id: string, patch: Partial<NotificationChannel>) => Promise<void>
  onRemoveChannel: (id: string) => Promise<void>
}

type AutonomySectionProps = {
  active: boolean
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
} & Partial<ChannelManagerProps>

type TFunction = (zhCN: string, enUS: string) => string

// ── Helpers to reduce repetition in settings fields ──────────────────────────

type NumberFieldProps = {
  label: string
  field: keyof AppSettings
  min: number
  max: number
  step: number
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
}

function NumberField({ label, field, min, max, step, draft, setDraft }: NumberFieldProps) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft[field] as number}
        onChange={(e) => setDraft((prev) => ({
          ...prev,
          [field]: parseNumberInput(e.target.value, prev[field] as number),
        }))}
      />
    </label>
  )
}

type ToggleFieldProps = {
  label: string
  field: keyof AppSettings
  draft: AppSettings
  setDraft: Dispatch<SetStateAction<AppSettings>>
}

function ToggleField({ label, field, draft, setDraft }: ToggleFieldProps) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={draft[field] as boolean}
        onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.checked }))}
      />
    </label>
  )
}

type SubsectionHeaderProps = {
  title: string
  hint: string
}

function SubsectionHeader({ title, hint }: SubsectionHeaderProps) {
  return (
    <div className="settings-section__title-row" style={{ marginTop: 20 }}>
      <div>
        <h4>{title}</h4>
        <p className="settings-drawer__hint">{hint}</p>
      </div>
    </div>
  )
}

// ── Notification channels panel ──────────────────────────────────────────────

function NotificationChannelsPanel({
  channels,
  channelsLoading,
  onAddChannel,
  onUpdateChannel,
  onRemoveChannel,
  t,
}: ChannelManagerProps & { t: TFunction }) {
  const [addMode, setAddMode] = useState(false)
  const [rssUrl, setRssUrl] = useState('')
  const [rssName, setRssName] = useState('')
  const [rssInterval, setRssInterval] = useState(30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const resetForm = useCallback(() => {
    setAddMode(false)
    setRssUrl('')
    setRssName('')
    setRssInterval(30)
    setError('')
  }, [])

  const handleSaveRss = useCallback(async () => {
    const url = rssUrl.trim()
    if (!url) { setError(t('URL 不能为空', 'URL cannot be empty')); return }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError(t('URL 必须以 http:// 或 https:// 开头', 'URL must start with http:// or https://'))
      return
    }

    setSaving(true)
    setError('')
    try {
      const name = rssName.trim() || new URL(url).hostname
      await onAddChannel({
        kind: 'rss',
        name,
        enabled: true,
        config: { url },
        checkIntervalMinutes: rssInterval,
      })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('保存失败', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }, [rssUrl, rssName, rssInterval, onAddChannel, resetForm, t])

  if (channelsLoading) {
    return <p className="settings-drawer__hint">{t('加载频道配置...', 'Loading channels...')}</p>
  }

  const rssChannels = channels.filter((c) => c.kind === 'rss')

  return (
    <div style={{ marginTop: 8 }}>
      {/* Static webhook info */}
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color, #333)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'var(--accent-color, #4a6)',
            color: '#fff',
          }}>
            Webhook
          </span>
          <span style={{ fontWeight: 500 }}>{t('本地 Webhook', 'Local Webhook')}</span>
        </div>
        <code style={{
          display: 'block',
          fontSize: 12,
          marginTop: 4,
          padding: '4px 8px',
          borderRadius: 4,
          background: 'var(--input-bg, #1a1a1a)',
          userSelect: 'all',
        }}>
          POST http://127.0.0.1:47830/webhook
        </code>
        <p className="settings-drawer__hint" style={{ marginTop: 2 }}>
          {t(
            '发送 JSON: { "title": "...", "body": "...", "source": "..." }',
            'Send JSON: { "title": "...", "body": "...", "source": "..." }',
          )}
        </p>
      </div>

      {/* RSS channel rows */}
      {rssChannels.map((ch) => (
        <div key={ch.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 0',
          borderBottom: '1px solid var(--border-color, #333)',
        }}>
          <span style={{
            fontSize: 11,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'var(--warning-color, #c80)',
            color: '#fff',
            flexShrink: 0,
          }}>
            RSS
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500 }}>{ch.name}</div>
            <div style={{ fontSize: 12, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ch.config.url}
            </div>
          </div>
          <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>
            {ch.checkIntervalMinutes}min
          </span>
          <label className="settings-toggle" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={ch.enabled}
              onChange={() => void onUpdateChannel(ch.id, { enabled: !ch.enabled })}
            />
          </label>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--error-color, #e55)',
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
            }}
            onClick={() => void onRemoveChannel(ch.id)}
            title={t('删除', 'Delete')}
          >
            x
          </button>
        </div>
      ))}

      {/* Add RSS form */}
      {addMode ? (
        <div style={{ padding: '10px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type="url"
              placeholder={t('RSS 源 URL (https://...)', 'RSS feed URL (https://...)')}
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={t('名称（可选，默认取域名）', 'Name (optional, defaults to hostname)')}
                value={rssName}
                onChange={(e) => setRssName(e.target.value)}
                style={{ flex: 1 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  value={rssInterval}
                  onChange={(e) => setRssInterval(Number(e.target.value) || 30)}
                  style={{ width: 60 }}
                />
                <span style={{ fontSize: 12 }}>{t('分钟', 'min')}</span>
              </label>
            </div>
            {error && <p style={{ color: 'var(--error-color, #e55)', fontSize: 12, margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void handleSaveRss()} disabled={saving}>
                {saving ? t('保存中...', 'Saving...') : t('添加', 'Add')}
              </button>
              <button type="button" onClick={resetForm}>{t('取消', 'Cancel')}</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddMode(true)}
          style={{
            marginTop: 8,
            background: 'none',
            border: '1px dashed var(--border-color, #555)',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'inherit',
            width: '100%',
          }}
        >
          {t('+ 添加 RSS 源', '+ Add RSS feed')}
        </button>
      )}
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

export const AutonomySection = memo(function AutonomySection({
  active,
  draft,
  setDraft,
  channels,
  channelsLoading,
  onAddChannel,
  onUpdateChannel,
  onRemoveChannel,
}: AutonomySectionProps) {
  const t: TFunction = (zhCN, enUS) =>
    resolveLocalizedText(draft.uiLanguage, { 'zh-CN': zhCN, 'en-US': enUS })
  const fieldProps = { draft, setDraft }

  const hasChannelProps = channels !== undefined
    && onAddChannel !== undefined
    && onUpdateChannel !== undefined
    && onRemoveChannel !== undefined

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>

      {/* ── Master switch ────────────────────────────────────────────────── */}
      <div className="settings-section__title-row">
        <div>
          <h4>{t('自治引擎', 'Autonomy Engine')}</h4>
          <p className="settings-drawer__hint">
            {t(
              '开启后，伴侣会根据你的桌面活动、空闲状态和上下文自主决策何时说话、安静或整理记忆。下面每个子模块默认关闭，只有你手动打开的才会产生 API 调用。',
              'When enabled, your companion decides on its own when to speak, stay quiet, or consolidate memory based on desktop activity, idle state and context. Each sub-module below is off by default — only the ones you explicitly turn on will make API calls.',
            )}
          </p>
        </div>
      </div>

      <ToggleField label={t('启用自治引擎', 'Enable autonomy engine')} field="autonomyEnabled" {...fieldProps} />

      {/* ── Proactive Presence (basic fallback) ──────────────────────────── */}
      <SubsectionHeader
        title={t('待机陪伴（基础模式）', 'Proactive Presence (basic mode)')}
        hint={t(
          '自治引擎关闭时生效：空闲一段时间后主动跟你打招呼。启用自治引擎后由其接管，本项自动失效。',
          'Active when the autonomy engine is off — greets you after a period of inactivity. Yields to the autonomy engine when that is enabled.',
        )}
      />

      <ToggleField label={t('启用待机主动陪伴', 'Enable proactive presence')} field="proactivePresenceEnabled" {...fieldProps} />

      {draft.proactivePresenceEnabled && (
        <label>
          <span>{t('主动陪伴间隔（分钟）', 'Presence interval (minutes)')}</span>
          <input
            type="number"
            min="5"
            max="120"
            step="1"
            value={draft.proactivePresenceIntervalMinutes}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                proactivePresenceIntervalMinutes: clampPresenceIntervalMinutes(
                  parseNumberInput(event.target.value, prev.proactivePresenceIntervalMinutes),
                ),
              }))
            }
          />
        </label>
      )}

      {/* ── Tick Loop & Sleep ─────────────────────────────────────────────── */}
      {draft.autonomyEnabled && (
        <>
          <SubsectionHeader
            title={t('心跳与休眠', 'Tick & Sleep')}
            hint={t(
              '控制自治循环的节奏。心跳间隔决定检查频率，空闲超时决定何时进入休眠。',
              'Controls the pace of the autonomy loop. Tick interval sets the check frequency; idle timeout decides when to enter sleep.',
            )}
          />

          <div className="settings-grid">
            <NumberField label={t('心跳间隔（秒）', 'Tick interval (seconds)')} field="autonomyTickIntervalSeconds" min={10} max={300} step={5} {...fieldProps} />
            <NumberField label={t('空闲多久后休眠（分钟）', 'Sleep after idle (minutes)')} field="autonomySleepAfterIdleMinutes" min={5} max={120} step={5} {...fieldProps} />
            <NumberField label={t('每日 tick 上限', 'Daily tick limit')} field="autonomyCostLimitDailyTicks" min={10} max={1000} step={10} {...fieldProps} />
          </div>

          <ToggleField label={t('用户输入时自动唤醒', 'Wake on user input')} field="autonomyWakeOnInput" {...fieldProps} />

          <div className="settings-grid">
            <NumberField label={t('安静时间（开始）', 'Quiet hours start')} field="autonomyQuietHoursStart" min={0} max={23} step={1} {...fieldProps} />
            <NumberField label={t('安静时间（结束）', 'Quiet hours end')} field="autonomyQuietHoursEnd" min={0} max={23} step={1} {...fieldProps} />
          </div>

          <p className="settings-drawer__hint">
            {t('安静时间内不会主动说话', 'No proactive speech during quiet hours')}
            {` (${draft.autonomyQuietHoursStart}:00 ~ ${draft.autonomyQuietHoursEnd}:00)`}
          </p>

          {/* ── Focus Awareness ─────────────────────────────────────────────── */}
          <SubsectionHeader
            title={t('焦点感知', 'Focus Awareness')}
            hint={t(
              '通过系统空闲时间和锁屏事件判断你的状态（活跃 → 空闲 → 离开 → 锁屏），决定是否主动说话。',
              'Uses system idle time and lock events to infer your state (active → idle → away → locked) and decide whether to speak proactively.',
            )}
          />

          <ToggleField label={t('启用焦点感知', 'Enable focus awareness')} field="autonomyFocusAwarenessEnabled" {...fieldProps} />

          <div className="settings-grid">
            <NumberField label={t('空闲判定阈值（秒）', 'Idle threshold (seconds)')} field="autonomyIdleThresholdSeconds" min={60} max={1800} step={30} {...fieldProps} />
          </div>

          {/* ── Memory Dream ───────────────────────────────────────────────── */}
          <SubsectionHeader
            title={t('记忆整理（Dream）', 'Memory Consolidation (Dream)')}
            hint={t(
              '休眠阶段自动用 LLM 整理近期对话，归纳成结构化长期记忆。会消耗一次 API 调用。',
              'During sleep, an LLM summarizes recent conversations into structured long-term memory. Each run consumes one API call.',
            )}
          />

          <ToggleField label={t('启用记忆整理', 'Enable memory consolidation')} field="autonomyDreamEnabled" {...fieldProps} />

          {draft.autonomyDreamEnabled && (
            <div className="settings-grid">
              <NumberField label={t('整理间隔（小时）', 'Consolidation interval (hours)')} field="autonomyDreamIntervalHours" min={1} max={168} step={1} {...fieldProps} />
              <NumberField label={t('触发前最少对话数', 'Minimum sessions before trigger')} field="autonomyDreamMinSessions" min={1} max={50} step={1} {...fieldProps} />
            </div>
          )}

          {/* ── Inner Monologue ──────────────────────────────────────────── */}
          <SubsectionHeader
            title={t('内心独白', 'Inner Monologue')}
            hint={t(
              '定期用 LLM 产生内心想法，当紧迫度超过阈值时主动开口说话。每次消耗一次轻量 API 调用。',
              'Periodically generates inner thoughts via LLM; speaks up when urgency exceeds the threshold. Each run consumes one lightweight API call.',
            )}
          />

          <ToggleField label={t('启用内心独白', 'Enable inner monologue')} field="autonomyMonologueEnabled" {...fieldProps} />

          {draft.autonomyMonologueEnabled && (
            <div className="settings-grid">
              <NumberField label={t('独白间隔（tick 数）', 'Monologue interval (ticks)')} field="autonomyMonologueIntervalTicks" min={2} max={30} step={1} {...fieldProps} />
              <NumberField label={t('开口阈值（0-100）', 'Speech threshold (0-100)')} field="autonomyMonologueSpeechThreshold" min={0} max={100} step={5} {...fieldProps} />
            </div>
          )}

          {draft.autonomyMonologueEnabled && (
            <p className="settings-drawer__hint">
              {t(
                '阈值越低越容易开口（0 = 每次都说，100 = 永远不说）。建议从 50 开始调。',
                'Lower = speaks more easily (0 = always, 100 = never). Start around 50 and adjust.',
              )}
            </p>
          )}

          {/* ── Context Triggers ────────────────────────────────────────────── */}
          <SubsectionHeader
            title={t('上下文触发器', 'Context Triggers')}
            hint={t(
              '根据桌面活动（切换应用、剪贴板变化、空闲时长等）自动触发提醒或动作。',
              'Fires reminders or actions automatically based on desktop activity (app switches, clipboard changes, idle duration, etc.).',
            )}
          />

          <ToggleField label={t('启用上下文触发器', 'Enable context triggers')} field="autonomyContextTriggersEnabled" {...fieldProps} />

          {/* ── Notification Bridge ─────────────────────────────────────────── */}
          <SubsectionHeader
            title={t('外部通知桥', 'External Notification Bridge')}
            hint={t(
              '开启本地 webhook 服务器和 RSS 轮询，将外部通知推送到伴侣对话中。',
              'Starts a local webhook server and RSS polling to push external notifications into the companion conversation.',
            )}
          />

          <ToggleField label={t('启用通知桥', 'Enable notification bridge')} field="autonomyNotificationsEnabled" {...fieldProps} />

          {draft.autonomyNotificationsEnabled && hasChannelProps && (
            <NotificationChannelsPanel
              channels={channels}
              channelsLoading={channelsLoading ?? true}
              onAddChannel={onAddChannel}
              onUpdateChannel={onUpdateChannel}
              onRemoveChannel={onRemoveChannel}
              t={t}
            />
          )}
        </>
      )}
    </section>
  )
})
