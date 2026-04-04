import type { AppSettings } from './app'

export type DoctorCheckStatus = 'ok' | 'warning' | 'error' | 'skipped'

export interface DoctorRepairAction {
  id: string
  label: string
  description: string
  settingsPatch?: Partial<AppSettings>
}

export interface DoctorCheckResult {
  id: string
  title: string
  status: DoctorCheckStatus
  summary: string
  detail?: string
  repairActions?: DoctorRepairAction[]
}

export interface DoctorReport {
  createdAt: string
  summary: string
  checks: DoctorCheckResult[]
  autoAppliedRepairIds?: string[]
}
