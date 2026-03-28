import crypto from 'crypto';

const ALGORITHM = 'sha512';
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const PREFIX = `pbkdf2_${ALGORITHM}`;

export function hashPassword(password, options = {}) {
  const plain = String(password || '');
  if (!plain) {
    throw new Error('Password is required');
  }

  const salt = options.salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(plain, salt, ITERATIONS, KEY_LENGTH, ALGORITHM)
    .toString('hex');

  return `${PREFIX}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const plain = String(password || '');
  const serialized = String(storedHash || '');
  const parts = serialized.split('$');

  if (parts.length !== 4) return false;

  const [prefix, rawIterations, salt, storedDigest] = parts;
  if (prefix !== PREFIX || !salt || !storedDigest) return false;

  const iterations = Number(rawIterations);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const candidateDigest = crypto
    .pbkdf2Sync(plain, salt, iterations, KEY_LENGTH, ALGORITHM)
    .toString('hex');

  const a = Buffer.from(candidateDigest, 'hex');
  const b = Buffer.from(storedDigest, 'hex');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
