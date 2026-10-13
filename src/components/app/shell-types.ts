import type { OrganizationRole } from "@/server/auth";

/**
 * Serializable view models for the application shell. These are deliberately
 * narrow, client-safe projections of the server `AuthContext` — they carry no
 * identifiers beyond the organization ids the switcher must submit (the server
 * re-verifies membership on every switch), and never any secret.
 */
export type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

export type ViewerInfo = {
  name: string;
  email: string;
  role: OrganizationRole;
  organizationName: string;
};
