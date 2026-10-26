// Pure TypeScript TOTP (RFC 6238) generator compatible with Google Authenticator & 2fa.live

function sha1(message: Uint8Array): Uint8Array {
  const ml = message.length * 8;
  const paddingLength = (ml % 512 < 448) ? (448 - (ml % 512)) : (960 - (ml % 512));
  const totalLength = message.length + (paddingLength / 8) + 8;
  const buffer = new Uint8Array(totalLength);
  buffer.set(message);
  buffer[message.length] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setBigUint64(totalLength - 8, BigInt(ml), false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < totalLength; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 80; j++) {
      const v = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (v << 1) | (v >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const result = new Uint8Array(20);
  const resView = new DataView(result.buffer);
  resView.setUint32(0, h0, false);
  resView.setUint32(4, h1, false);
  resView.setUint32(8, h2, false);
  resView.setUint32(12, h3, false);
  resView.setUint32(16, h4, false);
  return result;
}

function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  let formattedKey = new Uint8Array(blockSize);
  if (key.length > blockSize) {
    const hashedKey = sha1(key);
    formattedKey.set(hashedKey);
  } else {
    formattedKey.set(key);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = formattedKey[i] ^ 0x5c;
    iKeyPad[i] = formattedKey[i] ^ 0x36;
  }

  const inner = new Uint8Array(blockSize + message.length);
  inner.set(iKeyPad);
  inner.set(message, blockSize);
  const innerHash = sha1(inner);

  const outer = new Uint8Array(blockSize + 20);
  outer.set(oKeyPad);
  outer.set(innerHash, blockSize);
  return sha1(outer);
}

/**
 * Cleans user-provided 2FA secret (removes spaces, hyphens, lowercase)
 */
export function cleanSecret(secret: string): string {
  return (secret || '').replace(/[\s=-]/g, '').toUpperCase();
}

/**
 * Formats a secret key into chunks of 4 characters (e.g. "JBSW Y3DP...")
 */
export function formatSecret(secret: string): string {
  const clean = cleanSecret(secret);
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

/**
 * Decodes Base32 string to Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array | null {
  const clean = cleanSecret(base32);
  if (!clean) return null;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      // Invalid base32 character
      return null;
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

export interface TotpResult {
  token: string;
  formattedToken: string; // "123 456"
  remainingSeconds: number;
  error?: string;
}

/**
 * Generates current 6-digit TOTP code and remaining seconds
 */
export function generateTotp(secret: string): TotpResult {
  const key = base32ToBytes(secret);
  if (!key || key.length === 0) {
    return {
      token: '',
      formattedToken: '',
      remainingSeconds: 0,
      error: 'Chave 2FA inválida (esperado Base32)',
    };
  }

  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  const remainingSeconds = 30 - (epoch % 30);

  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  view.setBigUint64(0, BigInt(counter), false);

  const hmac = hmacSha1(key, counterBytes);
  const offset = hmac[19] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const token = (code % 1000000).toString().padStart(6, '0');
  const formattedToken = `${token.slice(0, 3)} ${token.slice(3)}`;

  return {
    token,
    formattedToken,
    remainingSeconds,
  };
}
