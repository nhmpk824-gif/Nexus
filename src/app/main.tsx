import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App.tsx'
import { AppProviders } from './providers'
import { ErrorBoundary } from './ErrorBoundary.tsx'

// DEV-ONLY v3: residual ~10-warning burst per voice turn remains after the
// broadcast-echo guard. Dump the first occurrence's caller stack so the
// second loop can be pinned down. Remove once that landing is confirmed.
if (import.meta.env.DEV) {
  const originalError = console.error.bind(console)
  let stormStackLogged = false
  console.error = (...args: unknown[]) => {
    const firstArg = args[0]
    const message = typeof firstArg === 'string' ? firstArg : ''
    if (!stormStackLogged && message.includes('Maximum update depth exceeded')) {
      stormStackLogged = true
      originalError('[STORM DIAG v3] args[0]:', firstArg)
      for (let i = 1; i < args.length; i += 1) {
        originalError(`[STORM DIAG v3] args[${i}]:`, args[i])
      }
      originalError('[STORM DIAG v3] caller stack:', new Error('render-storm-caller').stack)
    }
    originalError(...args)
  }
  console.warn('[STORM DIAG v3] interceptor installed — hunting second loop')
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AppProviders>
      <App />
    </AppProviders>
  </ErrorBoundary>,
)
