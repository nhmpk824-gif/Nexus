import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { checkUrlSafety } from '../electron/services/urlSafety.js'

describe('checkUrlSafety scheme guard', () => {
  test('accepts https:// by default', () => {
    assert.equal(checkUrlSafety('https://example.com/feed.xml').ok, true)
  })

  test('rejects http:// by default', () => {
    const r = checkUrlSafety('http://example.com/feed.xml')
    assert.equal(r.ok, false)
    assert.match(r.reason ?? '', /scheme/)
  })

  test('accepts http:// with allowHttp', () => {
    assert.equal(checkUrlSafety('http://example.com/feed.xml', { allowHttp: true }).ok, true)
  })

  test('rejects file://', () => {
    const r = checkUrlSafety('file:///etc/passwd')
    assert.equal(r.ok, false)
    assert.match(r.reason ?? '', /scheme/)
  })

  test('rejects gopher://', () => {
    assert.equal(checkUrlSafety('gopher://example.com/').ok, false)
  })

  test('rejects malformed URLs', () => {
    assert.equal(checkUrlSafety('not a url').ok, false)
    assert.equal(checkUrlSafety('').ok, false)
  })
})

describe('checkUrlSafety private-IP blocklist', () => {
  test('rejects loopback IPv4', () => {
    const r = checkUrlSafety('https://127.0.0.1/api')
    assert.equal(r.ok, false)
    assert.match(r.reason ?? '', /127\.0\.0\.1|loopback/i)
  })

  test('rejects 0.0.0.0', () => {
    assert.equal(checkUrlSafety('https://0.0.0.0/api').ok, false)
  })

  test('rejects "localhost"', () => {
    assert.equal(checkUrlSafety('https://localhost/api').ok, false)
  })

  test('rejects RFC1918 10.x.x.x', () => {
    assert.equal(checkUrlSafety('https://10.5.5.5/api').ok, false)
  })

  test('rejects RFC1918 192.168.x.x', () => {
    assert.equal(checkUrlSafety('https://192.168.1.1/api').ok, false)
  })

  test('rejects 172.16.0.0/12 specifically (172.16-31)', () => {
    assert.equal(checkUrlSafety('https://172.16.0.1/').ok, false)
    assert.equal(checkUrlSafety('https://172.20.0.1/').ok, false)
    assert.equal(checkUrlSafety('https://172.31.255.255/').ok, false)
  })

  test('does NOT reject 172.15.x.x (outside RFC1918)', () => {
    assert.equal(checkUrlSafety('https://172.15.1.1/').ok, true)
  })

  test('does NOT reject 172.32.x.x (outside RFC1918)', () => {
    assert.equal(checkUrlSafety('https://172.32.1.1/').ok, true)
  })

  test('rejects link-local 169.254.x.x (covers AWS IMDS)', () => {
    assert.equal(checkUrlSafety('https://169.254.169.254/latest/meta-data/').ok, false)
  })

  test('rejects GCP metadata host', () => {
    assert.equal(checkUrlSafety('https://metadata.google.internal/').ok, false)
  })

  test('rejects IPv6 loopback ::1', () => {
    assert.equal(checkUrlSafety('https://[::1]/api').ok, false)
  })

  test('rejects IPv6 link-local fe80::', () => {
    assert.equal(checkUrlSafety('https://[fe80::1]/api').ok, false)
  })

  test('rejects IPv6 unique-local fc00::/7', () => {
    assert.equal(checkUrlSafety('https://[fc00::1]/api').ok, false)
    assert.equal(checkUrlSafety('https://[fd00::1]/api').ok, false)
  })

  test('accepts public IPv4', () => {
    assert.equal(checkUrlSafety('https://1.1.1.1/api').ok, true)
    assert.equal(checkUrlSafety('https://8.8.8.8/api').ok, true)
  })
})

describe('checkUrlSafety allowPrivate escape hatch', () => {
  test('skips private-IP block when allowPrivate=true', () => {
    assert.equal(checkUrlSafety('https://127.0.0.1/api', { allowPrivate: true }).ok, true)
    assert.equal(checkUrlSafety('https://192.168.1.1/api', { allowPrivate: true }).ok, true)
  })

  test('still enforces scheme even with allowPrivate', () => {
    assert.equal(
      checkUrlSafety('file:///tmp', { allowPrivate: true }).ok,
      false,
    )
  })
})
