export async function exportEncryptedPrivateKey(privateKeyB64, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150_000 },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(privateKeyB64)
  );
  const blob = {
    v: 1,
    kdf: 'PBKDF2-SHA256-150k',
    salt: Array.from(salt),
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ct)),
  };
  return new Blob([JSON.stringify(blob)], { type: 'application/json' });
}

export async function importEncryptedPrivateKey(file, password) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = new Uint8Array(parsed.salt);
  const iv = new Uint8Array(parsed.iv);
  const ct = new Uint8Array(parsed.ct);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150_000 },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return dec.decode(pt); // privateKeyB64
}
