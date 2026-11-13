import { NextRequest, NextResponse } from "next/server";

/**
 * Password gate (HTTP Basic Auth) for every page and API route.
 *
 * Env vars:
 *   APP_PASSWORD  required in production; the app refuses to serve without it.
 *   APP_USERNAME  optional; defaults to "admin".
 *
 * In local development the gate is skipped when APP_PASSWORD is unset,
 * so `npm run dev` keeps working without extra setup.
 */
export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const username = process.env.APP_USERNAME || "admin";

  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("APP_PASSWORD is not configured.", { status: 503 });
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        const user = decoded.slice(0, sep);
        const pass = decoded.slice(sep + 1);
        // Evaluate both comparisons so timing doesn't reveal which one failed.
        const userOk = safeEqual(user, username);
        const passOk = safeEqual(pass, password);
        if (userOk && passOk) return NextResponse.next();
      }
    } catch {
      // Malformed base64: fall through to the 401 challenge.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Options Tracker", charset="UTF-8"' },
  });
}

/** Constant-time string comparison (Edge runtime has no crypto.timingSafeEqual). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const config = {
  // Everything except Next's static build assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
