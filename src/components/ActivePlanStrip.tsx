import { memo, useEffect, useState } from 'react'
import { planStore, type Plan } from '../features/plan/planStore'

function pickActivePlan(plans: Plan[]): Plan | undefined {
  return plans.find((p) => p.status === 'active')
}

export const ActivePlanStrip = memo(function ActivePlanStrip() {
  const [activePlan, setActivePlan] = useState<Plan | undefined>(() =>
    pickActivePlan(planStore.list()),
  )
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    return planStore.subscribe((plans) => setActivePlan(pickActivePlan(plans)))
  }, [])

  if (!activePlan) return null

  const total = activePlan.steps.length
  const completed = activePlan.steps.filter((s) => s.status === 'completed').length
  const failed = activePlan.steps.filter((s) => s.status === 'failed').length
  const currentStep =
    activePlan.steps.find((s) => s.status === 'in_progress')
    ?? activePlan.steps.find((s) => s.status === 'pending')
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div
      className="active-plan-strip"
      style={{
        padding: '10px 14px',
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        display: 'grid',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'grid',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.5 }}>
            执行中
          </span>
          <span style={{ fontSize: 13, color: '#e2e8f0', flex: 1, fontWeight: 600 }}>
            {activePlan.goal}
          </span>
          <span style={{ fontSize: 11, color: failed ? '#f87171' : '#64748b' }}>
            {completed}/{total}
            {failed ? ` · ${failed} 失败` : ''}
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(148, 163, 184, 0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: failed ? '#f87171' : '#34d399',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        {currentStep && !expanded ? (
          <div style={{ fontSize: 11, color: '#cbd5e1' }}>
            <span style={{ color: '#fbbf24', marginRight: 6 }}>◐</span>
            {currentStep.text}
          </div>
        ) : null}
      </button>

      {expanded ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
          {activePlan.steps.map((step) => {
            const icon =
              step.status === 'completed'
                ? '●'
                : step.status === 'in_progress'
                  ? '◐'
                  : step.status === 'failed'
                    ? '✕'
                    : step.status === 'skipped'
                      ? '◌'
                      : '○'
            const color =
              step.status === 'completed'
                ? '#34d399'
                : step.status === 'in_progress'
                  ? '#fbbf24'
                  : step.status === 'failed'
                    ? '#f87171'
                    : '#94a3b8'
            return (
              <li
                key={step.id}
                style={{
                  fontSize: 11,
                  color: '#cbd5e1',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color, fontWeight: 700, minWidth: 12 }}>{icon}</span>
                <span
                  style={{
                    flex: 1,
                    textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                  }}
                >
                  {step.text}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
})
