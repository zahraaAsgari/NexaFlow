import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * Root metadata for NexaFlow.
 *
 * metadataBase is intentionally not set to a hardcoded domain: the real
 * production HTTPS URL is not yet known. Next.js requires metadataBase to
 * resolve relative Open Graph image URLs — until the production domain is
 * confirmed, OG images resolve relative to the request origin, which is
 * correct for preview deployments and does not publish a false canonical
 * URL. When the production domain is known, set:
 *
 *   metadataBase: new URL("https://your-production-domain.com")
 *
 * in this file. See docs/DEPLOYMENT.md for the full checklist.
 */
export const metadata: Metadata = {
  title: {
    default: "NexaFlow — Business operations workspace",
    template: "%s | NexaFlow",
  },
  description:
    "NexaFlow is a multi-tenant workspace for agencies and service teams to manage clients, projects, and tasks in one place.",
  applicationName: "NexaFlow",
  keywords: [
    "client management",
    "project management",
    "task tracking",
    "team collaboration",
    "business operations",
    "SaaS",
  ],
  authors: [{ name: "NexaFlow" }],
  creator: "NexaFlow",
  openGraph: {
    type: "website",
    siteName: "NexaFlow",
    title: "NexaFlow — Business operations workspace",
    description:
      "Manage clients, projects, and tasks with your team in a single multi-tenant workspace.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "NexaFlow — business operations workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NexaFlow — Business operations workspace",
    description:
      "Manage clients, projects, and tasks with your team in a single workspace.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
