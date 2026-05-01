import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Proxy same-origin /api/* → backend (runtime env).
 * Railway: đặt BACKEND_INTERNAL_URL=https://...backend... (service Variables, không cần rebuild khi đổi).
 * Tránh next.config rewrites bị bake localhost:8000 nếu thiếu env lúc next build.
 */
function backendBase(): string {
  const raw = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  ).replace(/\/$/, "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return "http://127.0.0.1:8000";
}

function isHopByHopHeader(name: string): boolean {
  const h = name.toLowerCase();
  return (
    h === "connection" ||
    h === "keep-alive" ||
    h === "proxy-authenticate" ||
    h === "proxy-authorization" ||
    h === "te" ||
    h === "trailers" ||
    h === "transfer-encoding" ||
    h === "upgrade" ||
    h === "host"
  );
}

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const segments = pathSegments ?? [];
  const path = segments.join("/");
  const backend = backendBase();
  const url = new URL(req.url);
  const target = `${backend}/${path}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (isHopByHopHeader(key)) return;
    headers.set(key, value);
  });

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (e) {
    console.error("[api proxy] upstream fetch failed:", target, e);
    const hint =
      "Kiểm tra service Frontend trên Railway: biến BACKEND_INTERNAL_URL = URL HTTPS của service Backend " +
      "(ví dụ https://xxx.up.railway.app, không có / ở cuối). Redeploy frontend sau khi thêm biến.";
    return NextResponse.json(
      {
        detail: {
          error: "proxy_unreachable",
          message: `Không kết nối được backend (${backend}). ${hint}`,
        },
      },
      { status: 502 }
    );
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (isHopByHopHeader(key)) return;
    outHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
