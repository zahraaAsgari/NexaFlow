/**
 * Server-internal failure category used to fail closed (APP-LEVEL context
 * failures redirect to /login instead of being returned as data), while
 * keeping Next.js redirect()/notFound() control flow untouched.
 */
export class AppError extends Error {
  readonly code:
    | "unauthenticated"
    | "forbidden"
    | "conflict"
    | "validation"
    | "internal";

  constructor(
    code: AppError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
