export type ApiProviderProtocol = 'openai-compatible' | 'anthropic'

export type ApiProviderPreset = {
  id: string
  label: string
  region: 'global' | 'china' | 'custom'
  baseUrl: string
  defaultModel: string
  models: string[]
  notes: string
  protocol: ApiProviderProtocol
  requiresApiKey: boolean
}

export const API_PROVIDER_PRESETS: ApiProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    region: 'global',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.4-mini',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.2', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o3-pro', 'o4-mini'],
    notes: 'Default OpenAI-compatible text provider.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    region: 'global',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-sonnet-4'],
    notes: 'Uses the native Anthropic messages API.',
    protocol: 'anthropic',
    requiresApiKey: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    region: 'global',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.1-pro-preview',
    models: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-live-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    notes: 'Uses the Gemini OpenAI-compatible endpoint.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    region: 'global',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4-1-fast-reasoning',
    models: ['grok-4-1-fast-reasoning', 'grok-4-1-fast-non-reasoning', 'grok-4-fast-reasoning', 'grok-4-fast-non-reasoning', 'grok-4'],
    notes: 'xAI preset with the current Nexus-compatible endpoint.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    region: 'china',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    notes: 'Direct DeepSeek API preset.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    region: 'china',
    baseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2.5',
    models: ['kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo'],
    notes: 'OpenAI-compatible Moonshot endpoint.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    region: 'china',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    defaultModel: 'MiniMax-M2.7',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1', 'MiniMax-M2'],
    notes: 'MiniMax endpoint using Anthropic-compatible messages.',
    protocol: 'anthropic',
    requiresApiKey: true,
  },
  {
    id: 'dashscope',
    label: 'DashScope Qwen',
    region: 'china',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen3.5-plus', 'qwen3.5-flash', 'qwen3-max', 'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwq-32b'],
    notes: 'Qwen via DashScope OpenAI-compatible mode.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    region: 'china',
    baseUrl: 'https://api.siliconflow.com/v1',
    defaultModel: 'deepseek-ai/DeepSeek-R1',
    models: ['Pro/deepseek-ai/DeepSeek-R1', 'Pro/deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen3-235B-A22B', 'Qwen/Qwen3-Coder-480B-A35B', 'Qwen/QwQ-32B'],
    notes: 'SiliconFlow preset for fast model switching.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    region: 'global',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    models: ['openrouter/auto'],
    notes: 'OpenRouter model routing preset.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'together',
    label: 'Together AI',
    region: 'global',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'moonshotai/Kimi-K2.5',
    models: ['moonshotai/Kimi-K2.5', 'MiniMax/MiniMax-M2.5', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
    notes: 'Together AI inference preset.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    region: 'global',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'mistral-medium-latest'],
    notes: 'Mistral AI preset.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'qianfan',
    label: 'Baidu Qianfan',
    region: 'china',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'deepseek-v3.2',
    models: ['deepseek-v3.2', 'deepseek-r1', 'ernie-4.5-8k', 'ernie-4.0-turbo-8k'],
    notes: 'Baidu Qianfan preset using the OpenAI-compatible v2 endpoint.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'zai',
    label: 'Z.ai GLM',
    region: 'china',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5',
    models: ['glm-5', 'glm-4.7', 'glm-4-plus', 'glm-4-flash', 'glm-4-long'],
    notes: 'Z.ai preset. The default points at the mainland endpoint and can be switched to the global Z.ai base URL if needed.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'byteplus',
    label: 'BytePlus ModelArk',
    region: 'china',
    baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    defaultModel: 'doubao-seed-2-0-pro',
    models: ['doubao-seed-2-0-pro', 'doubao-seed-2-0-lite', 'doubao-seed-2-0-code-preview', 'doubao-1.5-pro-256k'],
    notes: 'BytePlus ModelArk preset for the standard text endpoint.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    region: 'global',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'nvidia/llama-3.1-nemotron-70b-instruct',
    models: ['nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'Qwen/Qwen3.5-VLM-400B'],
    notes: 'NVIDIA NIM inference preset using the OpenAI-compatible endpoint.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'venice',
    label: 'Venice',
    region: 'global',
    baseUrl: 'https://api.venice.ai/api/v1',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'glm-5', 'glm-4.7-flash-heretic', 'gpt-4o', 'mistral-small-3.2-24b-instruct', 'qwen-3-next-80b'],
    notes: 'Venice preset for privacy-oriented routed models.',
    protocol: 'openai-compatible',
    requiresApiKey: true,
  },
  {
    id: 'ollama',
    label: 'Ollama',
    region: 'custom',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen3:8b',
    models: [],
    notes: 'Local Ollama preset. No API key is required for the default local server.',
    protocol: 'openai-compatible',
    requiresApiKey: false,
  },
  {
    id: 'custom',
    label: 'Custom OpenAI Compatible',
    region: 'custom',
    baseUrl: '',
    defaultModel: '',
    models: [],
    notes: 'Use any OpenAI-compatible gateway, proxy, or local server.',
    protocol: 'openai-compatible',
    requiresApiKey: false,
  },
]

export function getApiProviderPreset(providerId: string) {
  return API_PROVIDER_PRESETS.find((provider) => provider.id === providerId)
    ?? API_PROVIDER_PRESETS[0]
}

export function getApiProviderRuntimeMeta(providerId: string) {
  const preset = getApiProviderPreset(providerId)
  return { requiresApiKey: preset.requiresApiKey, protocol: preset.protocol }
}

export function apiProviderRequiresApiKey(providerId: string) {
  return getApiProviderPreset(providerId).requiresApiKey
}

export function getApiProviderProtocol(providerId: string): ApiProviderProtocol {
  return getApiProviderPreset(providerId).protocol
}

export function inferApiProviderId(baseUrl: string) {
  const normalized = String(baseUrl ?? '').toLowerCase()

  if (normalized.includes('api.openai.com')) return 'openai'
  if (normalized.includes('api.anthropic.com')) return 'anthropic'
  if (normalized.includes('generativelanguage.googleapis.com')) return 'gemini'
  if (normalized.includes('api.x.ai')) return 'xai'
  if (normalized.includes('api.deepseek.com')) return 'deepseek'
  if (normalized.includes('api.moonshot.ai') || normalized.includes('api.moonshot.cn')) return 'moonshot'
  if (
    normalized.includes('api.minimaxi.com/anthropic')
    || normalized.includes('api.minimax.io/anthropic')
    || normalized.includes('api.minimaxi.com')
    || normalized.includes('api.minimax.io')
  ) {
    return 'minimax'
  }
  if (normalized.includes('dashscope.aliyuncs.com')) return 'dashscope'
  if (normalized.includes('api.siliconflow.com') || normalized.includes('api.siliconflow.cn')) {
    return 'siliconflow'
  }
  if (normalized.includes('openrouter.ai')) return 'openrouter'
  if (normalized.includes('api.together.xyz')) return 'together'
  if (normalized.includes('api.mistral.ai')) return 'mistral'
  if (normalized.includes('qianfan.baidubce.com')) return 'qianfan'
  if (normalized.includes('api.z.ai') || normalized.includes('open.bigmodel.cn')) return 'zai'
  if (normalized.includes('bytepluses.com')) return 'byteplus'
  if (normalized.includes('integrate.api.nvidia.com')) return 'nvidia'
  if (normalized.includes('api.venice.ai')) return 'venice'
  if (normalized.includes('127.0.0.1:11434') || normalized.includes('localhost:11434')) {
    return 'ollama'
  }

  return 'custom'
}
