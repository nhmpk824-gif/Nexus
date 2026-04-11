import type { MediaSessionControlRequest, MediaSessionSnapshot } from '../types'

type MusicPopupCardProps = {
  session: MediaSessionSnapshot
  busy?: boolean
  onControl: (action: MediaSessionControlRequest['action']) => void
  onDismiss: () => void
}

function resolveSourceLabel(sourceAppUserModelId?: string) {
  const normalized = String(sourceAppUserModelId ?? '').toLowerCase()
  if (!normalized) return 'System media'
  if (normalized.includes('qqmusic')) return 'QQ Music'
  if (normalized.includes('cloudmusic')) return 'NetEase Music'
  if (normalized.includes('spotify')) return 'Spotify'
  if (normalized.includes('chrome')) return 'Chrome'
  if (normalized.includes('msedge')) return 'Edge'
  if (normalized.includes('firefox')) return 'Firefox'
  if (normalized.includes('potplayer')) return 'PotPlayer'
  if (normalized.includes('foobar')) return 'foobar2000'
  if (normalized.includes('musicbee')) return 'MusicBee'
  if (normalized.includes('vlc')) return 'VLC'
  return 'System media'
}

function formatSeconds(value?: number) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function getProgressPercent(session: MediaSessionSnapshot) {
  const duration = Number(session.durationSeconds) || 0
  const position = Number(session.positionSeconds) || 0
  if (!duration || duration <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (position / duration) * 100))
}

export function MusicPopupCard({
  session,
  busy = false,
  onControl,
  onDismiss,
}: MusicPopupCardProps) {
  const title = session.title?.trim() || 'Now playing'
  const artist = session.artist?.trim() || session.albumTitle?.trim() || 'Unknown artist'
  const sourceLabel = resolveSourceLabel(session.sourceAppUserModelId)
  const progressPercent = getProgressPercent(session)

  return (
    <aside className="music-popup-card" aria-label="Current music card">
      <button
        type="button"
        className="music-popup-card__dismiss"
        onClick={onDismiss}
        aria-label="Close current music card"
      >
        x
      </button>

      <div className="music-popup-card__coverShell">
        {session.artworkDataUrl ? (
          <img
            className="music-popup-card__cover"
            src={session.artworkDataUrl}
            alt={title}
          />
        ) : (
          <div className="music-popup-card__cover music-popup-card__cover--placeholder">
            <div className="music-popup-card__coverGlow" aria-hidden="true" />
            <span className="music-popup-card__coverTag">MUSIC</span>
            <strong>{title.slice(0, 18)}</strong>
          </div>
        )}

        <div className="music-popup-card__coverShade" aria-hidden="true" />
      </div>

      <div className="music-popup-card__body">
        <div className="music-popup-card__eyebrow">
          <span className="music-popup-card__source">{sourceLabel}</span>
          <span className={`music-popup-card__state ${session.isPlaying ? 'is-playing' : ''}`}>
            {session.isPlaying ? 'Playing' : 'Paused'}
          </span>
        </div>

        <div className="music-popup-card__meta">
          <strong className="music-popup-card__title">{title}</strong>
          <p className="music-popup-card__artist">{artist}</p>
        </div>

        <div className="music-popup-card__progress">
          <div className="music-popup-card__progressBar" aria-hidden="true">
            <span
              className="music-popup-card__progressValue"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="music-popup-card__progressMeta">
            <span>{formatSeconds(session.positionSeconds)}</span>
            <span>{formatSeconds(session.durationSeconds)}</span>
          </div>
        </div>

        <div className="music-popup-card__controls">
          <button
            type="button"
            className="music-popup-card__control"
            onClick={() => onControl('previous')}
            disabled={busy || !session.supports?.previous}
            aria-label="Previous track"
          >
            Prev
          </button>
          <button
            type="button"
            className="music-popup-card__control music-popup-card__control--primary"
            onClick={() => onControl('toggle')}
            disabled={busy || !session.supports?.toggle}
            aria-label={session.isPlaying ? 'Pause playback' : 'Resume playback'}
          >
            {session.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="music-popup-card__control"
            onClick={() => onControl('next')}
            disabled={busy || !session.supports?.next}
            aria-label="Next track"
          >
            Next
          </button>
        </div>
      </div>
    </aside>
  )
}
