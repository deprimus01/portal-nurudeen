import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// A temporary password sent via SMS/email on invite-only account creation.
// Deliberately excludes ambiguous characters (0/O, 1/l/I) since it's read
// off a phone screen or SMS by a parent, not copy-pasted.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTempPassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[Math.floor(Math.random() * TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

const JWT_EXPIRES_IN = '7d';

export function signSessionToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifySessionToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
