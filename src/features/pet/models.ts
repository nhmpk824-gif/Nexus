export type PetExpressionSlot =
  | 'idle'
  | 'thinking'
  | 'happy'
  | 'sleepy'
  | 'surprised'
  | 'confused'
  | 'embarrassed'
  | 'listening'
  | 'speaking'
  | 'touchHead'
  | 'touchFace'
  | 'touchBody'

export interface PetModelDefinition {
  id: string
  label: string
  description: string
  modelPath: string
  fallbackImagePath: string
  motionGroups: {
    idle?: string
    interaction?: string
    listeningStart?: string
    speakingStart?: string
    hit?: string
  }
  expressionMap: Partial<Record<PetExpressionSlot, string>>
  mouthParams?: {
    open?: string
    round?: string
    narrow?: string
    smile?: string
  }
  rigParams?: {
    angleX?: string
    angleY?: string
    angleZ?: string
    bodyAngleX?: string
    bodyAngleY?: string
    eyeBallX?: string
    eyeBallY?: string
    eyeLOpen?: string
    eyeROpen?: string
    browForm?: string
    cheek?: string
    breath?: string
  }
  layout?: {
    widthRatio?: number
    heightRatio?: number
    minWidth?: number
    minHeight?: number
    anchorX?: number
    anchorY?: number
    yOffsetRatio?: number
    yOffsetPx?: number
  }
}

export interface CubismModelFile {
  FileReferences?: {
    Textures?: string[]
    Expressions?: Array<{
      Name: string
      File: string
    }>
    Motions?: Record<string, unknown[]>
  }
  Groups?: Array<{
    Name?: string
    Ids?: string[]
  }>
}

function pickMotionGroup(motions: Record<string, unknown[]> | undefined, candidates: string[]) {
  if (!motions) return undefined

  const entries = Object.keys(motions)
  if (!entries.length) return undefined

  for (const candidate of candidates) {
    const exact = entries.find((key) => key === candidate)
    if (exact) return exact

    const insensitive = entries.find((key) => key.toLowerCase() === candidate.toLowerCase())
    if (insensitive) return insensitive
  }

  return entries[0]
}

function pickExpression(expressions: string[], index: number, fallback?: string) {
  return fallback ?? expressions[index] ?? expressions[0]
}

const DEFAULT_RIG_PARAMS = {
  angleX: 'ParamAngleX',
  angleY: 'ParamAngleY',
  angleZ: 'ParamAngleZ',
  bodyAngleX: 'ParamBodyAngleX',
  bodyAngleY: 'ParamBodyAngleY',
  eyeBallX: 'ParamEyeBallX',
  eyeBallY: 'ParamEyeBallY',
  eyeLOpen: 'ParamEyeLOpen',
  eyeROpen: 'ParamEyeROpen',
  browForm: 'ParamBrowForm',
  cheek: 'ParamCheek',
  breath: 'ParamBreath',
} as const

export const DEFAULT_PET_MODEL_ID = 'mao'

