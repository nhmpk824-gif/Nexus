type WhisperWorkerRequest =
  | {
      type: 'transcribe'
      requestId: number
      model: string
      language?: string
      audio: Float32Array
    }
  | {
      type: 'preload'
      requestId: number
      model: string
    }

type WhisperStatusMessage =
  | {
      type: 'status'
      requestId: number
      message: string
    }
  | {
      type: 'result'
      requestId: number
      text: string
    }
  | {
      type: 'error'
      requestId: number
      message: string
    }

let currentModel = ''
let transcriberPromise: Promise<(audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>> | null = null
let pipelineFactoryPromise: Promise<(
  task: string,
  model: string,
) => Promise<(audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>>> | null = null

function postMessageToMain(message: WhisperStatusMessage) {
  self.postMessage(message)
}

async function getPipelineFactory() {
  if (!pipelineFactoryPromise) {
    pipelineFactoryPromise = import('@huggingface/transformers')
      .then(({ pipeline }) => pipeline as unknown as (
        task: string,
        model: string,
      ) => Promise<(audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>>)
  }

  return pipelineFactoryPromise
}

function normalizeWhisperResult(result: unknown) {
  if (typeof result === 'string') {
    return result.trim()
  }

  if (
    result
    && typeof result === 'object'
    && 'text' in result
    && typeof result.text === 'string'
  ) {
    return result.text.trim()
  }

  return ''
}

async function getTranscriber(model: string, requestId: number) {
  if (!transcriberPromise || currentModel !== model) {
    currentModel = model
    postMessageToMain({
      type: 'status',
      requestId,
      message: `正在加载本地语音模型：${model}`,
    })
    transcriberPromise = getPipelineFactory()
      .then((createPipeline) => createPipeline('automatic-speech-recognition', model))
    await transcriberPromise
    postMessageToMain({
      type: 'status',
      requestId,
      message: '本地 Whisper 模型已就绪，开始识别。',
    })
  }

  return transcriberPromise
}

self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
  const payload = event.data

  if (payload?.type === 'preload') {
    try {
      await getTranscriber(payload.model, payload.requestId)
      postMessageToMain({
        type: 'result',
        requestId: payload.requestId,
        text: '',
      })
    } catch (error) {
      postMessageToMain({
        type: 'error',
        requestId: payload.requestId,
        message: error instanceof Error ? error.message : '本地 Whisper 模型预加载失败。',
      })
    }
    return
  }

  if (payload?.type !== 'transcribe') {
    return
  }

  try {
    const transcriber = await getTranscriber(payload.model, payload.requestId)
    postMessageToMain({
      type: 'status',
      requestId: payload.requestId,
      message: '本地语音识别中...',
    })

    const result = await transcriber(payload.audio, {
      task: 'transcribe',
      ...(payload.language
        ? {
            language: payload.language,
          }
        : {}),
    })

    postMessageToMain({
      type: 'result',
      requestId: payload.requestId,
      text: normalizeWhisperResult(result),
    })
  } catch (error) {
    postMessageToMain({
      type: 'error',
      requestId: payload.requestId,
      message: error instanceof Error ? error.message : '本地 Whisper 识别失败。',
    })
  }
}

export {}
