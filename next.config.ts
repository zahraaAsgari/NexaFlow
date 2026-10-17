import type { NextConfig } from "next";

/**
 * Production security headers.
 *
 * The values are tuned to THIS application — it serves self-hosted styles, the
 * built-in Tailwind bundle, system font stacks, inline SVG icons, and loads no
 * third-party scripts, fonts, images, analytics, or tracking. `unsafe-inline`
 * is required for Next.js RSC hydration scripts and the Tailwind `<style>`
 * bundles; everything else is kept to `self`.
 */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders: { key: string; value: string }[] = [
  // Base hardening.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Clickjacking: the app is a SaaS dashboard, never embedded in frames.
  { key: "X-Frame-Options", value: "DENY" },
  // Conservative, app-shaped CSP. Verified to not break hydration or styles.
  // In development, React's dev build uses new Function() for component stack
  // traces and the error overlay. 'unsafe-eval' is added in development only so
  // those debugging features work. Production CSP is unchanged — 'unsafe-eval'
  // is absent in production builds.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Do not advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
