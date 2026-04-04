import type {
  AppSettings,
  DoctorCheckResult,
  DoctorReport,
  LocalServiceProbeRequest,
  LocalServiceProbeResult,
} from '../../types'

export function buildDoctorReport(checks: DoctorCheckResult[]): DoctorReport {
  const errorCount = checks.filter((check) => check.status === 'error').length
  const warningCount = checks.filter((check) => check.status === 'warning').length

  let summary = '所有核心链路都通过了体检。'
  if (errorCount > 0) {
    summary = `发现 ${errorCount} 个严重问题，建议优先一键修复。`
  } else if (warningCount > 0) {
    summary = `发现 ${warningCount} 个需要关注的项目，主流程还能继续，但建议尽快处理。`
  }

  return {
    createdAt: new Date().toISOString(),
    summary,
    checks,
  }
}

export function collectDoctorSettingsPatch(report: DoctorReport) {
  const patch: Partial<AppSettings> = {}

  for (const check of report.checks) {
    for (const action of check.repairActions ?? []) {
      if (!action.settingsPatch) {
        continue
      }

      Object.assign(patch, action.settingsPatch)
    }
  }

  return patch
}

export function buildLocalServiceProbeRequest(
  id: string,
  label: string,
  rawUrl: string,
  timeoutMs = 1_600,
): LocalServiceProbeRequest | null {
  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) {
    return null
  }

  const normalizedUrl = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmedUrl)
    ? trimmedUrl
    : `http://${trimmedUrl}`

  try {
    const url = new URL(normalizedUrl)
    const port = url.port
      ? Number(url.port)
      : url.protocol === 'https:'
        ? 443
        : 80

    if (!Number.isInteger(port) || port <= 0) {
      return null
    }

    return {
      id,
      label,
      host: url.hostname || '127.0.0.1',
      port,
      timeoutMs,
    }
  } catch {
    return null
  }
}

export function formatLocalServiceProbeDetail(results: LocalServiceProbeResult[]) {
  return results
    .map((result) => (
      result.ok
        ? `${result.label}: ${result.host}:${result.port} 可连通${result.latencyMs != null ? ` (${result.latencyMs}ms)` : ''}`
        : `${result.label}: ${result.message}`
    ))
    .join(' / ')
}
