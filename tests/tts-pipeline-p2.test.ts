import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AudioPlayerSink,
  FrameProcessor,
  Pipeline,
  SentenceAggregator,
  createAudioFrame,
  createEndFrame,
  createInterruptionFrame,
  createStartFrame,
  createTextDeltaFrame,
  type Frame,
  type TextSentenceFrame,
} from '../src/features/voice/tts-pipeline/index.ts'

class RecordingProcessor extends FrameProcessor {
  public readonly received: Frame[] = []
  override async process(frame: Frame): Promise<void> {
    this.received.push(frame)
    await this.pushDownstream(frame)
  }
}

function sentences(frames: Frame[]): TextSentenceFrame[] {
  return frames.filter((f): f is TextSentenceFrame => f.type === 'text-sentence')
}

// ─── SentenceAggregator ─────────────────────────────────────────────────

test('SentenceAggregator emits a sentence when a boundary arrives', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator(), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('t1', '主人你好'))
  await pipeline.push(createTextDeltaFrame('t1', '，今天'))
  await pipeline.push(createTextDeltaFrame('t1', '挺好的。'))
  const s = sentences(tail.received)
  assert.equal(s.length, 1)
  assert.equal(s[0].text, '主人你好，今天挺好的。')
  assert.equal(s[0].segmentIndex, 0)
})

test('SentenceAggregator splits a single delta containing multiple sentences', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator(), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('t1', '吃了吗？我刚吃完。明天见！'))
  const s = sentences(tail.received)
  assert.deepEqual(
    s.map((f) => f.text),
    ['吃了吗？', '我刚吃完。', '明天见！'],
  )
  assert.deepEqual(
    s.map((f) => f.segmentIndex),
    [0, 1, 2],
  )
})

test('SentenceAggregator leaves trailing partial in the buffer until EndFrame', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator(), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('t1', '你好。好久不见'))
  assert.equal(sentences(tail.received).length, 1, 'first sentence emitted immediately')
  await pipeline.push(createEndFrame('t1'))
  const s = sentences(tail.received)
  assert.equal(s.length, 2)
  assert.equal(s[1].text, '好久不见')
})

test('SentenceAggregator force-splits an overlong buffer without a boundary', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator({ maxSentenceChars: 8 }), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('t1', '一二三四五六七八九十'))
  const s = sentences(tail.received)
  assert.equal(s.length, 1)
  assert.equal(s[0].text, '一二三四五六七八')
})

test('SentenceAggregator drops buffered text on InterruptionFrame', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator(), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('t1', '说到一半'))
  await pipeline.push(createInterruptionFrame('t1', 'user-barge-in'))
  await pipeline.push(createEndFrame('t1'))
  assert.equal(sentences(tail.received).length, 0)
})

test('SentenceAggregator ignores deltas for a turn it is not tracking', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator(), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('other-turn', '脏数据。'))
  await pipeline.push(createTextDeltaFrame('t1', '你好。'))
  const s = sentences(tail.received)
  assert.equal(s.length, 1)
  assert.equal(s[0].text, '你好。')
})

test('SentenceAggregator resets segmentIndex on each StartFrame', async () => {
  const tail = new RecordingProcessor()
  const pipeline = new Pipeline([new SentenceAggregator(), tail])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createTextDeltaFrame('t1', '一。'))
  await pipeline.push(createEndFrame('t1'))
  await pipeline.push(createStartFrame('t2'))
  await pipeline.push(createTextDeltaFrame('t2', '二。'))
  await pipeline.push(createEndFrame('t2'))
  const s = sentences(tail.received)
  assert.deepEqual(
    s.map((f) => ({ turnId: f.turnId, idx: f.segmentIndex })),
    [{ turnId: 't1', idx: 0 }, { turnId: 't2', idx: 0 }],
  )
})

// ─── AudioPlayerSink ────────────────────────────────────────────────────

function makeFakePlayer() {
  const calls: Array<['append', number] | ['stop']> = []
  const player = {
    appendPcmChunk(samples: Float32Array) {
      calls.push(['append', samples.length])
    },
    stopAndClear() {
      calls.push(['stop'])
    },
  }
  return { player, calls }
}

test('AudioPlayerSink forwards AudioFrame to the player', async () => {
  const { player, calls } = makeFakePlayer()
  const sink = new AudioPlayerSink({ getPlayer: () => player as never })
  const pipeline = new Pipeline([sink])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createAudioFrame('t1', new Float32Array(128), 24000, 1, 0))
  assert.deepEqual(calls, [['append', 128]])
})

test('AudioPlayerSink drops AudioFrame from a stale turn', async () => {
  const { player, calls } = makeFakePlayer()
  const sink = new AudioPlayerSink({ getPlayer: () => player as never })
  const pipeline = new Pipeline([sink])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createAudioFrame('stale', new Float32Array(4), 24000, 1, 0))
  assert.deepEqual(calls, [], 'stale frame must not reach the player')
})

test('AudioPlayerSink stops playback on InterruptionFrame', async () => {
  const { player, calls } = makeFakePlayer()
  const sink = new AudioPlayerSink({ getPlayer: () => player as never })
  const pipeline = new Pipeline([sink])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.push(createAudioFrame('t1', new Float32Array(8), 24000, 1, 0))
  await pipeline.push(createInterruptionFrame('t1', 'user-barge-in'))
  assert.deepEqual(calls, [['append', 8], ['stop']])
  // After interruption the active turnId is cleared, so subsequent
  // audio frames for the same turn should also be dropped.
  await pipeline.push(createAudioFrame('t1', new Float32Array(4), 24000, 1, 0))
  assert.deepEqual(calls, [['append', 8], ['stop']])
})

test('AudioPlayerSink.shutdown calls stopAndClear', async () => {
  const { player, calls } = makeFakePlayer()
  const sink = new AudioPlayerSink({ getPlayer: () => player as never })
  const pipeline = new Pipeline([sink])
  await pipeline.push(createStartFrame('t1'))
  await pipeline.stop()
  assert.deepEqual(calls, [['stop']])
})
