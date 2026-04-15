"use client";

import { useEffect } from "react";

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";

export function FacebookSDK() {
  useEffect(() => {
    if (typeof window === "undefined" || !FB_APP_ID) return;
    if (document.getElementById("facebook-jssdk")) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: FB_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      });
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return null;
}

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB: {
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
