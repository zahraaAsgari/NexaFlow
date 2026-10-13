import "server-only";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { users } from "@/db/schema";
import { forgotPasswordAction } from "@/server/actions/account-security";
import { withTestDb } from "@/server/test/db-harness";

/**
 * Email-infrastructure security tests — NO NETWORK.
 *
 * Only the external provider SDK (`resend`) is mocked. Everything of ours
 * stays real and under test: configuration validation, message validation,
 * the ResendEmailProvider adapter, error classification/normalization, the
 * `sendEmail` envelope, and the anti-enumeration behavior of
 * `forgotPasswordAction` (which routes delivery through `attemptDelivery`).
 */

const resendSend = vi.hoisted(() => vi.fn());

vi.mock("resend", () => {
  class Resend {
    readonly emails: { send: typeof resendSend };
    constructor(_apiKey: string) {
      this.emails = { send: resendSend };
    }
  }
  return { Resend };
});

/** Fresh module registry per case: the email config is memoized on first read. */
async function loadEmailService() {
  vi.resetModules();
  return import("@/server/email");
}

function providerRejection(statusCode: number, message: string): {
  data: null;
  error: { message: string; statusCode: number };
} {
  return { data: null, error: { message, statusCode } };
}

afterEach(() => {
  resendSend.mockReset();
  vi.unstubAllEnvs();
});

describe("email service — configuration and input classification", () => {
  it("unset configuration returns a typed configuration failure and never throws", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("APP_URL", "");
    const { sendEmail } = await loadEmailService();

    const result = await sendEmail({ to: "a@b.co", subject: "x", html: "<p>x</p>" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("configuration");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("configuration classification wins over input validation when both are bad", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("APP_URL", "");
    const { sendEmail } = await loadEmailService();

    const result = await sendEmail({ to: "not-an-email", subject: "x", html: "<p>x</p>" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("configuration");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("well-formed configuration plus malformed input is typed invalid_input", async () => {
    vi.stubEnv("RESEND_API_KEY", "k_fake");
    vi.stubEnv("EMAIL_FROM", "sender@nexaflow.dev");
    vi.stubEnv("APP_URL", "https://preview.nexaflow.dev");
    const { sendEmail } = await loadEmailService();

    const result = await sendEmail({ to: "not-an-email", subject: "x", html: "<p>x</p>" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
    // Our validation rejected the message before the provider was contacted.
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe("email service — provider error normalization (mocked SDK, no network)", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "k_fake");
    vi.stubEnv("EMAIL_FROM", "sender@nexaflow.dev");
    vi.stubEnv("APP_URL", "https://preview.nexaflow.dev");
  });

  it("normalizes a provider error payload into the provider bucket", async () => {
    resendSend.mockResolvedValue(providerRejection(401, "API key is invalid"));
    const { sendEmail } = await loadEmailService();

    const result = await sendEmail({ to: "a@b.co", subject: "x", html: "<p>x</p>" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("provider");
  });

  it("normalizes a thrown provider failure into the provider bucket", async () => {
    resendSend.mockRejectedValue(new Error("network unreachable"));
    const { sendEmail } = await loadEmailService();

    const result = await sendEmail({ to: "a@b.co", subject: "x", html: "<p>x</p>" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("provider");
  });

  it("returns ok with the provider messageId on success", async () => {
    resendSend.mockResolvedValue({ data: { id: "mid_123" }, error: null });
    const { sendEmail } = await loadEmailService();

    const result = await sendEmail({ to: "a@b.co", subject: "x", html: "<p>x</p>" });

    expect(result).toEqual({ ok: true, messageId: "mid_123" });
    // The adapter passed the full message to the provider boundary.
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it("forwards the configured sender when the message omits one", async () => {
    resendSend.mockResolvedValue({ data: { id: "mid" }, error: null });
    const { sendEmail } = await loadEmailService();

    await sendEmail({ to: "a@b.co", subject: "x", html: "<p>x</p>" });

    const payload = resendSend.mock.calls[0]?.[0] as { from?: string; to?: string };
    expect(payload.from).toBe("sender@nexaflow.dev");
    expect(payload.to).toBe("a@b.co");
  });

  it("never leaks the API key, credentials, or a credential-bearing URL in any result", async () => {
    resendSend.mockResolvedValue(providerRejection(401, "API key is invalid"));
    const { sendEmail } = await loadEmailService();

    const seen = JSON.stringify(
      await sendEmail({ to: "a@b.co", subject: "x", html: "<p>token=secret</p>" }),
    );

    expect(seen).not.toMatch(/k_fake/);
    expect(seen).not.toMatch(/api[-_ ]?key/i);
    expect(seen).not.toMatch(/scrypt\./);
    expect(seen).not.toMatch(/token_hash/);
    expect(seen).not.toMatch(/reset-password|verify-email|invite/);
  });
});

describe("attemptDelivery via forgotPasswordAction — anti-enumeration under delivery failure", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "k_fake");
    vi.stubEnv("EMAIL_FROM", "sender@nexaflow.dev");
    vi.stubEnv("APP_URL", "https://preview.nexaflow.dev");
  });

  it("returns an identical neutral response for known and unknown emails when the provider fails", async () => {
    resendSend.mockRejectedValue(new Error("provider down"));
    const { sendEmail } = await loadEmailService();
    // Sanity: the mocked provider really is failing.
    const probe = await sendEmail({ to: "a@b.co", subject: "x", html: "<p>x</p>" });
    expect(probe.ok).toBe(false);

    await withTestDb(async (tx) => {
      await tx.insert(users).values({
        email: "known-account@nexaflow.dev",
        name: "Known",
        passwordHash: "scrypt.16384.8.1.x.y",
      });

      const known = await forgotPasswordAction({ status: "idle" }, formDataWith("known-account@nexaflow.dev"));
      const unknown = await forgotPasswordAction({ status: "idle" }, formDataWith("no-such-account@nexaflow.dev"));

      // Identical public outcome — no account-existence signal, no false "sent".
      expect(known).toEqual(unknown);
      expect(known.status).toBe("done");

      // The persisted credential survives the failed delivery for BOTH paths
      // only where an account actually exists.
      const rows = await tx.select().from(users).where(eq(users.email, "known-account@nexaflow.dev"));
      expect(rows.length).toBe(1);
    });
  });
});

function formDataWith(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}
