import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App.tsx'
import { AppProviders } from './providers'
import { ErrorBoundary } from './ErrorBoundary.tsx'

// DEV-ONLY diagnostic: log the full stack for the FIRST "Maximum update depth
// exceeded" console.error, then let subsequent ones through unchanged. React
// only surfaces the message string in repeat spam; the stack is what actually
// points at the offending component/effect. Removed once the storm is located.
if (import.meta.env.DEV) {
  const originalError = console.error.bind(console)
  let stormStackLogged = false
  console.error = (...args: unknown[]) => {
    const firstArg = args[0]
    const message = typeof firstArg === 'string' ? firstArg : ''
    if (!stormStackLogged && message.includes('Maximum update depth exceeded')) {
      stormStackLogged = true
      // React's warning usually passes the component stack as a trailing
      // string arg. Dump every arg plus the caller stack so whichever hint
      // React left behind actually reaches the terminal log.
      originalError('[STORM DIAG] args[0]:', firstArg)
      for (let i = 1; i < args.length; i += 1) {
        originalError(`[STORM DIAG] args[${i}]:`, args[i])
      }
      originalError('[STORM DIAG] caller stack:', new Error('render-storm-caller').stack)
    }
    originalError(...args)
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AppProviders>
      <App />
    </AppProviders>
  </ErrorBoundary>,
)
