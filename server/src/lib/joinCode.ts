import { randomInt } from 'crypto';
import { pool } from '../db/pool';

// Crockford-style base32 alphabet with ambiguous characters (0/O, 1/I/L)
// removed, so codes are easy to read aloud/type in a classroom.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 20;

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Generates a join code guaranteed unique against the courses table at the
 *  moment of generation. Small retry loop rather than a DB-side function —
 *  this app has no privileged SQL functions (see server/src/routes/courses.ts
 *  for why: authorization lives in Express, not in Postgres, since there's
 *  no RLS here). */
export async function generateUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const { rows } = await pool.query('SELECT 1 FROM courses WHERE join_code = $1', [code]);
    if (rows.length === 0) return code;
  }
  throw new Error('could not generate a unique join code');
}
