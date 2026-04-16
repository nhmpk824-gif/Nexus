export type CronField = 'minute' | 'hour' | 'day' | 'month' | 'weekday'

type FieldRange = { min: number; max: number }

const FIELD_RANGES: Record<CronField, FieldRange> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  day: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  weekday: { min: 0, max: 6 },
}

type ParsedField = Set<number>

type ParsedCron = {
  minute: ParsedField
  hour: ParsedField
  day: ParsedField
  month: ParsedField
  weekday: ParsedField
}

export function parseCronExpression(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`)
  }
  return {
    minute: parseField(parts[0], FIELD_RANGES.minute),
    hour: parseField(parts[1], FIELD_RANGES.hour),
    day: parseField(parts[2], FIELD_RANGES.day),
    month: parseField(parts[3], FIELD_RANGES.month),
    weekday: parseField(parts[4], FIELD_RANGES.weekday),
  }
}

function parseField(token: string, range: FieldRange): ParsedField {
  const values = new Set<number>()
  const segments = token.split(',')
  for (const segment of segments) {
    const [rangeExpr, stepExpr] = segment.split('/')
    const step = stepExpr ? parseInt(stepExpr, 10) : 1
    if (!Number.isFinite(step) || step <= 0) {
      throw new Error(`Invalid step in cron field: ${segment}`)
    }

    let start: number
    let end: number
    if (rangeExpr === '*') {
      start = range.min
      end = range.max
    } else if (rangeExpr.includes('-')) {
      const [a, b] = rangeExpr.split('-').map((v) => parseInt(v, 10))
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error(`Invalid cron range: ${rangeExpr}`)
      }
      start = a
      end = b
    } else {
      const value = parseInt(rangeExpr, 10)
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid cron value: ${rangeExpr}`)
      }
      start = value
      end = value
    }

    if (start < range.min || end > range.max || start > end) {
      throw new Error(`Cron value out of range: ${segment} (expected ${range.min}-${range.max})`)
    }

    for (let v = start; v <= end; v += step) {
      values.add(v)
    }
  }
  return values
}

export function nextCronFireTime(expression: string, from: Date = new Date()): Date {
  const parsed = parseCronExpression(expression)
  const candidate = new Date(from.getTime() + 60_000 - (from.getTime() % 60_000))
  candidate.setSeconds(0, 0)

  const maxIterations = 366 * 24 * 60
  for (let i = 0; i < maxIterations; i += 1) {
    if (!parsed.month.has(candidate.getMonth() + 1)) {
      advanceMonth(candidate)
      continue
    }
    if (!parsed.day.has(candidate.getDate()) || !parsed.weekday.has(candidate.getDay())) {
      advanceDay(candidate)
      continue
    }
    if (!parsed.hour.has(candidate.getHours())) {
      advanceHour(candidate)
      continue
    }
    if (!parsed.minute.has(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1)
      continue
    }
    return candidate
  }
  throw new Error(`Cron expression "${expression}" produced no fire time within one year`)
}

function advanceMonth(date: Date): void {
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  date.setMonth(date.getMonth() + 1)
}

function advanceDay(date: Date): void {
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 1)
}

function advanceHour(date: Date): void {
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
}
