import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createId,
  loadReminderTasks,
  saveReminderTasks,
} from '../../lib'
import {
  addReminderTaskToCollection,
  removeReminderTaskFromCollection,
  updateReminderTaskInCollection,
  type ReminderTaskDraftInput,
} from '../../features/reminders'
import type { ReminderTask } from '../../types'

export function useReminderTaskStore() {
  const [reminderTasks, setReminderTasks] = useState<ReminderTask[]>(() => loadReminderTasks())
  const reminderTasksRef = useRef(reminderTasks)

  useEffect(() => {
    reminderTasksRef.current = reminderTasks
  }, [reminderTasks])

  useEffect(() => {
    saveReminderTasks(reminderTasks)
  }, [reminderTasks])

  const addReminderTask = useCallback((input: ReminderTaskDraftInput) => {
    const result = addReminderTaskToCollection(reminderTasksRef.current, createId, input)
    reminderTasksRef.current = result.tasks
    setReminderTasks(result.tasks)
    return result.createdTask
  }, [])

  const updateReminderTask = useCallback((
    id: string,
    updates: Partial<Omit<ReminderTask, 'id' | 'createdAt'>>,
  ) => {
    const result = updateReminderTaskInCollection(reminderTasksRef.current, id, updates)
    reminderTasksRef.current = result.tasks
    setReminderTasks(result.tasks)
    return result.updatedTask
  }, [])

  const removeReminderTask = useCallback((id: string) => {
    const result = removeReminderTaskFromCollection(reminderTasksRef.current, id)
    reminderTasksRef.current = result.tasks
    setReminderTasks(result.tasks)
    return result.removedTask
  }, [])

  return {
    reminderTasks,
    setReminderTasks,
    reminderTasksRef,
    addReminderTask,
    updateReminderTask,
    removeReminderTask,
  }
}
