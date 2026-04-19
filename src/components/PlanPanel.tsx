import { memo, useEffect, useState } from 'react'
import { planStore, type Plan, type PlanStepStatus } from '../features/plan/planStore'
import { useTranslation } from '../i18n/useTranslation.ts'
import type { TranslationKey } from '../types/i18n'

const STATUS_LABEL_KEY: Record<Plan['status'], TranslationKey> = {
  draft: 'plan.status.draft',
  active: 'plan.status.active',
  completed: 'plan.status.completed',
  aborted: 'plan.status.aborted',
}

const STEP_ICON: Record<PlanStepStatus, string> = {
  pending: '○',
  in_progress: '◐',
  completed: '●',
  skipped: '◌',
  failed: '✕',
}

const STEP_COLOR: Record<PlanStepStatus, string> = {
  pending: '#94a3b8',
  in_progress: '#fbbf24',
  completed: '#34d399',
  skipped: '#64748b',
  failed: '#f87171',
}

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

const PlanRow = memo(function PlanRow({ plan, onRemove }: { plan: Plan; onRemove: () => void }) {
  const { t } = useTranslation()
  const completedCount = plan.steps.filter((s) => s.status === 'completed').length
  const total = plan.steps.length

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          {plan.goal}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{formatTime(plan.updatedAt)}</div>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, marginBottom: 8 }}>
        {t(STATUS_LABEL_KEY[plan.status])} · {completedCount}/{total}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {plan.steps.map((step) => (
          <li
            key={step.id}
            style={{
              fontSize: 12,
              padding: '4px 0',
              color: '#cbd5e1',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: STEP_COLOR[step.status], fontWeight: 700, minWidth: 14 }}>
              {STEP_ICON[step.status]}
            </span>
            <span style={{ flex: 1, textDecoration: step.status === 'skipped' ? 'line-through' : 'none' }}>
              {step.text}
              {step.result && step.status === 'failed' && (
                <span style={{ display: 'block', fontSize: 11, color: '#f87171', marginTop: 2 }}>
                  {step.result}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {(plan.status === 'completed' || plan.status === 'aborted') && (
        <button
          onClick={onRemove}
          style={{
            marginTop: 8,
            padding: '4px 10px',
            fontSize: 11,
            background: 'transparent',
            color: '#64748b',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {t('plan.remove')}
        </button>
      )}
    </div>
  )
})

export const PlanPanel = memo(function PlanPanel() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<Plan[]>(() => planStore.list())

  useEffect(() => {
    return planStore.subscribe(setPlans)
  }, [])

  if (plans.length === 0) {
    return (
      <div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>
        {t('plan.empty_state')}
      </div>
    )
  }

  return (
    <div style={{ padding: 12, maxHeight: '60vh', overflowY: 'auto' }}>
      {plans.map((plan) => (
        <PlanRow key={plan.id} plan={plan} onRemove={() => planStore.remove(plan.id)} />
      ))}
    </div>
  )
})
