"use client";

import Script from "next/script";
import { useEffect } from "react";

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID?.trim() || "";

export function FacebookSDK() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.fbAsyncInit = function () {
        console.log("[Salemate] fbAsyncInit triggered.");
        if (window.FB) {
          window.FB.init({
            appId: FB_APP_ID,
            cookie: true,
            xfbml: true,
            version: "v21.0",
          });
          console.log("[Salemate] FB.init successful.");
        }
      };

      if (window.FB) {
        window.fbAsyncInit();
      }
    }
  }, []);

  if (!FB_APP_ID) return null;

  return (
    <Script
      id="facebook-jssdk"
      src="https://connect.facebook.net/ko_KR/sdk.js"
      strategy="afterInteractive"
      onLoad={() => {
        console.log("[Salemate] Facebook SDK script loaded via next/script.");
      }}
      onError={(e) => {
        console.error("[Salemate] Facebook SDK script failed to load.", e);
      }}
    />
  );
}

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: Record<string, unknown>) => void;
      getLoginStatus: (
        callback: (response: { authResponse?: { accessToken: string } }) => void
      ) => void;
      login: (
        callback: (response: { authResponse?: { accessToken: string } }) => void,
        options?: Record<string, unknown>
      ) => void;
      api: (path: string, callback: (response: any) => void) => void;
    };
  }
}
