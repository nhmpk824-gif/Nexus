import { memo, useEffect, useMemo, useState } from 'react'
import { agentTraceStore, type AgentTrace } from '../features/agent/agentTraceStore'
import {
  backgroundTaskStore,
  type BackgroundTask,
  type BackgroundTaskStatus,
} from '../features/agent/backgroundTaskStore'
import type { AgentStep, AgentStepType, AgentStopReason } from '../features/agent/agentLoop'

type TraceStatusFilter = 'all' | 'running' | 'done' | 'error'

const TRACE_FILTER_LABEL: Record<TraceStatusFilter, string> = {
  all: '全部',
  running: '运行中',
  done: '完成',
  error: '错误',
}

function matchesTraceFilter(trace: AgentTrace, filter: TraceStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return !trace.status
  if (filter === 'done') return trace.status === 'done'
  if (filter === 'error') {
    return trace.status === 'aborted' || trace.status === 'error'
  }
  return true
}

function isErrorStep(step: AgentStep): boolean {
  return step.type === 'abort' || Boolean(step.reason)
}

function traceHasError(trace: AgentTrace): boolean {
  if (trace.status === 'aborted' || trace.status === 'error') return true
  return trace.steps.some(isErrorStep)
}

function statusColorFor(status: AgentStopReason | undefined): string {
  switch (status) {
    case 'done': return '#34d399'
    case 'aborted':
    case 'error': return '#f87171'
    case 'max_iterations':
    case 'cost_cap': return '#fbbf24'
    default: return '#94a3b8'
  }
}

const STEP_GLYPH: Record<AgentStepType, string> = {
  start: '▶',
  thinking: '…',
  tool_round: '⚙',
  plan_created: '📋',
  plan_step_done: '✓',
  reflect: '↺',
  continue: '→',
  done: '●',
  abort: '✕',
}

const STEP_COLOR: Record<AgentStepType, string> = {
  start: '#60a5fa',
  thinking: '#94a3b8',
  tool_round: '#fbbf24',
  plan_created: '#a78bfa',
  plan_step_done: '#34d399',
  reflect: '#cbd5e1',
  continue: '#94a3b8',
  done: '#34d399',
  abort: '#f87171',
}

const TASK_STATUS_COLOR: Record<BackgroundTaskStatus, string> = {
  running: '#fbbf24',
  completed: '#34d399',
  failed: '#f87171',
  cancelled: '#94a3b8',
  orphaned: '#a78bfa',
}

const TASK_STATUS_LABEL: Record<BackgroundTaskStatus, string> = {
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  orphaned: '已中断',
}

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

