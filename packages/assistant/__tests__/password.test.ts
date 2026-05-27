import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, setEncryptionKey } from '../src/tools/password.js'

describe('password encryption', () => {
  beforeEach(() => {
    setEncryptionKey('test-encryption-key-32-chars!!')
  })

  it('should encrypt and decrypt round-trip', () => {
    const plaintext = 'my-secret-password'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(':')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('should produce different ciphertext each time', () => {
    const plaintext = 'same-input'
    const enc1 = encrypt(plaintext)
    const enc2 = encrypt(plaintext)
    expect(enc1).not.toBe(enc2) // different IV each time
  })

  it('should throw when no encryption key is set', () => {
    setEncryptionKey('')
    expect(() => encrypt('test')).toThrow(/encryption key/i)
    expect(() => decrypt('iv:ciphertext')).toThrow(/encryption key/i)
  })

  it('should handle unicode passwords', () => {
    const plaintext = '密码测试🔐'
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it('should handle empty passwords', () => {
    const plaintext = ''
    const encrypted = encrypt(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })
})
