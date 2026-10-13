import "server-only";

import { describe, expect, it } from "vitest";

import {
  generateSecurityToken,
  hashSecurityToken,
} from "@/server/security/tokens";

/**
 * Shared-token crypto mechanics. Purpose semantics stay per-flow; these tests
 * only prove generation format/entropy and deterministic one-way hashing.
 */
describe("security token generation + hashing", () => {
  it("generates URL-safe 32-byte tokens in base64url (43 chars, no padding ambiguity inputs)", () => {
    const token = generateSecurityToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats in normal operation across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 256; i++) {
      const token = generateSecurityToken();
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });

  it("hashes deterministically for the same input", () => {
    const t = generateSecurityToken();
    expect(hashSecurityToken(t)).toBe(hashSecurityToken(t));
    expect(hashSecurityToken(generateSecurityToken())).not.toBe(
      hashSecurityToken(generateSecurityToken()),
    );
  });

  it("produces a one-way 64-char SHA-256 representation, never the raw token", () => {
    const raw = generateSecurityToken();
    const hashed = hashSecurityToken(raw);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(hashed).not.toBe(raw);
  });
});