export const PET_MODEL_PRESETS: PetModelDefinition[] = [
  {
    id: 'mao',
    label: 'Mao 魔法少女',
    description: '当前内置测试模型，已经适配了说话嘴型、视线跟随和互动动作。',
    modelPath: './live2d/mao/Mao.model3.json',
    fallbackImagePath: '',
    motionGroups: {
      idle: 'Idle',
      interaction: 'TapBody',
      listeningStart: 'TapBody',
      speakingStart: 'TapBody',
      hit: 'TapBody',
    },
    expressionMap: {
      idle: 'exp_01',
      listening: 'exp_02',
      thinking: 'exp_03',
      sleepy: 'exp_04',
      speaking: 'exp_05',
      happy: 'exp_06',
      surprised: 'exp_08',
      confused: 'exp_03',
      embarrassed: 'exp_07',
      touchBody: 'exp_06',
      touchFace: 'exp_07',
      touchHead: 'exp_08',
    },
    mouthParams: {
      open: 'ParamA',
      round: 'ParamO',
      narrow: 'ParamI',
      smile: 'ParamMouthUp',
    },
    rigParams: {
      angleX: 'ParamAngleX',
      angleY: 'ParamAngleY',
      angleZ: 'ParamAngleZ',
      bodyAngleX: 'ParamBodyAngleX',
      bodyAngleY: 'ParamBodyAngleY',
      eyeBallX: 'ParamEyeBallX',
      eyeBallY: 'ParamEyeBallY',
      eyeLOpen: 'ParamEyeLOpen',
      eyeROpen: 'ParamEyeROpen',
      browForm: 'ParamBrowForm',
      cheek: 'ParamCheek',
      breath: 'ParamBreath',
    },
    layout: {
      widthRatio: 0.74,
      heightRatio: 0.84,
      minWidth: 250,
      minHeight: 360,
      anchorX: 0.5,
      anchorY: 0,
      yOffsetRatio: 0.03,
      yOffsetPx: 12,
    },
  },
  {
    id: 'haru',
    label: 'Haru 双马尾少女',
    description: 'Live2D 官方旗舰示例角色，8 个表情 + 嘴型同步 + 视线跟随。',
    modelPath: './live2d/haru/Haru.model3.json',
    fallbackImagePath: '',
    motionGroups: {
      idle: 'Idle',
      interaction: 'TapBody',
      listeningStart: 'TapBody',
      speakingStart: 'TapBody',
      hit: 'TapBody',
    },
    expressionMap: {
      idle: 'F01',
      listening: 'F04',
      thinking: 'F07',
      sleepy: 'F08',
      speaking: 'F02',
      happy: 'F05',
      surprised: 'F06',
      confused: 'F07',
      embarrassed: 'F03',
      touchBody: 'F05',
      touchFace: 'F01',
      touchHead: 'F06',
    },
    mouthParams: {
      open: 'ParamMouthOpenY',
      smile: 'ParamMouthForm',
    },
    rigParams: {
      angleX: 'ParamAngleX',
      angleY: 'ParamAngleY',
      angleZ: 'ParamAngleZ',
      bodyAngleX: 'ParamBodyAngleX',
      bodyAngleY: 'ParamBodyAngleY',
      eyeBallX: 'ParamEyeBallX',
      eyeBallY: 'ParamEyeBallY',
      eyeLOpen: 'ParamEyeLOpen',
      eyeROpen: 'ParamEyeROpen',
      breath: 'ParamBreath',
    },
    layout: {
      widthRatio: 0.78,
      heightRatio: 0.88,
      minWidth: 260,
      minHeight: 380,
      anchorX: 0.5,
      anchorY: 0,
      yOffsetRatio: 0.02,
      yOffsetPx: 8,
    },
  },
  {
    id: 'natori',
    label: 'Natori 短发少女',
    description: 'Live2D 官方示例角色，11 个表情（含语义命名）+ 嘴型 + 脸红参数。',
    modelPath: './live2d/natori/Natori.model3.json',
    fallbackImagePath: '',
    motionGroups: {
      idle: 'Idle',
      interaction: 'TapBody',
      listeningStart: 'TapBody',
      speakingStart: 'TapBody',
      hit: 'TapBody',
    },
    expressionMap: {
      idle: 'Normal',
      listening: 'exp_03',
      thinking: 'exp_01',
      sleepy: 'Sad',
      speaking: 'exp_02',
      happy: 'Smile',
      surprised: 'Surprised',
      confused: 'exp_01',
      embarrassed: 'Blushing',
      touchBody: 'Smile',
      touchFace: 'Blushing',
      touchHead: 'Surprised',
    },
    mouthParams: {
      open: 'ParamMouthOpenY',
      smile: 'ParamMouthForm',
    },
    rigParams: {
      angleX: 'ParamAngleX',
      angleY: 'ParamAngleY',
      angleZ: 'ParamAngleZ',
      bodyAngleX: 'ParamBodyAngleX',
      bodyAngleY: 'ParamBodyAngleY',
      eyeBallX: 'ParamEyeBallX',
      eyeBallY: 'ParamEyeBallY',
      eyeLOpen: 'ParamEyeLOpen',
      eyeROpen: 'ParamEyeROpen',
      cheek: 'ParamCheek',
      breath: 'ParamBreath',
    },
    layout: {
      widthRatio: 0.74,
      heightRatio: 0.84,
      minWidth: 250,
      minHeight: 360,
      anchorX: 0.5,
      anchorY: 0,
      yOffsetRatio: 0.03,
      yOffsetPx: 12,
    },
  },
  {
    id: 'ren',
    label: 'Ren 少年',
    description: 'Live2D 官方男性角色，5 个表情 + 嘴型同步 + 视线跟随。',
    modelPath: './live2d/ren/Ren.model3.json',
    fallbackImagePath: '',
    motionGroups: {
      idle: 'Idle',
      interaction: 'TapBody',
      listeningStart: 'TapBody',
      speakingStart: 'TapBody',
      hit: 'TapBody',
    },
    expressionMap: {
      idle: 'exp_01',
      listening: 'exp_04',
      thinking: 'exp_05',
      sleepy: 'exp_03',
      speaking: 'exp_01',
      happy: 'exp_02',
      surprised: 'exp_05',
      confused: 'exp_03',
      embarrassed: 'exp_04',
      touchBody: 'exp_02',
      touchFace: 'exp_04',
      touchHead: 'exp_05',
    },
    mouthParams: {
      open: 'ParamMouthOpenY',
      smile: 'ParamMouthForm',
    },
    rigParams: {
      angleX: 'ParamAngleX',
      angleY: 'ParamAngleY',
      angleZ: 'ParamAngleZ',
      bodyAngleX: 'ParamBodyAngleX',
      bodyAngleY: 'ParamBodyAngleY',
      eyeBallX: 'ParamEyeBallX',
      eyeBallY: 'ParamEyeBallY',
      eyeLOpen: 'ParamEyeLOpen',
      eyeROpen: 'ParamEyeROpen',
      breath: 'ParamBreath',
    },
    layout: {
      widthRatio: 0.74,
      heightRatio: 0.86,
      minWidth: 250,
      minHeight: 370,
      anchorX: 0.5,
      anchorY: 0,
      yOffsetRatio: 0.02,
      yOffsetPx: 10,
    },
  },
]