function formatDuration(start: number, end?: number): string {
  if (!end) return '进行中'
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}min`
}

const StepRow = memo(function StepRow({ step }: { step: AgentStep }) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 8,
        padding: '4px 0',
        fontSize: 11,
        color: '#cbd5e1',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ color: STEP_COLOR[step.type], fontWeight: 700, minWidth: 16 }}>
        {STEP_GLYPH[step.type]}
      </span>
      <span style={{ color: '#64748b', minWidth: 18 }}>#{step.iteration}</span>
      <span style={{ flex: 1 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{step.type}</span>
        {step.toolCallNames?.length ? (
          <span style={{ color: '#fbbf24', marginLeft: 6 }}>
            [{step.toolCallNames.join(', ')}]
          </span>
        ) : null}
        {step.reason ? (
          <span style={{ color: '#f87171', marginLeft: 6 }}>{step.reason}</span>
        ) : null}
        {step.content ? (
          <div style={{ marginTop: 2, color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
            {step.content.length > 200 ? `${step.content.slice(0, 200)}…` : step.content}
          </div>
        ) : null}
      </span>
    </li>
  )
})

const TraceCard = memo(function TraceCard({ trace }: { trace: AgentTrace }) {
  const hasError = traceHasError(trace)
  // Errors auto-expand so users see what broke without an extra click.
  const [expanded, setExpanded] = useState(hasError)
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [search, setSearch] = useState('')
  const statusColor = statusColorFor(trace.status)

  const filteredSteps = useMemo(() => {
    let steps = trace.steps
    if (errorsOnly) steps = steps.filter(isErrorStep)
    const q = search.trim().toLowerCase()
    if (q) {
      steps = steps.filter((s) => {
        const hay = `${s.type} ${s.content ?? ''} ${s.reason ?? ''} ${(s.toolCallNames ?? []).join(' ')}`
        return hay.toLowerCase().includes(q)
      })
    }
    return steps
  }, [trace.steps, errorsOnly, search])

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(15, 23, 42, 0.55)',
        border: `1px solid ${hasError ? 'rgba(248, 113, 113, 0.3)' : 'rgba(148, 163, 184, 0.18)'}`,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
          {trace.goal}
        </div>
        <div style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>
          {trace.status ?? 'running'}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
        {formatTime(trace.startedAt)} · {formatDuration(trace.startedAt, trace.endedAt)} · {trace.steps.length} 步
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          marginTop: 6,
          padding: '2px 8px',
          fontSize: 10,
          background: 'transparent',
          color: '#60a5fa',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        {expanded ? '收起' : '展开步骤'}
      </button>
      {expanded && (
        <>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索步骤..."
              style={{
                flex: 1,
                fontSize: 11,
                padding: '3px 8px',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#e2e8f0',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 4,
                outline: 'none',
              }}
            />
            <label style={{ display: 'flex', gap: 4, fontSize: 10, color: '#94a3b8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={errorsOnly}
                onChange={(e) => setErrorsOnly(e.target.checked)}
                style={{ margin: 0 }}
              />
              仅错误
            </label>
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '8px 0 0 0',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {filteredSteps.length === 0 ? (
              <li style={{ fontSize: 11, color: '#64748b', padding: '4px 0' }}>
                没有符合条件的步骤。
              </li>
            ) : (
              filteredSteps.map((step, idx) => (
                <StepRow key={`${step.iteration}-${step.type}-${idx}`} step={step} />
              ))
            )}
          </ul>
        </>
      )}
    </div>
  )
})

const TaskRow = memo(function TaskRow({ task }: { task: BackgroundTask }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: 'rgba(15, 23, 42, 0.45)',
        border: `1px solid ${TASK_STATUS_COLOR[task.status]}33`,
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
          {task.label}
        </div>
        <div style={{ fontSize: 10, color: TASK_STATUS_COLOR[task.status], fontWeight: 600 }}>
          {TASK_STATUS_LABEL[task.status]}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
        {formatTime(task.startedAt)} · {formatDuration(task.startedAt, task.endedAt)}
      </div>
      {task.summary && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, whiteSpace: 'pre-wrap' }}>
          {task.summary.length > 160 ? `${task.summary.slice(0, 160)}…` : task.summary}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {task.status === 'running' && (
          <button
            onClick={() => backgroundTaskStore.cancel(task.id)}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              background: 'transparent',
              color: '#f87171',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        )}
        {task.status !== 'running' && (
          <button
            onClick={() => backgroundTaskStore.remove(task.id)}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              background: 'transparent',
              color: '#64748b',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            移除
          </button>
        )}
      </div>
    </div>
  )
})

export const AgentTracePanel = memo(function AgentTracePanel() {
  const [traces, setTraces] = useState<AgentTrace[]>(() => agentTraceStore.list())
  const [tasks, setTasks] = useState<BackgroundTask[]>(() => backgroundTaskStore.list())
  const [filter, setFilter] = useState<TraceStatusFilter>('all')

  useEffect(() => {
    const unsubTraces = agentTraceStore.subscribe(setTraces)
    const unsubTasks = backgroundTaskStore.subscribe(setTasks)
    return () => {
      unsubTraces()
      unsubTasks()
    }
  }, [])

  const filteredTraces = useMemo(
    () => traces.filter((t) => matchesTraceFilter(t, filter)),
    [traces, filter],
  )

  if (traces.length === 0 && tasks.length === 0) {
    return (
      <div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>
        Agent 还没有跑过任务。运行 agent loop 后，这里会显示步骤轨迹和后台任务。
      </div>
    )
  }

  return (
    <div style={{ padding: 12, maxHeight: '60vh', overflowY: 'auto' }}>
      {tasks.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, letterSpacing: 0.5 }}>
            后台任务
          </div>
          {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
        </section>
      )}
      {traces.length > 0 && (
        <section style={{ marginTop: tasks.length > 0 ? 12 : 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
              最近的 Agent 轨迹
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(Object.keys(TRACE_FILTER_LABEL) as TraceStatusFilter[]).map((key) => {
                const isActive = filter === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 10,
                      background: isActive ? 'rgba(96, 165, 250, 0.18)' : 'transparent',
                      color: isActive ? '#60a5fa' : '#94a3b8',
                      border: `1px solid ${isActive ? 'rgba(96, 165, 250, 0.4)' : 'rgba(148, 163, 184, 0.2)'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {TRACE_FILTER_LABEL[key]}
                  </button>
                )
              })}
            </div>
          </div>
          {filteredTraces.length === 0 ? (
            <div style={{ fontSize: 11, color: '#64748b', padding: '4px 0' }}>
              没有符合「{TRACE_FILTER_LABEL[filter]}」的轨迹。
            </div>
          ) : (
            filteredTraces.map((trace) => <TraceCard key={trace.id} trace={trace} />)
          )}
        </section>
      )}
    </div>
  )
})
