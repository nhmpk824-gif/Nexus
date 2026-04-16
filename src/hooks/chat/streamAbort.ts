export type AbortSetter = (
  abortOrUpdater:
    | ((() => Promise<void>) | null)
    | ((current: (() => Promise<void>) | null) => (() => Promise<void>) | null),
) => void

export function bindStreamingAbort<T>(
  request: Promise<T> & { abort?: () => Promise<void> },
  setAbort: AbortSetter,
) {
  const abort = request.abort?.bind(request)
  setAbort(abort ?? null)
  const capturedAbort = abort ?? null

  return request.finally(() => {
    // Only clear if this is still OUR abort function, not a newer turn's
    setAbort((current) => (current === capturedAbort ? null : current))
  })
}
