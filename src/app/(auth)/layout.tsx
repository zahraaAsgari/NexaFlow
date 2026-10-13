import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Authentication routes are noindex to prevent search engines from indexing
 * login, signup, password reset, and email verification pages.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
