import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  choosePreferredVoiceTranscript,
  normalizeRecognizedVoiceTranscript,
  resolveVoiceTranscriptDecision,
  shouldAttemptLocalWhisperRescore,
} from '../src/features/hearing/core.ts'
import { applyVoiceHotwordCorrections } from '../src/features/hearing/hotwordCorrection.ts'
import { segmentTextForSpeech } from '../src/features/voice/streamingTts.ts'
import { normalizeVoiceDedupText, prepareTextForTts } from '../src/features/voice/text.ts'

const WAKE_WORD = '\u661f\u7ed8'
const WAKE_WORD_ALIAS = '\u661f\u4f1a'

test('returns manual confirmation decision when manual_confirm mode is enabled', () => {
  const transcript = '\u660e\u5929\u63d0\u9192\u6211\u5f00\u4f1a'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'manual_confirm',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'manual_confirm',
    transcript,
  })
})

test('returns direct send decision outside wake-word mode', () => {
  const transcript = '\u5e2e\u6211\u67e5\u4e00\u4e0b\u4e0a\u6d77\u5929\u6c14'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'direct_send',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'send',
    transcript,
    content: transcript,
    mode: 'direct_send',
  })
})

test('holds incomplete duration-only transcript instead of sending it', () => {
  const transcript = '\u80fd\u4e94\u5206\u949f\u4e4b\u540e'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'direct_send',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'hold_incomplete',
    transcript,
    content: transcript,
    mode: 'direct_send',
  })
})

test('holds incomplete command-only transcript instead of sending it', () => {
  const transcript = '\u63d0\u9192\u6211'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'direct_send',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'hold_incomplete',
    transcript,
    content: transcript,
    mode: 'direct_send',
  })
})

test('blocks wake-word mode when wake word is empty', () => {
  const transcript = '\u5e2e\u6211\u8bb0\u4e00\u4e0b\u5f85\u529e'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'wake_word',
    wakeWord: '   ',
  })

  assert.deepEqual(decision, {
    kind: 'blocked_missing_wake_word',
    transcript,
  })
})

test('blocks transcript when wake word is not matched', () => {
  const transcript = '\u5e2e\u6211\u8bb0\u4e00\u4e0b\u5f85\u529e'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'wake_word',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'blocked_unmatched_wake_word',
    transcript,
    wakeWord: WAKE_WORD,
  })
})

test('returns wake-word-only decision when nothing remains after stripping wake word', () => {
  const decision = resolveVoiceTranscriptDecision({
    transcript: WAKE_WORD,
    triggerMode: 'wake_word',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'wake_word_only',
    transcript: WAKE_WORD,
    wakeWord: WAKE_WORD,
  })
})

test('strips wake word aliases before sending content', () => {
  const transcript = `${WAKE_WORD_ALIAS} \u5e2e\u6211\u6253\u5f00\u5b98\u7f51`
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'wake_word',
    wakeWord: WAKE_WORD,
  })

  assert.deepEqual(decision, {
    kind: 'send',
    transcript,
    content: '\u5e2e\u6211\u6253\u5f00\u5b98\u7f51',
    mode: 'wake_word',
  })
})

test('sends transcript directly after KWS already triggered even without wake word in text', () => {
  const transcript = '\u5e2e\u6211\u67e5\u4e00\u4e0b\u4eca\u5929\u5929\u6c14'
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'wake_word',
    wakeWord: WAKE_WORD,
    wakeWordAlreadyTriggered: true,
  })

  assert.deepEqual(decision, {
    kind: 'send',
    transcript,
    content: transcript,
    mode: 'wake_word',
  })
})

test('still strips the wake word when a KWS-triggered transcript contains it', () => {
  const transcript = `${WAKE_WORD} \u5e2e\u6211\u6253\u5f00\u5b98\u7f51`
  const decision = resolveVoiceTranscriptDecision({
    transcript,
    triggerMode: 'wake_word',
    wakeWord: WAKE_WORD,
    wakeWordAlreadyTriggered: true,
  })

  assert.deepEqual(decision, {
    kind: 'send',
    transcript,
    content: '\u5e2e\u6211\u6253\u5f00\u5b98\u7f51',
    mode: 'wake_word',
  })
})

test('normalizes leading filler words before routing voice transcripts', () => {
  assert.equal(
    normalizeRecognizedVoiceTranscript('\u90a3\u4e2a \u90a3\u4e2a \u5e2e\u6211\u67e5\u4e00\u4e0b\u6df1\u5733\u5929\u6c14'),
    '\u5e2e\u6211\u67e5\u4e00\u4e0b\u6df1\u5733\u5929\u6c14',
  )
})

