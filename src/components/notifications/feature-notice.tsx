"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { NoticeLabels } from "./notice-handler";

/**
 * Feature-page notification belt.
 *
 * ONE registered observer per feature list page (clients / projects / tasks)
 * that maps ONE low-entropy redirect indicator to ONE Sonner success toast.
 * It relies entirely on a small pure evaluator (see notice-handler.ts) so
 * zero render-time DOM/animation timing is ever required to verify the
 * behaviour — and so the mapping lives in exactly one place:
 *
 *   /clients?notice=created  →  "Client created"
 *   /clients?notice=updated  →  "Client updated"
 *   /clients?notice=deleted  →  "Client deleted"
 *
 * The indicator vocabulary is the frozen closed enum below — ONLY the three
 * words. Unknown values never toast, and the observer strips the param from
 * the address bar immediately after firing, so refresh, back/forward replay,
 * and shared links cannot re-summon it. The browser receives exactly one
 * toast per completed mutation. IDs, emails, tokens, hashes and URLs never
 * appear in toast content; the wording comes only from the written copy you
 * configure below.
 */
export function FeatureNotice({
  entity,
  labels,
}: {
  entity: string;
  labels: NoticeLabels;
}) {
  const router = useRouter();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    if (typeof window === "undefined") return;

    const indicatorWord = (() => {
      const url = new URL(window.location.href);
      const candidate = url.searchParams.get("notice");
      return candidate === "created" || candidate === "updated" || candidate === "deleted"
        ? candidate
        : null;
    })();

    if (!indicatorWord) return;

    const message =
      indicatorWord === "created"
        ? labels.created
        : indicatorWord === "updated"
          ? labels.updated
          : labels.deleted;

    toast.success(message, {
      id: `${entity}:${indicatorWord}:${Date.now()}`,
    });

    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [router, entity, labels]);

  return null;
}
