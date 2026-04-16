/**
 * Unified provider catalog.
 *
 * Every speech-input, speech-output, text, and web-search provider is registered
 * here with its full metadata. The rest of the codebase queries the catalog
 * instead of using scattered if-checks and switch statements.
 *
 * To add a new provider:
 *   1. Append an entry to the relevant array below.
 *   2. If the provider uses a new protocol, add the protocol literal.
 *   3. No other files need to change for detection / capability queries.
 */


// ── Shared types ──

export type SpeechModelOption = {
  value: string
  label: string
}

export type SpeechVoiceOption = {
  id: string
  label: string
  description?: string
}

export type SpeechStyleOption = {
  value: string
  label: string
  description?: string
}

export type SpeechOutputAdjustmentSupport = {
  rate: boolean
  pitch: boolean
  volume: boolean
  note: string
}

// ── Speech input provider catalog ──

export type SpeechInputProtocol =
  | 'sensevoice'
  | 'paraformer'
  | 'openai-compatible'
  | 'elevenlabs'
  | 'volcengine'
  | 'tencent'

export type SpeechInputProviderEntry = {
  id: string
  label: string
  baseUrl: string
  defaultModel: string
  notes: string
  protocol: SpeechInputProtocol
  kind: 'local' | 'remote' | 'browser'
  hidden: boolean
  modelOptions: SpeechModelOption[]
}

