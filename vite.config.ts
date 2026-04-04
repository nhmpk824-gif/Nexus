import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function resolveManualChunk(id: string) {
  const normalizedId = id.replace(/\\/g, '/')

  if (normalizedId.includes('node_modules/react/')
    || normalizedId.includes('node_modules/react-dom/')
    || normalizedId.includes('node_modules/scheduler/')) {
    return 'react-vendor'
  }

  if (normalizedId.includes('node_modules/@huggingface/transformers/')) {
    return 'transformers-vendor'
  }

  if (normalizedId.includes('node_modules/onnxruntime-web/')) {
    return 'ort-vendor'
  }

  if (normalizedId.includes('node_modules/pinyin-pro/')) {
    return 'chinese-vendor'
  }

  if (normalizedId.includes('node_modules/@ricky0123/vad-web/')) {
    return 'voice-vendor'
  }

  if (
    normalizedId.includes('/src/hooks/useVoice.ts')
    || normalizedId.includes('/src/hooks/voice/')
    || normalizedId.includes('/src/features/voice/')
    || normalizedId.includes('/src/lib/audioProviders.ts')
    || normalizedId.includes('/src/lib/speechProviderProfiles.ts')
  ) {
    return 'voice-runtime'
  }

  if (
    normalizedId.includes('/src/hooks/useChat.ts')
    || normalizedId.includes('/src/features/chat/')
    || normalizedId.includes('/src/features/tools/')
    || normalizedId.includes('/src/features/memory/')
    || normalizedId.includes('/src/lib/apiProviders.ts')
    || normalizedId.includes('/src/lib/webSearchProviders.ts')
  ) {
    return 'assistant-runtime'
  }

  if (
    normalizedId.includes('/src/app/controllers/')
    || normalizedId.includes('/src/app/providers/')
    || normalizedId.includes('/src/hooks/useDesktopContext.ts')
    || normalizedId.includes('/src/hooks/usePetBehavior.ts')
    || normalizedId.includes('/src/hooks/useReminderScheduler.ts')
  ) {
    return 'app-runtime'
  }

  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react()],
  build: {
    // Remaining large chunks are optional local-ML runtimes that stay lazy.
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 47821,
    strictPort: true,
  },
})
