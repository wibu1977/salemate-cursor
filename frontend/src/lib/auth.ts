import {
  AUTH_TOKEN_COOKIE,
  AUTH_WORKSPACE_COOKIE,
  AUTH_COOKIE_MAX_AGE_SEC,
} from "@/lib/auth-cookies";

function cookieAttrs(maxAgeSec: number): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  return `Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function setBrowserCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; ${cookieAttrs(maxAgeSec)}`;
}

function deleteBrowserCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return readBrowserCookie(AUTH_TOKEN_COOKIE);
}

export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return readBrowserCookie(AUTH_WORKSPACE_COOKIE);
}

export function setAuth(token: string, workspaceId: string) {
  setBrowserCookie(AUTH_TOKEN_COOKIE, token, AUTH_COOKIE_MAX_AGE_SEC);
  setBrowserCookie(AUTH_WORKSPACE_COOKIE, workspaceId, AUTH_COOKIE_MAX_AGE_SEC);
}

export function clearAuth() {
  deleteBrowserCookie(AUTH_TOKEN_COOKIE);
  deleteBrowserCookie(AUTH_WORKSPACE_COOKIE);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