export const SPEECH_INPUT_PROVIDERS: SpeechInputProviderEntry[] = [
  {
    id: 'local-sensevoice',
    label: '[本地] SenseVoice 高精度识别',
    baseUrl: '',
    defaultModel: 'sensevoice-zh-en',
    notes: '阿里 SenseVoice-Small 离线识别，10秒音频仅需70ms处理（比Whisper快15倍），中文准确率极高。需先下载模型到 sherpa-models 目录。',
    protocol: 'sensevoice',
    kind: 'local',
    hidden: false,
    modelOptions: [
      { value: 'sensevoice-zh-en', label: 'SenseVoice 中英双语（推荐）' },
    ],
  },
  {
    id: 'local-paraformer',
    label: '[本地] Paraformer 流式识别',
    baseUrl: '',
    defaultModel: 'paraformer-trilingual',
    notes: '阿里 Paraformer 流式识别，边说边转写，实时显示识别内容。支持中英粤三语。需先下载模型到 sherpa-models 目录。',
    protocol: 'paraformer',
    kind: 'local',
    hidden: false,
    modelOptions: [
      { value: 'paraformer-trilingual', label: 'Paraformer 中英粤三语（推荐）' },
      { value: 'paraformer-zh-en', label: 'Paraformer 中英双语' },
    ],
  },
  {
    id: 'volcengine-stt',
    label: '[云端] 火山引擎语音识别',
    baseUrl: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel',
    defaultModel: 'bigmodel',
    notes: '适合国内环境下做云端识别。语音输入 API Key 一栏填写 `APP_ID:ACCESS_TOKEN`，先用默认模型即可。',
    protocol: 'volcengine',
    kind: 'remote',
    hidden: false,
    modelOptions: [
      { value: 'bigmodel', label: '火山豆包大模型（推荐）' },
    ],
  },
  {
    id: 'openai-stt',
    label: '[云端] OpenAI 语音识别',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini-transcribe',
    notes: '适合已经在用 OpenAI 文本模型的用户一起打通语音。保持默认地址，填 API Key 后可直接测试。',
    protocol: 'openai-compatible',
    kind: 'remote',
    hidden: false,
    modelOptions: [
      { value: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe（推荐，便宜更快）' },
      { value: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe（旗舰精度）' },
      { value: 'whisper-1', label: 'whisper-1（旧版兼容）' },
    ],
  },
  {
    id: 'elevenlabs-stt',
    label: '[云端] ElevenLabs Scribe',
    baseUrl: 'https://api.elevenlabs.io/v1',
    defaultModel: 'scribe_v1',
    notes: '适合已经在 ElevenLabs 体系里统一语音服务时使用。填官方 API Key 后即可起步。',
    protocol: 'elevenlabs',
    kind: 'remote',
    hidden: false,
    modelOptions: [
      { value: 'scribe_v1', label: 'Scribe v1（官方唯一选项）' },
    ],
  },
  {
    id: 'zhipu-stt',
    label: '[云端] 智谱 GLM-ASR 语音识别',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-asr-2512',
    notes: '智谱 AI 云端语音识别，中文识别准确率高，支持热词纠正。在 open.bigmodel.cn 获取 API Key。',
    protocol: 'openai-compatible',
    kind: 'remote',
    hidden: false,
    modelOptions: [
      { value: 'glm-asr-2512', label: 'GLM-ASR-2512（推荐）' },
      { value: 'glm-asr', label: 'GLM-ASR（旧版）' },
    ],
  },
  {
    id: 'glm-asr-local',
    label: '[本地] GLM-ASR-Nano 语音识别',
    baseUrl: 'http://127.0.0.1:8001/v1',
    defaultModel: 'glm-asr-nano',
    notes: '智谱 GLM-ASR-Nano 本地语音识别，中文准确率高，支持人名和专有名词。Nexus 启动时自动拉起服务。',
    protocol: 'openai-compatible',
    kind: 'local',
    hidden: false,
    modelOptions: [
      { value: 'glm-asr-nano', label: 'GLM-ASR-Nano（推荐）' },
    ],
  },
  {
    id: 'custom-openai-stt',
    label: '[云端] 自定义 OpenAI 兼容 STT',
    baseUrl: '',
    defaultModel: 'gpt-4o-mini-transcribe',
    notes: '适合自建或代理的 OpenAI 兼容转写服务。至少填写 Base URL 和模型名，再补 API Key。',
    protocol: 'openai-compatible',
    kind: 'remote',
    hidden: false,
    modelOptions: [],
  },
  {
    id: 'tencent-asr',
    label: '[云端] 腾讯云实时语音识别',
    baseUrl: '',
    defaultModel: '16k_zh',
    notes: '腾讯云实时流式语音识别，中文识别准确率高，延迟低。API Key 一栏填写 `APPID:SecretId:SecretKey`，在腾讯云控制台 > 访问管理 > API 密钥 中获取。',
    protocol: 'tencent',
    kind: 'remote',
    hidden: false,
    modelOptions: [
      { value: '16k_zh', label: '中文通用 16kHz（推荐）' },
      { value: '16k_zh_large', label: '中文大模型 16kHz（更准）' },
      { value: '16k_en', label: '英文 16kHz' },
      { value: '16k_zh_en', label: '中英混合 16kHz' },
      { value: '16k_ja', label: '日语 16kHz' },
      { value: '16k_ko', label: '韩语 16kHz' },
    ],
  },
]

// ── Speech output provider catalog ──

export type SpeechOutputProtocol =
  | 'openai-compatible'
  | 'minimax'
  | 'volcengine'
  | 'dashscope'
  | 'elevenlabs'
  | 'edge-tts'

export type SpeechOutputProviderEntry = {
  id: string
  label: string
  baseUrl: string
  defaultModel: string
  defaultVoice: string
  notes: string
  protocol: SpeechOutputProtocol
  kind: 'local' | 'remote' | 'browser'
  hidden: boolean
  supportsStreaming: boolean
  supportsCustomVoiceId: boolean
  modelOptions: SpeechModelOption[]
  fallbackVoiceOptions: SpeechVoiceOption[]
  styleOptions: SpeechStyleOption[]
  adjustmentSupport: SpeechOutputAdjustmentSupport
}

const OPENAI_TTS_VOICE_OPTIONS: SpeechVoiceOption[] = [
  { id: 'alloy', label: 'Alloy', description: '中性平衡声线，默认推荐。' },
  { id: 'ash', label: 'Ash', description: '偏冷静的男声，低频扎实。' },
  { id: 'ballad', label: 'Ballad', description: '叙事感较强，适合讲故事。' },
  { id: 'coral', label: 'Coral', description: '温暖明亮的女声。' },
  { id: 'echo', label: 'Echo', description: '成熟男声，偏对话风。' },
  { id: 'fable', label: 'Fable', description: '英式男声，读故事感强。' },
  { id: 'onyx', label: 'Onyx', description: '深沉权威男声，适合播报。' },
  { id: 'nova', label: 'Nova', description: '轻快上扬的女声，节奏明快。' },
  { id: 'sage', label: 'Sage', description: '稳重中性声线，叙事质感好。' },
  { id: 'shimmer', label: 'Shimmer', description: '柔和温暖的女声，适合陪伴。' },
]

const OPENAI_TTS_STYLE_OPTIONS: SpeechStyleOption[] = [
  { value: '', label: '默认（无指令）', description: '不追加风格指令，由模型自行选择。' },
  { value: 'Speak in a warm, gentle tone like a caring companion. Keep the pacing natural and smile softly through the words.', label: '温柔陪伴', description: '温暖柔和，像好朋友在身边。' },
  { value: 'Speak in a bright, cheerful, energetic tone with crisp articulation.', label: '欢快活泼', description: '元气、轻快、明亮。' },
  { value: 'Speak in a calm, steady narrator voice with thoughtful pacing.', label: '沉稳叙述', description: '稳一点，适合讲解和叙述。' },
  { value: 'Speak as if reading a bedtime story — warm, slow, full of emotion.', label: '温暖讲故事', description: '放慢节奏，带感情。' },
  { value: 'Speak in a relaxed, casual conversational tone like chatting with a friend.', label: '轻松闲聊', description: '日常口吻，不正式。' },
  { value: 'Speak in a clear, professional news-anchor tone.', label: '专业播报', description: '新闻主播感，正式清晰。' },
]

const ELEVENLABS_PRESET_VOICE_OPTIONS: SpeechVoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel — American female (calm)', description: '官方预设女声 Rachel，冷静知性。' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella — American female (soft)', description: '柔和女声 Bella，适合温柔陪伴。' },
  { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi — American female (strong)', description: '有力女声 Domi，偏自信。' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli — American female (young)', description: '年轻女声 Elli，情绪表现力强。' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam — American male (deep)', description: '深沉男声 Adam，权威稳重。' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni — American male (warm)', description: '温暖男声 Antoni，叙事感好。' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh — American male (young)', description: '年轻男声 Josh，轻松日常。' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold — American male (crisp)', description: '清晰男声 Arnold，适合播报。' },
]

