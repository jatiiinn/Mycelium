import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, passcodeHash } from "@/lib/auth";

// Routes that must remain reachable without the passcode cookie:
// - /unlock       : the passcode page itself
// - /api/auth     : where the passcode form posts
// - /api/sync     : protected separately by CRON_SECRET (Vercel cron / worker ping)
const PUBLIC_PREFIXES = ["/unlock", "/api/auth", "/api/sync"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const passcode = process.env.MYCELIUM_PASSCODE;

  if (passcode && cookie && cookie === (await passcodeHash(passcode))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
