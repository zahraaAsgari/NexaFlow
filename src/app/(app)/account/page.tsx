import { requireAuth } from "@/server/auth";
import { getAccountEmailState } from "@/server/data/account";
import { Icon } from "@/components/icons";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AboutEmailSecurityCardFooter, EmailSection } from "./email-section";
import { AccountPasswordForm } from "./password-form";
import { AccountProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Account / Profile. Personal identity belongs to the authenticated USER — not
 * the active organization — so this page resolves `requireAuth()` (user from
 * the trusted session, never a URL param or form field). Organization, client
 * and membership data are deliberately never touched here.
 */
export default async function AccountPage() {
  const auth = await requireAuth();
  const emailState = await getAccountEmailState(auth);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal information and password. These changes apply to
          your NexaFlow account, not to your organization.
        </p>
      </header>

      {/* Identity strip — safe display only; no password hash or tokens. */}
      <Card className="flex items-center gap-4 p-5">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-base font-semibold text-indigo-600"
        >
          {initials(auth.user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">
            {auth.user.name}
          </p>
          <p className="truncate text-sm text-slate-500">{auth.user.email}</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Profile"
          description="How your name appears across NexaFlow."
        />
        <CardContent>
          <AccountProfileForm defaults={{ name: auth.user.name }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Email"
          description="Your sign-in address, verification state, and change-email flow."
        />
        <CardContent>
          <EmailSection
            email={emailState.email}
            verified={emailState.emailVerifiedAt !== null}
            pendingNewEmail={emailState.pendingChange?.newEmail ?? null}
          />
        </CardContent>
        <AboutEmailSecurityCardFooter />
      </Card>

      <Card>
        <CardHeader
          title="Password & security"
          description="Change the password for this account. Other sign-ins are ended when your password changes."
        />
        <CardContent>
          <AccountPasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="About these settings" />
        <CardContent>
          <p className="text-sm text-slate-600">
            Your name applies immediately. Email verification proves control of the
            address associated with your account; changing your email sends a
            verification link to the new address, which must be confirmed before
            it replaces your current email, and your current email stays active
            until then. Changing your password keeps you signed in here but ends
            every other session on your other devices as a security measure. We
            never store or display your password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