const DASHSCOPE_VOICE_OPTIONS: SpeechVoiceOption[] = [
  { id: 'Cherry', label: 'Cherry（推荐中文女声）', description: '阿里 Qwen-TTS 官方默认女声，中文最稳。' },
]

const VOLCENGINE_DIRECTLY_AVAILABLE_VOICE_IDS = new Set([
  'BV001_streaming',
  'BV002_streaming',
])

function buildVolcengineVoiceOptions(): SpeechVoiceOption[] {
  const raw: SpeechVoiceOption[] = [
    { id: 'BV001_streaming', label: '通用女声', description: '推荐首选。官方明确可直接用于 V4/TTS 示例，最适合先验证火山 TTS 是否已打通。' },
    { id: 'BV002_streaming', label: '通用男声', description: '推荐第二个测试音色。官方明确可直接用于 V4/TTS 示例，男声里最稳。' },
    { id: 'BV700_streaming', label: '灿灿', description: '火山短文本 TTS 官方示例音色，自然度很高；若报 access denied，通常需要先在控制台 0 元下单。' },
    { id: 'BV700_V2_streaming', label: '灿灿 2.0', description: '更偏新版大模型风格；如果账号还没开通对应能力，先退回 BV700_streaming 或 BV001_streaming。' },
    { id: 'BV405', label: '甜美小源', description: '官方数字人/语音相关文档中的常见女声，偏甜美陪伴感；若短文本 TTS 不接受该代号，可退回 streaming 音色。' },
    { id: 'BV418', label: '甜美小源-电商', description: '更适合介绍、推荐和直播播报类台词；通常也需要先做控制台音色授权。' },
    { id: 'BV419', label: '阳光男声', description: '官方文档列出的常见男声，适合助手、讲解和偏积极的人设。' },
    { id: 'BV009_DPE_ParaTaco', label: '知性女声', description: '官方数字人文档中的默认女声，适合更成熟、稳一点的桌宠风格。' },
    { id: 'BV008_DPE_ParaTaco', label: '知性男声', description: '官方数字人文档中的常见男声，适合沉稳型播报。' },
    { id: 'BV005_ParaTaco', label: '活泼女声', description: '偏轻快、年轻，适合元气一点的角色设定。' },
    { id: 'BV007_ParaTaco', label: '亲切女声', description: '语气更柔和，适合陪伴式对话。' },
    { id: 'BV057_ParaTaco', label: '活泼幼教', description: '偏童趣、带引导感，适合可爱人设或讲故事。' },
  ]

  return raw.map((voice) => {
    if (VOLCENGINE_DIRECTLY_AVAILABLE_VOICE_IDS.has(voice.id)) return voice

    return {
      ...voice,
      label: `${voice.label} (需授权)`,
      description: voice.description
        ? `${voice.description} 如果控制台还没给这个音色授权，程序会自动回退到 BV001_streaming 或 BV002_streaming。`
        : '这个音色通常需要先在火山控制台完成授权；未授权时会自动回退到 BV001_streaming 或 BV002_streaming。',
    }
  })
}

