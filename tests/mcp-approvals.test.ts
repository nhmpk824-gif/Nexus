import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { hashMcpCommand } from '../electron/services/mcpApprovalsHash.js'

// We deliberately don't import the dialog/persistence side of mcpApprovals
// here — those depend on Electron's `app` and `dialog`, which aren't
// available in node:test. The hash function is the only piece that's
// safe to import bare-bones, but it's also the load-bearing one for
// safety: if the hash is unstable / collision-prone, the entire
// approval gate becomes meaningless.

describe('hashMcpCommand', () => {
  test('returns a 16-char hex string', () => {
    const h = hashMcpCommand('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'])
    assert.match(h, /^[0-9a-f]{16}$/)
  })

  test('is deterministic for identical inputs', () => {
    const a = hashMcpCommand('npx', ['-y', '@m/server-x'])
    const b = hashMcpCommand('npx', ['-y', '@m/server-x'])
    assert.equal(a, b)
  })

  test('differs when command changes', () => {
    const a = hashMcpCommand('npx', ['-y', '@m/server-x'])
    const b = hashMcpCommand('node', ['-y', '@m/server-x'])
    assert.notEqual(a, b)
  })

  test('differs when args change', () => {
    const a = hashMcpCommand('npx', ['-y', '@m/server-x'])
    const b = hashMcpCommand('npx', ['-y', '@m/server-y'])
    assert.notEqual(a, b)
  })

  test('differs when arg ORDER changes (positional security)', () => {
    const a = hashMcpCommand('npx', ['-y', '/safe/path'])
    const b = hashMcpCommand('npx', ['/safe/path', '-y'])
    assert.notEqual(a, b)
  })

  test('handles missing / undefined args gracefully', () => {
    assert.match(hashMcpCommand('npx'), /^[0-9a-f]{16}$/)
    assert.match(hashMcpCommand('npx', undefined as unknown as string[]), /^[0-9a-f]{16}$/)
    assert.match(hashMcpCommand('npx', null as unknown as string[]), /^[0-9a-f]{16}$/)
  })

  test('handles empty command without throwing', () => {
    assert.match(hashMcpCommand('', []), /^[0-9a-f]{16}$/)
    assert.match(hashMcpCommand(undefined as unknown as string), /^[0-9a-f]{16}$/)
  })

  test('argument-injection check: empty string vs no-arg', () => {
    // The empty string is a real argv slot, "no arg" is no slot. They
    // should produce different hashes so a renderer can't sneak past
    // by passing args=[] when the approved command had args=[''].
    assert.notEqual(hashMcpCommand('npx', ['']), hashMcpCommand('npx', []))
  })
})
