import type { BudgetConfig, CostEntry } from '../../core'
import {
  BUDGET_CONFIG_STORAGE_KEY,
  COST_ENTRIES_STORAGE_KEY,
  readJson,
  writeJson,
  writeJsonDebounced,
} from './core.ts'

const MAX_STORED_ENTRIES = 2000

export function loadCostEntries(): CostEntry[] {
  const raw = readJson<CostEntry[]>(COST_ENTRIES_STORAGE_KEY, [])
  return Array.isArray(raw) ? raw : []
}

export function persistCostEntries(entries: CostEntry[]): void {
  const trimmed = entries.length > MAX_STORED_ENTRIES
    ? entries.slice(entries.length - MAX_STORED_ENTRIES)
    : entries
  writeJsonDebounced(COST_ENTRIES_STORAGE_KEY, trimmed, 800)
}

export function loadBudgetConfig(): BudgetConfig {
  return readJson<BudgetConfig>(BUDGET_CONFIG_STORAGE_KEY, {})
}

export function persistBudgetConfig(config: BudgetConfig): void {
  writeJson(BUDGET_CONFIG_STORAGE_KEY, config)
}
