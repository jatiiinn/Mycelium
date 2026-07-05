import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, passcodeHash } from "@/lib/auth";

const NINETY_DAYS = 60 * 60 * 24 * 90;

export async function POST(req: NextRequest) {
  let body: { passcode?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* fall through to error below */
  }

  const expected = process.env.MYCELIUM_PASSCODE;
  if (!expected) {
    return NextResponse.json(
      { error: "MYCELIUM_PASSCODE is not configured on the server." },
      { status: 500 }
    );
  }

  if (!body.passcode || body.passcode !== expected) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await passcodeHash(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: NINETY_DAYS,
  });
  return res;
}
