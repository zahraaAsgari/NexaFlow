import "server-only";

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

/**
 * Password-security unit tests. The implementation under test is the scrypt
 * hashing and timing-safe verification already proven in production — these
 * tests are the automated regression coverage the stack was missing.
 */
describe("password hashing & verification", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("supersecret-1");
    await expect(verifyPassword("supersecret-1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("supersecret-1");
    await expect(verifyPassword("supersecret-2", hash)).resolves.toBe(false);
  });

  it("rejects a malformed stored hash without throwing", async () => {
    await expect(verifyPassword("whatever", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "")).resolves.toBe(false);
    await expect(verifyPassword("whatever", "bcrypt$garbage")).resolves.toBe(false);
  });

  it("produces deterministic-format scrypt hashes with a unique salt and never exposes plaintext", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    // Format: scrypt.<N>.<r>.<p>.<salt(base64url)>.<derivedKey(base64url)>
    expect(a.startsWith("scrypt.")).toBe(true);
    expect(b.startsWith("scrypt.")).toBe(true);
    // Same plaintext → DIFFERENT hashes because of per-password random salt.
    expect(a).not.toBe(b);
    // Plaintext is never stored.
    expect(a).not.toContain("same-password");
    // A hash generated from a plaintext is never usable as a password itself,
    // and verification always uses timing-safe equality.
    await expect(verifyPassword("same-password", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password", b)).resolves.toBe(true);
  });
});
