"use client";

import { useEffect } from "react";

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID?.trim() || "";

export function FacebookSDK() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!FB_APP_ID) {
      console.warn(
        "[Salemate] NEXT_PUBLIC_META_APP_ID chưa set — Facebook SDK sẽ không tải. Thêm biến trên Railway/Vercel và rebuild frontend."
      );
      return;
    }
    if (document.getElementById("facebook-jssdk")) return;

    window.fbAsyncInit = function () {
      console.log("[Salemate] fbAsyncInit triggered.");
      const fb = window.FB;
      if (fb) {
        fb.init({
          appId: FB_APP_ID,
          cookie: true,
          xfbml: true,
          version: "v21.0",
        });
        console.log("[Salemate] FB.init successful.");
      } else {
        console.error("[Salemate] window.FB is missing inside fbAsyncInit!");
      }
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onload = () => console.log("[Salemate] Facebook SDK script loaded.");
    script.onerror = (e) => console.error("[Salemate] Facebook SDK script failed to load.", e);
    document.head.appendChild(script);
  }, []);

  return null;
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
    };
  }
}
