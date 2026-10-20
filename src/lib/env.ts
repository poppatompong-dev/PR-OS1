// Centralized environment access for PR-OS.
// While Supabase keys are still placeholders, `isSupabaseConfigured()` returns
// false and the app keeps running on mock data (no auth, no network calls).

const PLACEHOLDER_URL = "https://example.supabase.co";
const PLACEHOLDER_ANON = "replace-with-anon-key";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  // Links inside LINE messages and the LINE Login callback are built from this.
  // On Vercel, fall back to the project's production domain (a system
  // variable Vercel always sets) so a missing APP_BASE_URL cannot send people
  // to localhost.
  appBaseUrl:
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  // LINE Login: OAuth channel used only to let a staff member link their own
  // LINE account (captures line_user_id). Separate from the Messaging API
  // channel below, which is used to actually push notification text.
  lineLoginChannelId: (process.env.LINE_LOGIN_CHANNEL_ID ?? "").trim(),
  lineLoginChannelSecret: (process.env.LINE_LOGIN_CHANNEL_SECRET ?? "").trim(),
  // LINE Messaging API: long-lived channel access token used to push
  // notification messages to a linked line_user_id.
  lineMessagingChannelAccessToken: (process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ?? "").trim(),
  // Messaging API channel secret: verifies the x-line-signature header on
  // every webhook call, so only LINE itself can drive the bot.
  lineMessagingChannelSecret: (process.env.LINE_MESSAGING_CHANNEL_SECRET ?? "").trim(),
  // Email fallback via Resend.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "PR-OS <onboarding@resend.dev>",
  // Shared secret required in the `x-notifications-secret` header when an
  // external cron (pg_cron/pg_net) calls /api/notifications/process.
  notificationsCronSecret: process.env.NOTIFICATIONS_CRON_SECRET ?? "",
};

/**
 * True only when real Supabase credentials are present. Used as the master
 * switch that flips the app from "mock prototype" to "live backend".
 */
export function isSupabaseConfigured(): boolean {
  return (
    env.supabaseUrl.length > 0 &&
    env.supabaseUrl !== PLACEHOLDER_URL &&
    env.supabaseAnonKey.length > 0 &&
    env.supabaseAnonKey !== PLACEHOLDER_ANON
  );
}

export function isLineLoginConfigured(): boolean {
  return env.lineLoginChannelId.length > 0 && env.lineLoginChannelSecret.length > 0;
}

export function isLineMessagingConfigured(): boolean {
  return env.lineMessagingChannelAccessToken.length > 0;
}

export function isLineWebhookConfigured(): boolean {
  return isLineMessagingConfigured() && env.lineMessagingChannelSecret.length > 0;
}

export function isEmailConfigured(): boolean {
  return env.resendApiKey.length > 0;
}
