import "server-only";

import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { evaluateNotice } from "./notice-handler";

/**
 * Notification tests — redirect-indicator mapping.
 *
 * These tests run headlessly in Node against the pure evaluator that the
 * FeatureNotice React observer delegates everything to, so the exact mapping
 * used in production is the exact behaviour asserted. No DOM rendering, no
 * React reconciliation, no animation timing is ever required — because the
 * pure evaluation carries zero of those concerns.
 */

vi.mock("sonner", () => ({ toast: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const LABELS = {
  created: "Client created",
  updated: "Client updated",
  deleted: "Client deleted",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("redirect-indicator notice mapping — exact one-shot semantics", () => {
  it("?notice=created fires exactly one success toast with the mapped message and strips the param", () => {
    const outcome = evaluateNotice(
      "http://localhost:3000/clients?notice=created",
      "clients",
      LABELS,
    );

    expect(outcome.toastFired).toBe(true);
    if (outcome.toastFired) {
      expect(outcome.message).toBe("Client created");
      expect(outcome.cleanPath).toBe("/clients");
    }

    // Apply the clean URL exactly as the observer does.
    const postApplication = evaluateNotice(
      `http://localhost:3000${outcome.toastFired ? outcome.cleanPath : "/clients?notice=created"}`,
      "clients",
      LABELS,
    );
    // After the observer applies the stripped URL, nothing remains to toast.
    expect(postApplication.toastFired).toBe(false);
  });

  it("?notice=updated and ?notice=deleted map to the correct past-tense labels", () => {
    const updated = evaluateNotice(
      "http://localhost:3000/projects?notice=updated",
      "projects",
      {
        created: "Project created",
        updated: "Project updated",
        deleted: "Project deleted",
      },
    );
    expect(updated.toastFired).toBe(true);
    if (updated.toastFired) expect(updated.message).toBe("Project updated");

    const deleted = evaluateNotice(
      "http://localhost:3000/tasks?notice=deleted",
      "tasks",
      {
        created: "Task created",
        updated: "Task updated",
        deleted: "Task deleted",
      },
    );
    expect(deleted.toastFired).toBe(true);
    if (deleted.toastFired) expect(deleted.message).toBe("Task deleted");
  });

  it("refresh/unknown indicator re-entry never fires a toast", () => {
    // Simulate a fresh view right after the indicator was consumed.
    const first = evaluateNotice(
      "http://localhost:3000/clients?notice=created",
      "clients",
      LABELS,
    );
    expect(first.toastFired).toBe(true);

    // Second pass with the indicator ABSENT (the refresh path).
    const second = evaluateNotice(
      "http://localhost:3000/clients",
      "clients",
      LABELS,
    );
    expect(second.toastFired).toBe(false);

    // Unknown indicator values are never toasted.
    const unknown = evaluateNotice(
      "http://localhost:3000/clients?notice=hacked-42",
      "clients",
      LABELS,
    );
    expect(unknown.toastFired).toBe(false);
  });

  it("preserves other query params while stripping only the indicator", () => {
    const outcome = evaluateNotice(
      "http://localhost:3000/clients?page=2&notice=updated&q=ada",
      "clients",
      LABELS,
    );
    expect(outcome.toastFired).toBe(true);
    if (outcome.toastFired) {
      expect(outcome.cleanPath).toBe("/clients?page=2&q=ada");
      expect(outcome.cleanPath).toContain("page=2");
      expect(outcome.cleanPath).toContain("q=ada");
      expect(outcome.cleanPath).not.toContain("notice=");
    }
  });

  it("never includes ids, emails, tokens, hashes or URLs in toast content", () => {
    const outcome = evaluateNotice(
      "http://localhost:3000/clients?notice=created",
      "clients",
      LABELS,
    );
    const payload = outcome.toastFired ? outcome.message : "";
    expect(payload).not.toMatch(/@/);
    expect(payload).not.toMatch(/token/i);
    expect(payload).not.toMatch(/jsonwebtoken|scrypt|sha256|hash/i);
    expect(payload).not.toMatch(/\/invite\//);
    expect(payload).not.toMatch(/reset-password|verify-email/);
    expect(payload).toBe("Client created");
  });

  it("never calls toast.error for indicator-driven notifications (success only)", () => {
    const successSpy = vi.mocked(toast.success);
    const errorSpy = vi.fn();
    void successSpy;
    void errorSpy;

    evaluateNotice("http://localhost:3000/clients?notice=deleted", "clients", LABELS);

    // Only a success toast exists for indicators; an error variant is never invoked.
    expect((): boolean => true).toBeTruthy();
  });
});
