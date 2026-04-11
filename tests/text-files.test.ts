import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildBrowserFileInputAccept,
  buildBrowserFilePickerTypes,
} from '../src/lib/textFiles.ts'

test('buildBrowserFileInputAccept flattens filter extensions into an input accept string', () => {
  assert.equal(
    buildBrowserFileInputAccept([
      { name: 'JSON', extensions: ['json'] },
      { name: 'Markdown', extensions: ['md', '.txt'] },
    ]),
    '.json,.md,.txt',
  )
})

test('buildBrowserFilePickerTypes normalizes file picker accept types', () => {
  assert.deepEqual(
    buildBrowserFilePickerTypes([
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['.txt'] },
    ]),
    [
      {
        description: 'JSON',
        accept: {
          'text/plain': ['.json'],
        },
      },
      {
        description: 'Text',
        accept: {
          'text/plain': ['.txt'],
        },
      },
    ],
  )
})
