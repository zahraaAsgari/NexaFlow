import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAuth } from "@/server/auth";
import { signupAction, type AuthFormState } from "@/server/actions/auth";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentAuth()) redirect("/dashboard");

  const initialState: AuthFormState = { status: "idle" };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          NexaFlow
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Create your workspace
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your account and your first organization in one step.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <SignupForm action={signupAction} initialState={initialState} />
      </div>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
