import { useMemo, useState } from 'react'
import type { ReminderTask } from '../../../types'
import {
  formatReminderScheduleSummary,
  type ReminderTaskDraftInput,
} from '../schedule'

type ReminderTaskManagerProps = {
  tasks: ReminderTask[]
  onSaveTask: (input: ReminderTaskDraftInput & { id?: string }) => void
  onRemoveTask: (id: string) => void
  onToggleTask: (id: string, enabled: boolean) => void
}

type ScheduleKind = ReminderTask['schedule']['kind']

function toDateTimeLocalValue(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function formatDateTimeLabel(value?: string) {
  if (!value) {
    return '未设置'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function buildTaskTitle(title: string, prompt: string) {
  const normalizedTitle = title.trim()
  if (normalizedTitle) {
    return normalizedTitle
  }

  const normalizedPrompt = prompt.trim()
  if (!normalizedPrompt) {
    return '新的提醒'
  }

  return normalizedPrompt.slice(0, 18)
}

export function ReminderTaskManager({
  tasks,
  onSaveTask,
  onRemoveTask,
  onToggleTask,
}: ReminderTaskManagerProps) {
  const [editingId, setEditingId] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [speechText, setSpeechText] = useState('')
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('at')
  const [atValue, setAtValue] = useState('')
  const [everyMinutes, setEveryMinutes] = useState('30')
  const [cronExpression, setCronExpression] = useState('0 9 * * *')
  const [enabled, setEnabled] = useState(true)
  const [formError, setFormError] = useState('')

  const saveLabel = editingId ? '更新提醒' : '添加提醒'
  const emptyState = useMemo(() => !tasks.length, [tasks.length])

  function resetForm() {
    setEditingId('')
    setTitle('')
    setPrompt('')
    setSpeechText('')
    setScheduleKind('at')
    setAtValue('')
    setEveryMinutes('30')
    setCronExpression('0 9 * * *')
    setEnabled(true)
    setFormError('')
  }

  function loadTaskIntoForm(task: ReminderTask) {
    setEditingId(task.id)
    setTitle(task.title)
    setPrompt(task.prompt)
    setSpeechText(task.speechText ?? '')
    setEnabled(task.enabled)
    setFormError('')

    if (task.schedule.kind === 'at') {
      setScheduleKind('at')
      setAtValue(toDateTimeLocalValue(task.schedule.at))
      return
    }

    if (task.schedule.kind === 'every') {
      setScheduleKind('every')
      setEveryMinutes(String(task.schedule.everyMinutes))
      return
    }

    setScheduleKind('cron')
    setCronExpression(task.schedule.expression)
  }

  function handleSave() {
    const nextTitle = buildTaskTitle(title, prompt)
    const nextPrompt = prompt.trim() || nextTitle
    if (!nextPrompt) {
      setFormError('请先填写提醒内容。')
      return
    }

    const nextSpeechText = speechText.trim()
    let schedule: ReminderTaskDraftInput['schedule']

    if (scheduleKind === 'at') {
      if (!atValue) {
        setFormError('请先选择提醒时间。')
        return
      }

      const date = new Date(atValue)
      if (Number.isNaN(date.getTime())) {
        setFormError('提醒时间格式不正确。')
        return
      }

      schedule = {
        kind: 'at',
        at: date.toISOString(),
      }
    } else if (scheduleKind === 'every') {
      const minutes = Math.max(1, Math.round(Number(everyMinutes) || 0))
      if (!minutes) {
        setFormError('循环提醒至少要 1 分钟。')
        return
      }

      schedule = {
        kind: 'every',
        everyMinutes: minutes,
      }
    } else {
      if (!cronExpression.trim()) {
        setFormError('请先填写 Cron 表达式。')
        return
      }

      schedule = {
        kind: 'cron',
        expression: cronExpression.trim(),
      }
    }

    onSaveTask({
      ...(editingId ? { id: editingId } : {}),
      title: nextTitle,
      prompt: nextPrompt,
      ...(nextSpeechText ? { speechText: nextSpeechText } : {}),
      enabled,
      schedule,
    })
    resetForm()
  }

  return (
    <div className="reminder-task-manager">
      <div className="settings-grid settings-grid--two">
        <label>
          <span>提醒标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="比如：喝水 / 开会 / 站起来活动"
          />
        </label>

        <label>
          <span>触发方式</span>
          <select
            value={scheduleKind}
            onChange={(event) => setScheduleKind(event.target.value as ScheduleKind)}
          >
            <option value="at">单次提醒</option>
            <option value="every">循环提醒</option>
            <option value="cron">Cron</option>
          </select>
        </label>
      </div>

      <label>
        <span>展示内容</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          placeholder="比如：起来喝点水，顺便活动一下肩颈。"
        />
      </label>

      <label>
        <span>TTS 播报内容，可选</span>
        <textarea
          value={speechText}
          onChange={(event) => setSpeechText(event.target.value)}
          rows={2}
          placeholder="留空时会直接朗读上面的提醒内容。"
        />
      </label>

      {scheduleKind === 'at' ? (
        <label>
          <span>提醒时间</span>
          <input
            type="datetime-local"
            value={atValue}
            onChange={(event) => setAtValue(event.target.value)}
          />
        </label>
      ) : null}

      {scheduleKind === 'every' ? (
        <label>
          <span>循环间隔（分钟）</span>
          <input
            type="number"
            min={1}
            step={1}
            value={everyMinutes}
            onChange={(event) => setEveryMinutes(event.target.value)}
          />
        </label>
      ) : null}

      {scheduleKind === 'cron' ? (
        <label>
          <span>Cron 表达式</span>
          <input
            value={cronExpression}
            onChange={(event) => setCronExpression(event.target.value)}
            placeholder="0 9 * * *"
          />
        </label>
      ) : null}

      <label className="settings-toggle">
        <span>启用这个提醒</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </label>

      <div className="settings-drawer__actions">
        <button
          type="button"
          className="ghost-button"
          onClick={resetForm}
        >
          清空表单
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
        >
          {saveLabel}
        </button>
      </div>

      <p className="settings-section__note">
        支持 `at / every / cron` 三种调度方式。提醒触发后会直接进入桌宠气泡；如果开启语音输出，也会按单独的播报文案朗读。
      </p>

      {formError ? (
        <div className="settings-inline-note reminder-task-manager__status">{formError}</div>
      ) : null}

      {emptyState ? (
        <div className="settings-inline-note">
          还没有提醒任务。你可以先加一个“30 分钟后提醒我喝水”，桌宠到点会直接弹气泡和播报。
        </div>
      ) : null}

      {!emptyState ? (
        <div className="reminder-task-list">
          {tasks.map((task) => (
            <article key={task.id} className="reminder-task-card">
              <div className="reminder-task-card__head">
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.prompt}</p>
                </div>
                <span className={`settings-summary-chip ${task.enabled ? '' : 'is-muted'}`}>
                  {task.enabled ? '启用中' : '已暂停'}
                </span>
              </div>

              <div className="reminder-task-card__meta">
                <span>调度：{formatReminderScheduleSummary(task)}</span>
                <span>下次：{formatDateTimeLabel(task.nextRunAt)}</span>
                <span>上次：{formatDateTimeLabel(task.lastTriggeredAt)}</span>
              </div>

              <div className="reminder-task-card__actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => loadTaskIntoForm(task)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onToggleTask(task.id, !task.enabled)}
                >
                  {task.enabled ? '暂停' : '启用'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onRemoveTask(task.id)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
