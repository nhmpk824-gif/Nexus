type FeatureExtractor = (input: string, options?: Record<string, unknown>) => Promise<unknown>

let activeModel = ''
let featureExtractorPromise: Promise<FeatureExtractor> | null = null

function normalizeVector(values: ArrayLike<number>) {
  const raw = Array.from(values, (value) => Number(value) || 0)
  const magnitude = Math.hypot(...raw)

  if (!magnitude) {
    return raw
  }

  return raw.map((value) => value / magnitude)
}

function extractTensorData(output: unknown): number[] {
  if (Array.isArray(output)) {
    const flattened = output.flat(Number.POSITIVE_INFINITY) as Array<unknown>
    return normalizeVector(flattened.map((value) => Number(value) || 0))
  }

  if (
    output
    && typeof output === 'object'
    && 'data' in output
    && output.data
    && typeof output.data === 'object'
    && 'length' in output.data
  ) {
    return normalizeVector(output.data as ArrayLike<number>)
  }

  return []
}

async function getFeatureExtractor(model: string) {
  if (!featureExtractorPromise || activeModel !== model) {
    activeModel = model
    featureExtractorPromise = import('@huggingface/transformers')
      .then(({ pipeline }) => {
        const createPipeline = pipeline as unknown as (
          task: string,
          requestedModel: string,
        ) => Promise<FeatureExtractor>

        return createPipeline('feature-extraction', model)
      })
  }

  return featureExtractorPromise
}

export async function warmupRemoteMemoryVectorModel(model: string) {
  await getFeatureExtractor(model)
}

export async function embedRemoteMemorySearchText(text: string, model: string) {
  const extractor = await getFeatureExtractor(model)
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  })

  return extractTensorData(output)
}
