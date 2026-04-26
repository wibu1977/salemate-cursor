import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookies";

function supabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsAuth =
    pathname.startsWith("/dashboard") || pathname.startsWith("/connect-facebook");

  if (!needsAuth) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (supabaseConfigured()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // IMPORTANT: Do not use getUser() here if you want to avoid extra API calls.
    // getSession() is faster but less secure for sensitive operations.
    // However, for a middleware redirect check, getUser() is recommended.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return response;
    }

    /* Supabase chưa có session: cho phép JWT legacy (đăng nhập Facebook cũ) */
    const legacy = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    if (legacy) {
      return response;
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
    
    // Tránh redirect loop nếu đã ở trang login
    if (pathname === "/login") {
      return response;
    }

    return NextResponse.redirect(`${origin}/login?reason=no_session`);
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/login?reason=no_token`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/connect-facebook"],
};
