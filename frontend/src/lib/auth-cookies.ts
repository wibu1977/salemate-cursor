/** Cookie names + TTL shared by client `auth.ts` and Edge `middleware.ts` (no `window`). */
export const AUTH_TOKEN_COOKIE = "salemate_token";
export const AUTH_WORKSPACE_COOKIE = "workspace_id";
/** 7 days */
export const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
