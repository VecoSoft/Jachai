import { ApiClientError } from "./api";
import { dictionary } from "./i18n";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The machine-readable code of an API error (V70 auth: EMAIL_NOT_VERIFIED, CODE_INVALID, ...), if any. */
export function errorCode(err: unknown): string | undefined {
  return err instanceof ApiClientError ? err.body?.code : undefined;
}

/**
 * The message to show for an auth/account API error, in the user's language: a translated text
 * for every known code (with attempts left / minutes filled in), else the server's own message.
 */
export function authErrorText(err: unknown, t: Translate): string {
  const code = errorCode(err);
  if (code && dictionary.en[`auth.err.${code}`] !== undefined) {
    const body = err instanceof ApiClientError ? err.body : null;
    return t(`auth.err.${code}`, {
      n: body?.attemptsLeft ?? 0,
      minutes: Math.max(1, Math.ceil((body?.retryAfterSeconds ?? 60) / 60)),
    });
  }
  if (err instanceof Error && err.message) return err.message;
  return t("auth.err.generic");
}
