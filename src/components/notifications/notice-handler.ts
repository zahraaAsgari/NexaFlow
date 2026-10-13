/**
 * Shared, dependency-light redirect-indicator → toast mapper.
 *
 * Reads `window.location.href` once, interprets ONE explicit `?notice=…`
 * indicator word against the caller-provided wording set, fires EXACTLY ONE
 * Sonner success toast, and then returns the indicator-free destination URL
 * for the caller to apply via `router.replace(withNextWording…,{scroll:false})`.
 * Unknown rows never toast. This utilities is the ONLY notification query
 * code — it exists so the behaviour can be run headlessly in Node tests
 * without a DOM renderer, and so no render-time waiting/animation timing is
 * required to verify it.
 */

export type NoticeLabels = Record<"created" | "updated" | "deleted", string>;

export type NoticeOutcome =
  | { toastFired: true; message: string; cleanPath: string }
  | { toastFired: false; cleanPath?: never };

/**
 * Evaluates the current URL for a notice indicator and returns what should
 * happen. Caller is responsible for applying the clean URL with
 * `router.replace(...)` ONLY when `toastFired === true` — any unknown or
 * absent indicator must leave the URL untouched and no toast fire.
 */
export function evaluateNotice(
  rawHref: string,
  entity: string,
  labels: NoticeLabels,
): NoticeOutcome {
  const url = new URL(rawHref);
  const indicator = url.searchParams.get("notice");
  if (!indicator || typeof indicator !== "string") {
    return { toastFired: false };
  }

  const message =
    indicator === "created"
      ? labels.created
      : indicator === "updated"
        ? labels.updated
        : indicator === "deleted"
          ? labels.deleted
          : null;

  if (!message) return { toastFired: false };

  url.searchParams.delete("notice");
  return {
    toastFired: true,
    message,
    cleanPath: `${url.pathname}${url.search}${url.hash}`,
  };
}
