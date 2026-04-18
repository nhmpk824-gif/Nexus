import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App.tsx'
import { AppProviders } from './providers'
import { ErrorBoundary } from './ErrorBoundary.tsx'

// DEV-ONLY: dump full stack on the first "Maximum update depth exceeded"
// warning so we can pin down the offending effect. First fix landed a
// `[pet]`→`[pet.setMood]` dep change that eliminated one loop; a second
// same-pattern effect is still storming. Remove once green.
if (import.meta.env.DEV) {
  const originalError = console.error.bind(console)
  let stormStackLogged = false
  console.error = (...args: unknown[]) => {
    const firstArg = args[0]
    const message = typeof firstArg === 'string' ? firstArg : ''
    if (!stormStackLogged && message.includes('Maximum update depth exceeded')) {
      stormStackLogged = true
      originalError('[STORM DIAG] args[0]:', firstArg)
      for (let i = 1; i < args.length; i += 1) {
        originalError(`[STORM DIAG] args[${i}]:`, args[i])
      }
      originalError('[STORM DIAG] caller stack:', new Error('render-storm-caller').stack)
    }
    originalError(...args)
  }
  console.warn('[STORM DIAG] interceptor v2 installed')
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AppProviders>
      <App />
    </AppProviders>
  </ErrorBoundary>,
)
