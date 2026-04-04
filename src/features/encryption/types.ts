export interface EncryptedPayload {
  version: 1
  algorithm: 'AES-GCM'
  iv: string
  ciphertext: string
}

export interface SecureStorageOptions<T> {
  key: string
  fallback: T
}
