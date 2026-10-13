import type { MetadataRoute } from "next";

/**
 * sitemap.xml — contains ONLY the public-facing routes.
 *
 * Private application routes (dashboard, clients, projects, tasks, team,
 * settings, account) are never listed here. Token-based routes (password
 * reset, email verification, invitation acceptance) are excluded because
 * they contain per-user secrets and should never be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "/",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "/signup",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "/login",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
