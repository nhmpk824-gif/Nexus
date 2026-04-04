import { pickTranslatedUiText } from '../../lib/uiLanguage'
import type {
  DoctorCheckResult,
  DoctorReport,
  UiLanguage,
} from '../../types'
import { formatConsoleTimestamp } from '../settingsDrawerSupport'

type DoctorSectionProps = {
  active: boolean
  applyingDoctorRepairs: boolean
  doctorReport: DoctorReport | null
  runningDoctor: boolean
  uiLanguage: UiLanguage
  onApplyDoctorRepairs: () => void
  onRunDoctor: () => void
}

function getDoctorStatusLabel(status: DoctorCheckResult['status'], uiLanguage: UiLanguage) {
  switch (status) {
    case 'ok':
      return pickTranslatedUiText(uiLanguage, 'settings.doctor.status.ok')
    case 'warning':
      return pickTranslatedUiText(uiLanguage, 'settings.doctor.status.warning')
    case 'error':
      return pickTranslatedUiText(uiLanguage, 'settings.doctor.status.error')
    default:
      return pickTranslatedUiText(uiLanguage, 'settings.doctor.status.skipped')
  }
}

export function DoctorSection({
  active,
  applyingDoctorRepairs,
  doctorReport,
  runningDoctor,
  uiLanguage,
  onApplyDoctorRepairs,
  onRunDoctor,
}: DoctorSectionProps) {
  const ti = (key: Parameters<typeof pickTranslatedUiText>[1]) => pickTranslatedUiText(uiLanguage, key)
  const actionableChecks = doctorReport?.checks.filter((check) => (check.repairActions?.length ?? 0) > 0) ?? []

  return (
    <section className={`settings-section ${active ? 'is-active' : 'is-hidden'}`}>
      <div className="settings-section__title-row">
        <div>
          <h4>{ti('settings.doctor.title')}</h4>
          <p className="settings-drawer__hint">{ti('settings.doctor.note')}</p>
        </div>
        <div className="settings-drawer__inline-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onRunDoctor}
            disabled={runningDoctor || applyingDoctorRepairs}
          >
            {runningDoctor ? ti('settings.doctor.running') : ti('settings.doctor.run')}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onApplyDoctorRepairs}
            disabled={runningDoctor || applyingDoctorRepairs || !actionableChecks.length}
          >
            {applyingDoctorRepairs ? ti('settings.doctor.repairing') : ti('settings.doctor.apply_repairs')}
          </button>
        </div>
      </div>

      {doctorReport ? (
        <>
          <article className="settings-console-card settings-console-card--primary">
            <div className="settings-console-card__header">
              <span className="settings-console-badge">{ti('settings.doctor.summary_badge')}</span>
              <span className="settings-summary-chip">{formatConsoleTimestamp(doctorReport.createdAt, uiLanguage)}</span>
            </div>
            <div className="settings-console-card__headline">
              <strong>{doctorReport.summary}</strong>
            </div>
            <p>
              {ti('settings.doctor.checked')} {doctorReport.checks.length} {ti('settings.doctor.items_including')}
              {' '}
              {doctorReport.checks.filter((check) => check.status === 'error').length} {ti('settings.doctor.errors_and')}
              {' '}
              {doctorReport.checks.filter((check) => check.status === 'warning').length} {ti('settings.doctor.warnings')}
            </p>
          </article>

          <div className="settings-console-list">
            {doctorReport.checks.map((check) => (
              <article
                key={check.id}
                className={`settings-console-list__item${check.status === 'ok' ? ' is-success' : check.status === 'error' ? ' is-error' : ''}`}
              >
                <div className="settings-console-list__header">
                  <span className="settings-console-list__badge">{getDoctorStatusLabel(check.status, uiLanguage)}</span>
                  <span className="settings-console-list__meta">{check.title}</span>
                </div>
                <strong>{check.summary}</strong>
                {check.detail ? <p>{check.detail}</p> : null}
                {check.repairActions?.length ? (
                  <p className="settings-console-list__secondary">
                    {ti('settings.doctor.suggested_fixes')}
                    {check.repairActions.map((action) => action.label).join(' / ')}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-chat">
          <strong>{ti('settings.doctor.empty_title')}</strong>
          <p>{ti('settings.doctor.empty_note')}</p>
        </div>
      )}
    </section>
  )
}
