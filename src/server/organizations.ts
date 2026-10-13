import "server-only";

/**
 * Server-side organization slug generation. Never trust client-provided
 * slugs: they are always derived from the (validated) organization name.
 */
export function slugifyOrganizationName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60); // leave headroom for collision suffixes within 63-char limits

  // Extremely degenerate inputs (e.g. only symbols) still get a safe slug.
  return base.replace(/^-+|-+$/g, "") || "organization";
}

/** Deterministic, collision-tolerant sequence: base → base-2 → base-3 … */
export function slugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}