export const SPEECH_OUTPUT_PROVIDERS: SpeechOutputProviderEntry[] = [
  {
    id: 'openai-tts',
    label: '[云端] OpenAI TTS',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini-tts',
    defaultVoice: 'alloy',
    notes: '适合和 OpenAI 文本服务一起使用。保持默认地址和模型，先用 `alloy` 跑通一轮播报。',
    protocol: 'openai-compatible',
    kind: 'remote',
    hidden: false,
    supportsStreaming: false,
    supportsCustomVoiceId: false,
    modelOptions: [
      { value: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts（推荐，支持 instructions）' },
      { value: 'tts-1', label: 'tts-1（低延迟）' },
      { value: 'tts-1-hd', label: 'tts-1-hd（高质量）' },
    ],
    fallbackVoiceOptions: OPENAI_TTS_VOICE_OPTIONS,
    styleOptions: OPENAI_TTS_STYLE_OPTIONS,
    adjustmentSupport: { rate: false, pitch: false, volume: false, note: '当前这条 TTS 链路暂时主要靠音色和风格指令控制，语速、语调和音量还没有稳定直通。' },
  },
  {
    id: 'minimax-tts',
    label: '[云端] MiniMax TTS',
    baseUrl: 'https://api.minimaxi.com/v1',
    defaultModel: 'speech-2.8-turbo',
    defaultVoice: 'female-shaonv',
    notes: '适合更自然的中文陪伴声线。默认地址即可，先用 `speech-2.8-turbo + female-shaonv` 起步最省事。',
    protocol: 'minimax',
    kind: 'remote',
    hidden: false,
    supportsStreaming: true,
    supportsCustomVoiceId: true,
    styleOptions: [],
    modelOptions: [
      { value: 'speech-2.8-turbo', label: 'speech-2.8-turbo（响应更快）' },
      { value: 'speech-2.8-hd', label: 'speech-2.8-hd（音质更好）' },
      { value: 'speech-2.6-turbo', label: 'speech-2.6-turbo（稳定低延迟）' },
      { value: 'speech-2.6-hd', label: 'speech-2.6-hd（自然度更高）' },
      { value: 'speech-02-turbo', label: 'speech-02-turbo（兼容旧版）' },
      { value: 'speech-02-hd', label: 'speech-02-hd（兼容旧版 HD）' },
      { value: 'speech-01-turbo', label: 'speech-01-turbo（旧版兼容）' },
      { value: 'speech-01-hd', label: 'speech-01-hd（旧版兼容 HD）' },
    ],
    fallbackVoiceOptions: [
      { id: 'female-shaonv', label: '少女音色', description: '轻快、元气，适合更偏二次元的女声。' },
      { id: 'female-tianmei', label: '甜美女性音色', description: '更柔和、甜一点，适合陪伴型回复。' },
      { id: 'female-yujie', label: '御姐音色', description: '更成熟、冷静，适合姐姐系角色。' },
      { id: 'female-chengshu', label: '成熟女性音色', description: '稳一些，适合温柔陪伴和自然对话。' },
      { id: 'female-shaonv-jingpin', label: '少女音色 Beta', description: '更精细的少女声线，适合二次元陪伴风格。' },
      { id: 'female-yujie-jingpin', label: '御姐音色 Beta', description: '更有层次的姐姐系声线。' },
      { id: 'female-chengshu-jingpin', label: '成熟女性音色 Beta', description: '更稳重自然，适合耐听型角色。' },
      { id: 'male-qn-daxuesheng', label: '青年大学生音色', description: '需要中性或男声时可以直接切换。' },
    ],
    adjustmentSupport: { rate: true, pitch: true, volume: true, note: '当前提供商支持语速、语调和音量调节，适合直接细调说话风格。' },
  },
  {
    id: 'volcengine-tts',
    label: '[云端] 火山引擎 TTS',
    baseUrl: 'https://openspeech.bytedance.com/api',
    defaultModel: 'volcano_tts',
    defaultVoice: 'BV001_streaming',
    notes: '适合国内环境下做低成本中文播报。语音输出 API Key 填 `APP_ID:ACCESS_TOKEN`，模型栏先用 `volcano_tts`，音色建议先从 `BV001_streaming` 开始。',
    protocol: 'volcengine',
    kind: 'remote',
    hidden: false,
    supportsStreaming: true,
    supportsCustomVoiceId: true,
    styleOptions: [],
    modelOptions: [],
    fallbackVoiceOptions: buildVolcengineVoiceOptions(),
    adjustmentSupport: { rate: true, pitch: true, volume: true, note: '当前提供商支持语速、语调和音量调节，适合直接细调说话风格。' },
  },
  {
    id: 'dashscope-tts',
    label: '[云端] 阿里云 Qwen-TTS',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    defaultModel: 'qwen3-tts-instruct-flash',
    defaultVoice: 'Cherry',
    notes: '适合需要中文、多方言或指令化播报。保持官方地址，先用默认模型和 `Cherry` 跑通试听。',
    protocol: 'dashscope',
    kind: 'remote',
    hidden: false,
    supportsStreaming: true,
    supportsCustomVoiceId: true,
    modelOptions: [
      { value: 'qwen3-tts-instruct-flash', label: 'qwen3-tts-instruct-flash（推荐）' },
      { value: 'qwen3-tts-flash', label: 'qwen3-tts-flash（更快）' },
    ],
    fallbackVoiceOptions: DASHSCOPE_VOICE_OPTIONS,
    styleOptions: [],
    adjustmentSupport: { rate: false, pitch: false, volume: false, note: '当前这条 TTS 链路暂时主要靠音色和风格指令控制，语速、语调和音量还没有稳定直通。' },
  },
  {
    id: 'elevenlabs-tts',
    label: '[云端] ElevenLabs TTS',
    baseUrl: 'https://api.elevenlabs.io/v1',
    defaultModel: 'eleven_multilingual_v2',
    defaultVoice: '21m00Tcm4TlvDq8ikWAM',
    notes: '适合更强调音色质感。填 API Key 后可直接播报，也能手动填写自定义 voice_id 接角色音色。',
    protocol: 'elevenlabs',
    kind: 'remote',
    hidden: false,
    supportsStreaming: true,
    supportsCustomVoiceId: true,
    modelOptions: [
      { value: 'eleven_multilingual_v2', label: 'eleven_multilingual_v2（推荐，多语种）' },
      { value: 'eleven_turbo_v2_5', label: 'eleven_turbo_v2_5（更快）' },
      { value: 'eleven_flash_v2_5', label: 'eleven_flash_v2_5（最低延迟）' },
    ],
    fallbackVoiceOptions: ELEVENLABS_PRESET_VOICE_OPTIONS,
    styleOptions: [],
    adjustmentSupport: { rate: false, pitch: false, volume: false, note: '当前这条 TTS 链路暂时主要靠音色和风格指令控制，语速、语调和音量还没有稳定直通。' },
  },
  {
    id: 'edge-tts',
    label: '[云端] Edge TTS（免费推荐）',
    baseUrl: '',
    defaultModel: '',
    defaultVoice: 'zh-CN-XiaoxiaoNeural',
    notes: '微软 Edge 浏览器内置 TTS 服务，免费、无需 API key，延迟极低（<300ms），音质自然。推荐日常使用。',
    protocol: 'edge-tts',
    kind: 'remote',
    hidden: false,
    supportsStreaming: true,
    supportsCustomVoiceId: false,
    styleOptions: [],
    modelOptions: [],
    fallbackVoiceOptions: [
      { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（中文女，推荐）', description: '微软晓晓，最常用的中文女声。' },
      { id: 'zh-CN-XiaoyiNeural', label: '晓伊（中文女）', description: '温柔的中文女声。' },
      { id: 'zh-CN-YunjianNeural', label: '云健（中文男）', description: '成熟的中文男声。' },
      { id: 'zh-CN-YunxiNeural', label: '云希（中文男）', description: '年轻的中文男声。' },
      { id: 'zh-CN-YunyangNeural', label: '云扬（中文男）', description: '新闻播报风格男声。' },
      { id: 'en-US-AriaNeural', label: 'Aria（英文女）', description: 'Natural English female voice.' },
      { id: 'en-US-GuyNeural', label: 'Guy（英文男）', description: 'Natural English male voice.' },
      { id: 'ja-JP-NanamiNeural', label: 'Nanami（日语女）', description: '自然な日本語女性音声。' },
    ],
    adjustmentSupport: { rate: true, pitch: true, volume: true, note: '支持语速、语调和音量调节。' },
  },
  {
    id: 'omnivoice-tts',
    label: '[本地] OmniVoice TTS',
    baseUrl: 'http://127.0.0.1:8000/v1',
    defaultModel: 'tts-1-hd',
    defaultVoice: 'female, young adult',
    notes: '小米 k2-fsa OmniVoice 本地语音合成，646 种语言。需先启动本地 OmniVoice 服务。音色栏选择预设或手动填写组合描述词。',
    protocol: 'openai-compatible',
    kind: 'local',
    hidden: false,
    supportsStreaming: false,
    supportsCustomVoiceId: true,
    styleOptions: OPENAI_TTS_STYLE_OPTIONS,
    modelOptions: [
      { value: 'tts-1-hd', label: 'tts-1-hd（高质量，32步）' },
      { value: 'tts-1', label: 'tts-1（快速，16步）' },
    ],
    fallbackVoiceOptions: [
      { id: 'female, young adult', label: '年轻女声', description: '自然的年轻女性声音，适合日常陪伴。' },
      { id: 'female', label: '女声', description: '默认女性声音。' },
      { id: 'female, child', label: '女童声', description: '可爱的小女孩声音。' },
      { id: 'female, teenager', label: '少女声', description: '青春活力的少女声音。' },
      { id: 'female, middle-aged', label: '成熟女声', description: '沉稳的中年女性声音。' },
      { id: 'female, elderly', label: '年长女声', description: '温和的年长女性声音。' },
      { id: 'male, young adult', label: '年轻男声', description: '自然的年轻男性声音。' },
      { id: 'male', label: '男声', description: '默认男性声音。' },
      { id: 'male, child', label: '男童声', description: '小男孩声音。' },
      { id: 'male, teenager', label: '少年声', description: '青春的少年声音。' },
      { id: 'male, middle-aged', label: '成熟男声', description: '沉稳的中年男性声音。' },
      { id: 'male, elderly', label: '年长男声', description: '温和的年长男性声音。' },
      { id: 'female, whisper', label: '女声耳语', description: '轻柔的耳语女声。' },
      { id: 'male, whisper', label: '男声耳语', description: '轻柔的耳语男声。' },
      { id: 'female, high pitch', label: '女声高音', description: '音调偏高的女性声音。' },
      { id: 'female, low pitch', label: '女声低音', description: '音调偏低的女性声音。' },
      { id: 'male, high pitch', label: '男声高音', description: '音调偏高的男性声音。' },
      { id: 'male, low pitch', label: '男声低音', description: '音调偏低的男性声音。' },
    ],
    adjustmentSupport: { rate: true, pitch: false, volume: false, note: 'OmniVoice 支持语速调节（speed 参数），语调和音量暂不支持。' },
  },
  {
    id: 'custom-openai-tts',
    label: '[云端] 自定义 OpenAI 兼容 TTS',
    baseUrl: '',
    defaultModel: 'gpt-4o-mini-tts',
    defaultVoice: 'alloy',
    notes: '适合接入兼容 OpenAI `audio/speech` 的服务。至少填写 Base URL、模型和 voice，先跑一次试听最稳。',
    protocol: 'openai-compatible',
    kind: 'remote',
    hidden: false,
    supportsStreaming: false,
    supportsCustomVoiceId: true,
    modelOptions: [
      { value: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts' },
      { value: 'tts-1', label: 'tts-1' },
      { value: 'tts-1-hd', label: 'tts-1-hd' },
    ],
    fallbackVoiceOptions: OPENAI_TTS_VOICE_OPTIONS,
    styleOptions: OPENAI_TTS_STYLE_OPTIONS,
    adjustmentSupport: { rate: false, pitch: false, volume: false, note: '当前这条 TTS 链路暂时主要靠音色和风格指令控制，语速、语调和音量还没有稳定直通。' },
  },
]

// ── Catalog query functions ──

const speechInputIndex = new Map(SPEECH_INPUT_PROVIDERS.map((p) => [p.id, p]))
const speechOutputIndex = new Map(SPEECH_OUTPUT_PROVIDERS.map((p) => [p.id, p]))

export function getSpeechInputProvider(id: string): SpeechInputProviderEntry {
  return speechInputIndex.get(id) ?? SPEECH_INPUT_PROVIDERS[0]
}

export function getSpeechOutputProvider(id: string): SpeechOutputProviderEntry {
  return speechOutputIndex.get(id) ?? SPEECH_OUTPUT_PROVIDERS[0]
}

export function getSpeechInputProtocol(id: string): SpeechInputProtocol {
  return getSpeechInputProvider(id).protocol
}

export function getSpeechOutputProtocol(id: string): SpeechOutputProtocol {
  return getSpeechOutputProvider(id).protocol
}

export function isSpeechProviderLocal(id: string): boolean {
  const input = speechInputIndex.get(id)
  if (input) return input.kind === 'local'

  const output = speechOutputIndex.get(id)
  if (output) return output.kind === 'local'

  return false
}

export function isElevenLabsProvider(id: string): boolean {
  const input = speechInputIndex.get(id)
  if (input) return input.protocol === 'elevenlabs'

  const output = speechOutputIndex.get(id)
  if (output) return output.protocol === 'elevenlabs'

  return false
}
