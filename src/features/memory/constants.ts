export const LOCAL_HASH_MEMORY_MODEL_ID = 'local-hash-v1'

export const MEMORY_EMBEDDING_MODEL_OPTIONS = [
  {
    value: LOCAL_HASH_MEMORY_MODEL_ID,
    label: '本地快速向量',
    hint: '无需下载模型，立即可用，适合作为默认的轻量检索层。',
  },
  {
    value: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    label: '多语言语义向量',
    hint: '首次使用会下载模型，中文和多语言语义效果更好。',
  },
  {
    value: 'Xenova/all-MiniLM-L6-v2',
    label: '英文语义向量',
    hint: '首次使用会下载模型，英文检索更稳，中文效果一般。',
  },
] as const

export const DEFAULT_MEMORY_EMBEDDING_MODEL = LOCAL_HASH_MEMORY_MODEL_ID
