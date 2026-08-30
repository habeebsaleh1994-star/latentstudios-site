const INVITATION_CONTEXT = 'latent-print-engine-private-beta-v1';
const INVITATION_BYTES = 16;
const encoder = new TextEncoder();

function encodeBase64URL(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

async function digest(value) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(value)),
  );
}

async function constantTimeTextMatch(leftValue, rightValue) {
  const [left, right] = await Promise.all([
    digest(leftValue),
    digest(rightValue),
  ]);

  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function derivePrintEngineInvitation(secret) {
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(INVITATION_CONTEXT)),
  );
  return encodeBase64URL(signature.slice(0, INVITATION_BYTES));
}

export async function invitationMatches(candidate, secret) {
  if (!/^[A-Za-z0-9_-]{22}$/u.test(candidate ?? '')) return false;
  const expected = await derivePrintEngineInvitation(secret);
  return expected ? constantTimeTextMatch(candidate, expected) : false;
}

export async function legacyAccessMatches(candidate, secret) {
  if (!candidate || !secret) return false;
  return constantTimeTextMatch(candidate, secret);
}
