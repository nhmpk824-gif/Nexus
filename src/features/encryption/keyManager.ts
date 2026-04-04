import { createEncryptionKey } from './crypto'

let keyPromise: Promise<CryptoKey> | null = null

export function getEncryptionKey() {
  if (!keyPromise) {
    keyPromise = createEncryptionKey()
  }

  return keyPromise
}

export function setEncryptionKey(key: CryptoKey) {
  keyPromise = Promise.resolve(key)
}

export function clearEncryptionKey() {
  keyPromise = null
}
