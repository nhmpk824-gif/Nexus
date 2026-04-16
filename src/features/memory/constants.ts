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

export const SCREEN_VLM_MODEL_OPTIONS = [
  {
    value: 'gpt-4o-mini',
    label: 'gpt-4o-mini（OpenAI，便宜快）',
    hint: 'OpenAI 入门级多模态，成本低、速度快，适合大多数屏幕理解场景。',
  },
  {
    value: 'gpt-4o',
    label: 'gpt-4o（OpenAI，旗舰）',
    hint: 'OpenAI 旗舰多模态，理解更稳更细，适合关键场景但单价更高。',
  },
  {
    value: 'gpt-4.1-mini',
    label: 'gpt-4.1-mini（OpenAI，新一代便宜版）',
    hint: 'OpenAI gpt-4.1 系列轻量版，性价比较 gpt-4o-mini 又高一档。',
  },
  {
    value: 'gpt-4.1',
    label: 'gpt-4.1（OpenAI，新一代旗舰）',
    hint: 'OpenAI gpt-4.1 旗舰，理解能力和推理都比 gpt-4o 更强。',
  },
  {
    value: 'qwen-vl-max-latest',
    label: 'Qwen-VL-Max（阿里，旗舰）',
    hint: '阿里通义千问视觉大模型旗舰版，中文理解更本土，适合国内环境。',
  },
  {
    value: 'qwen-vl-plus-latest',
    label: 'Qwen-VL-Plus（阿里，标准）',
    hint: '阿里通义千问视觉大模型标准版，成本更低、速度更快。',
  },
  {
    value: 'glm-4v-plus',
    label: 'GLM-4V-Plus（智谱，旗舰）',
    hint: '智谱 GLM-4V 旗舰视觉模型，中文识别和场景理解表现优异。',
  },
] as const
