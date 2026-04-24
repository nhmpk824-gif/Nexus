import assert from 'node:assert/strict'
import { test } from 'node:test'

import { modelSupportsVision } from '../src/lib/modelCapabilities.ts'

test('modelSupportsVision: known multimodal families', () => {
  for (const id of [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4-turbo',
    'gpt-4-vision-preview',
    'gpt-5',
    'gpt-5-mini',
    'o3-mini',
    'o4',
    'claude-3-5-sonnet-20241022',
    'claude-4-opus',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'qwen-vl-max-latest',
    'qwen2-vl-72b',
    'qwen2.5-vl-7b',
    'pixtral-12b',
    'llava-1.5',
    'llama-3.2-vision',
    'minicpm-v',
    'moondream2',
    'internvl2',
    'glm-4v',
    'yi-vl-34b',
    'step-1v-32k',
  ]) {
    assert.equal(modelSupportsVision(id), true, `expected ${id} to be vision-capable`)
  }
})

test('modelSupportsVision: text-only models', () => {
  for (const id of [
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-reasoner',
    'llama-3.1-70b',
    'llama-3-8b',
    'mistral-7b',
    'codestral-22b',
    'qwen2.5-7b',
    'qwen2.5-coder-32b',
    'gpt-3.5-turbo',
    'gpt-4o-mini-tts',
    'gpt-4o-mini-transcribe',
    'gpt-4o-transcribe',
    'whisper-1',
  ]) {
    assert.equal(modelSupportsVision(id), false, `expected ${id} to be text-only`)
  }
})

test('modelSupportsVision: empty / nullish', () => {
  assert.equal(modelSupportsVision(''), false)
  assert.equal(modelSupportsVision(null), false)
  assert.equal(modelSupportsVision(undefined), false)
  assert.equal(modelSupportsVision('   '), false)
})
