/**
 * Origin dùng cho Supabase OAuth + magic link (redirectTo / emailRedirectTo).
 * Mặc định: tab hiện tại. Nếu Supabase/Google vẫn đưa về domain dashboard cũ,
 * đặt NEXT_PUBLIC_AUTH_REDIRECT_ORIGIN = URL dashboard mới (https, không / cuối)
 * và cập nhật Supabase → Authentication → URL (Site URL + Redirect URLs).
 */
export function getAuthRedirectOrigin(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = process.env.NEXT_PUBLIC_AUTH_REDIRECT_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return window.location.origin;
}
