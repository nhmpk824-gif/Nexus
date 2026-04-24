// Vision-capable model detection by model id.
//
// A heuristic match against well-known multimodal families. We default to
// "no vision" when uncertain so users on text-only models don't see a
// non-functional attachment button — false negatives are recoverable
// (user can switch to a known vision model), false positives ship a
// broken paste flow.

const VISION_MODEL_PATTERNS: readonly RegExp[] = [
  /gpt-4o(?!-mini-tts|-mini-transcribe|-transcribe)/i,
  /gpt-4\.1/i,
  /gpt-4-vision/i,
  /gpt-4-turbo/i,
  /gpt-5/i,
  /\bo3\b|\bo4\b/i,
  /claude-3/i,
  /claude-4/i,
  /claude-5/i,
  /claude-(opus|sonnet|haiku)/i,
  /gemini/i,
  /qwen.*-vl/i,
  /qwen2(\.5)?-vl/i,
  /\bvl-/i,
  /-vl\b/i,
  /\bvision\b/i,
  /pixtral/i,
  /llava/i,
  /llama-?\d+(\.\d+)?-vision/i,
  /minicpm-?v/i,
  /moondream/i,
  /internvl/i,
  /cogvlm/i,
  /yi-vl/i,
  /glm-4v/i,
  /step-1v/i,
]

export function modelSupportsVision(model: string | null | undefined): boolean {
  if (!model) return false
  const id = model.trim()
  if (!id) return false
  return VISION_MODEL_PATTERNS.some((pattern) => pattern.test(id))
}
