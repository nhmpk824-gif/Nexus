// Thin re-export shim. The actual implementation lives in ./storage/ —
// each domain (chat, memory, voice, settings, presence, etc.) is its own
// small file under that directory. This file exists only to keep the
// historical import path `'../lib/storage'` working with zero churn.
export * from './storage/index.ts'