export function getPetModelPresets(additionalModels: PetModelDefinition[] = []) {
  const merged = [...PET_MODEL_PRESETS]

  for (const model of additionalModels) {
    if (merged.some((preset) => preset.id === model.id)) continue
    merged.push(model)
  }

  return merged
}

export function getPetModelPreset(modelId?: string, additionalModels: PetModelDefinition[] = []) {
  const presets = getPetModelPresets(additionalModels)
  return presets.find((preset) => preset.id === modelId) ?? presets[0]
}

export function buildRuntimePetModelDefinition(
  modelDefinition: PetModelDefinition,
  modelFile?: CubismModelFile,
): PetModelDefinition {
  const expressions = modelFile?.FileReferences?.Expressions?.map((expression) => expression.Name) ?? []
  const motions = modelFile?.FileReferences?.Motions
  const lipSyncIds = modelFile?.Groups?.find((group) => group.Name === 'LipSync')?.Ids ?? []

  return {
    ...modelDefinition,
    motionGroups: {
      idle: modelDefinition.motionGroups.idle ?? pickMotionGroup(motions, ['Idle', 'idle', 'Main', 'main']),
      interaction: modelDefinition.motionGroups.interaction ?? pickMotionGroup(
        motions,
        ['TapBody', 'Tap', 'Touch', 'touch', 'Action'],
      ),
      listeningStart: modelDefinition.motionGroups.listeningStart ?? modelDefinition.motionGroups.interaction
        ?? pickMotionGroup(motions, ['TapBody', 'Tap', 'Touch']),
      speakingStart: modelDefinition.motionGroups.speakingStart ?? modelDefinition.motionGroups.interaction
        ?? pickMotionGroup(motions, ['TapBody', 'Tap', 'Touch']),
      hit: modelDefinition.motionGroups.hit ?? modelDefinition.motionGroups.interaction
        ?? pickMotionGroup(motions, ['TapBody', 'Tap', 'Touch']),
    },
    expressionMap: {
      idle: pickExpression(expressions, 0, modelDefinition.expressionMap.idle),
      listening: pickExpression(expressions, 1, modelDefinition.expressionMap.listening),
      thinking: pickExpression(expressions, 2, modelDefinition.expressionMap.thinking),
      sleepy: pickExpression(expressions, 3, modelDefinition.expressionMap.sleepy),
      speaking: pickExpression(expressions, 4, modelDefinition.expressionMap.speaking),
      happy: pickExpression(expressions, 5, modelDefinition.expressionMap.happy),
      touchBody: pickExpression(expressions, 5, modelDefinition.expressionMap.touchBody),
      touchFace: pickExpression(expressions, 6, modelDefinition.expressionMap.touchFace),
      touchHead: pickExpression(expressions, 7, modelDefinition.expressionMap.touchHead),
    },
    mouthParams: {
      open: modelDefinition.mouthParams?.open ?? lipSyncIds[0] ?? 'ParamA',
      round: modelDefinition.mouthParams?.round,
      narrow: modelDefinition.mouthParams?.narrow,
      smile: modelDefinition.mouthParams?.smile ?? 'ParamMouthForm',
    },
    rigParams: {
      ...DEFAULT_RIG_PARAMS,
      ...modelDefinition.rigParams,
    },
  }
}
