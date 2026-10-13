import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAuth } from "@/server/auth";
import { loginAction, type AuthFormState } from "@/server/actions/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already authenticated users have no business on the login page.
  if (await getCurrentAuth()) redirect("/dashboard");

  const initialState: AuthFormState = { status: "idle" };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          NexaFlow
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in to your workspace.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <LoginForm action={loginAction} initialState={initialState} />
      </div>

      <p className="text-center text-sm text-slate-600">
        <Link
          href="/forgot-password"
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Forgot your password?
        </Link>
      </p>

      <p className="text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
