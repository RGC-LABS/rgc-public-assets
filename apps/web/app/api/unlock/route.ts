import { NextResponse } from "next/server";
import { GATE_COOKIE, GATE_TTL_MS, gateEnabled, issueToken, passwordMatches } from "../../../lib/gate";

export async function POST(req: Request) {
  if (!gateEnabled()) {
    return NextResponse.json({ ok: true, note: "No password configured." });
  }

  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown })?.password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  if (!(await passwordMatches(password))) {
    // Costs a brute-force attempt real time without needing a shared store.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false, error: "That password is not right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_TTL_MS / 1000,
  });
  return res;
}
