import type { MetadataRoute } from "next";

/**
 * robots.txt — allows indexing of public pages only.
 *
 * Private application routes (dashboard, clients, projects, tasks, team,
 * settings, account) and all token-based routes (password reset, email
 * verification, invitation acceptance) are excluded via noindex metadata on
 * those route segments, NOT by listing them here — this keeps the disallow
 * list small and avoids accidentally leaking private route paths.
 *
 * The single disallow rule below prevents crawling of the Next.js internal
 * build output and the API endpoint (which returns JSON, not content).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
  };
}
