import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// A one-time login code sent via SMS/email on account creation or an
// admin-triggered password reset. Numeric-only (not alphanumeric) so it's
// easy to read and type back in on a phone keypad — this is a first-login
// gate, not a long-lived credential (mustResetPassword forces a real
// password immediately after).
export function generateTempPassword(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10);
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
