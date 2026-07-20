// AES-GCM encryption helpers for Gmail OAuth tokens at rest.
// Uses the GMAIL_TOKEN_ENCRYPTION_KEY secret. Encrypted values are stored as
// "enc:v1:<base64(iv|ciphertext)>". Legacy plaintext values are transparently
// passed through by decryptToken() for a smooth migration.

const ENC_PREFIX = 'enc:v1:';

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY');
  if (!raw) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY is not configured');
  }
  // Hash secret to a fixed 32-byte AES-256 key.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return ENC_PREFIX + toB64(combined);
}

export async function decryptToken(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) {
    // Legacy plaintext value — return as-is; caller should re-encrypt on next write.
    return stored;
  }
  const key = await getKey();
  const combined = fromB64(stored.slice(ENC_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}