test('marks short command-like sherpa transcripts for whisper rescoring', () => {
  assert.equal(
    shouldAttemptLocalWhisperRescore('\u63d0\u9192\u6211\u559d\u6c34', {
      partialCount: 1,
      endpointCount: 1,
    }),
    true,
  )
})

test('does not rescore a longer stable conversational transcript by default', () => {
  assert.equal(
    shouldAttemptLocalWhisperRescore('\u4eca\u5929\u6211\u60f3\u8ddf\u4f60\u5206\u4eab\u4e00\u4e0b\u6211\u4e0a\u5348\u505a\u4e86\u4ec0\u4e48', {
      partialCount: 4,
      endpointCount: 1,
    }),
    false,
  )
})

test('prefers the more complete whisper-corrected transcript when it scores better', () => {
  assert.equal(
    choosePreferredVoiceTranscript('\u6700\u540e\u63d0\u9192\u6211\u559d\u6c34', '\u4e94\u5206\u949f\u4e4b\u540e\u63d0\u9192\u6211\u559d\u6c34'),
    '\u4e94\u5206\u949f\u4e4b\u540e\u63d0\u9192\u6211\u559d\u6c34',
  )
})

test('applies built-in hotword correction for reminder time phrases', () => {
  const correction = applyVoiceHotwordCorrections('\u6700\u540e\u63d0\u9192\u6211\u559d\u6c34')

  assert.equal(correction.text, '\u4e94\u5206\u949f\u540e\u63d0\u9192\u6211\u559d\u6c34')
  assert.equal(correction.changed, true)
})

test('applies built-in hotword correction for weather city aliases', () => {
  const correction = applyVoiceHotwordCorrections('\u5e2e\u6211\u770b\u4e00\u4e0b\u6df1\u8bc1\u5929\u5668')

  assert.equal(correction.text, '\u5e2e\u6211\u770b\u4e00\u4e0b\u6df1\u5733\u5929\u6c14')
})

test('applies built-in hotword correction for lyric search aliases', () => {
  const correction = applyVoiceHotwordCorrections('\u5e2e\u6211\u641c\u6240\u5468\u4f20\u718a\u9ec4\u5a5a\u6b4c\u6b21')

  assert.equal(correction.text, '\u5e2e\u6211\u641c\u7d22\u5468\u4f20\u96c4\u9ec4\u660f\u6b4c\u8bcd')
})

test('prepareTextForTts strips links, urls and stage directions', () => {
  assert.equal(
    prepareTextForTts('查看[黄昏](https://example.com)歌词 https://foo.bar [掌声]'),
    '查看黄昏歌词',
  )
})

test('prepareTextForTts collapses duplicate weather labels and separators', () => {
  assert.equal(
    prepareTextForTts('今天：今天，小阵雨 | 24 / 28'),
    '今天，小阵雨，24，28',
  )
})

test('normalizeVoiceDedupText normalizes whitespace and case', () => {
  assert.equal(
    normalizeVoiceDedupText('  Hello   WORLD  '),
    'hello world',
  )
})

test('segmentTextForSpeech prioritizes an early comma split for the first chunk', () => {
  assert.deepEqual(
    segmentTextForSpeech('\u597d\u7684\uff0c\u4e3b\u4eba\u3002\u6211\u53bb\u641c\u7d22\u4e00\u4e0b\u3002', {
      absoluteMinChunkLength: 2,
      maxChunkLength: 88,
      minForcedChunkLength: 26,
      preferredEarlySplitLength: 20,
      firstChunkMaxLength: 6,
      firstChunkMinForcedChunkLength: 2,
      firstChunkPreferredEarlySplitLength: 2,
    }),
    [
      '\u597d\u7684\uff0c',
      '\u4e3b\u4eba\u3002',
      '\u6211\u53bb\u641c\u7d22\u4e00\u4e0b\u3002',
    ],
  )
})

test('segmentTextForSpeech allows a very short first chunk for local qwen lead-in', () => {
  assert.deepEqual(
    segmentTextForSpeech('\u4f60\u597d\uff0c\u4e3b\u4eba\u3002', {
      absoluteMinChunkLength: 2,
      maxChunkLength: 88,
      minForcedChunkLength: 26,
      preferredEarlySplitLength: 20,
      firstChunkMaxLength: 6,
      firstChunkMinForcedChunkLength: 2,
      firstChunkPreferredEarlySplitLength: 2,
    }),
    [
      '\u4f60\u597d\uff0c',
      '\u4e3b\u4eba\u3002',
    ],
  )
})
