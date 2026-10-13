import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Explicit implementation type so the promisified variant is a stable
 * (…options) => Promise<Buffer> signature (the callback overloads do not
 * promisify to a precise single signature).
 */
const scrypt = promisify(
  (
    password: Parameters<typeof scryptCallback>[0],
    salt: Parameters<typeof scryptCallback>[1],
    keylen: number,
    options: { N?: number; r?: number; p?: number },
    callback: Parameters<
      (
        password: Parameters<typeof scryptCallback>[0],
        salt: Parameters<typeof scryptCallback>[1],
        keylen: number,
        options: { N?: number; r?: number; p?: number },
        callback: (err: Error | null, derivedKey: Buffer) => void,
      ) => void
    >[4],
  ) => scryptCallback(password, salt, keylen, options, callback),
);

/**
 * Password hashing with Node's native scrypt — deliberately distinct from
 * session-token hashing (SHA-256, see session.ts).
 *
 * Stored format (base64url fields, period-separated):
 *   scrypt.<N>.<r>.<p>.<salt>.<derivedKey>
 * The parameters live inside the stored value so the cost can be raised
 * later without breaking existing hashes — verification always replays the
 * parameters encoded in the stored hash.
 */
const ALGORITHM = "scrypt";
const SCRYPT_N = 16384; // CPU/memory cost (2^14) — Node's documented default
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16; // 128-bit random salt per password
const KEY_BYTES = 32; // 256-bit derived key

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await scrypt(password, salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    ALGORITHM,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(".");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltB64, expectedB64] = storedHash.split(".");
    if (!algorithm || !n || !r || !p || !saltB64 || !expectedB64) return false;
    if (algorithm !== ALGORITHM) return false;

    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(expectedB64, "base64url");

    const derivedKey = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    return timingSafeEqual(derivedKey, expected);
  } catch {
    // Malformed stored hashes fail closed without leaking internals.
    return false;
  }
}
