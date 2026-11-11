/**
 * web-push 4 is ESM and ships no types, and @types/web-push only covers 3.x (the latest is 3.6.4), so the
 * mismatch is replaced by this declaration of the only function we call (src/lib/push/sender.ts, loaded lazily).
 */
declare module "web-push" {
  export function sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string | Buffer | null,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}
