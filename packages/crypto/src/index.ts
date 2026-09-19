/**
 * Client-side asset encryption helpers.
 *
 * There is no default key. The caller must supply a 32-byte, base64-encoded
 * master key (e.g. fetched once from an authenticated session, never hardcoded).
 * Each call generates a fresh random salt, so no two assets share a derived key
 * even though they share the same master key.
 */
const SALT_BYTES = 16;

async function importMasterKey(masterKeyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error('Master key must decode to exactly 32 bytes');
  }
  return crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
}

async function deriveKey(masterKeyBase64: string, salt: Uint8Array): Promise<CryptoKey> {
  const km = await importMasterKey(masterKeyBase64);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('forge-ai-asset-encryption') },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptAsset(
  data: ArrayBuffer,
  masterKeyBase64: string
): Promise<{ salt: string; iv: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterKeyBase64, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ct))),
  };
}

export async function decryptAsset(
  saltB64: string,
  iv: string,
  ciphertext: string,
  masterKeyBase64: string
): Promise<ArrayBuffer> {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await deriveKey(masterKeyBase64, salt);
  const ivB = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ctB = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivB }, key, ctB);
}
