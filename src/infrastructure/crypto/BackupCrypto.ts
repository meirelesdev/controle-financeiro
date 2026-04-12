/** Criptografia de backup usando Web Crypto API nativa (PBKDF2 → AES-GCM 256-bit).
 *  Sem dependências externas.
 */

const ITERATIONS = 100_000
const SALT_BYTES  = 16
const IV_BYTES    = 12

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Formato do arquivo cifrado: [salt(16)] [iv(12)] [ciphertext] */
export async function encryptBackup(jsonStr: string, password: string): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES) as Uint8Array<ArrayBuffer>)
  const iv   = crypto.getRandomValues(new Uint8Array(IV_BYTES) as Uint8Array<ArrayBuffer>)
  const key  = await deriveKey(password, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(jsonStr)
  )

  const result = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength)
  result.set(salt, 0)
  result.set(iv, SALT_BYTES)
  result.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES)
  return result.buffer
}

/** Lança erro se a senha estiver errada ou o arquivo estiver corrompido. */
export async function decryptBackup(encrypted: ArrayBuffer, password: string): Promise<string> {
  const data       = new Uint8Array(encrypted)
  const salt       = data.slice(0, SALT_BYTES) as Uint8Array<ArrayBuffer>
  const iv         = data.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
  const ciphertext = data.slice(SALT_BYTES + IV_BYTES)
  const key        = await deriveKey(password, salt)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(plaintext)
}
