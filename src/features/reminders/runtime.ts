import type { RuntimeStateSnapshot, WindowView } from '../../types'

type ReminderSchedulerRuntimeState = Pick<RuntimeStateSnapshot, 'petOnline' | 'panelOnline'>

export function shouldRunReminderScheduler(
  view: WindowView,
  runtimeState: ReminderSchedulerRuntimeState,
) {
  if (view === 'pet') {
    return true
  }

  return !!runtimeState.panelOnline && !runtimeState.petOnline
}
