import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** null nếu chưa cấu hình NEXT_PUBLIC_SUPABASE_* hoặc đang SSR. */
export function getBrowserSupabase(): ReturnType<typeof createBrowserClient> | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (!client) {
    client = createBrowserClient(url, key);
  }
  return client;
}

export function isSupabaseAuthConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
