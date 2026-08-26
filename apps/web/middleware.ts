import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateEnabled, tokenIsValid } from "./lib/gate";

/**
 * Left open on purpose:
 *  - /lock and /api/unlock, or there would be no way in
 *  - /mcp and /llms.txt, because an agent cannot fill in a password form, and
 *    both serve the same public asset index the repo already publishes
 */
const OPEN = ["/lock", "/api/unlock", "/mcp", "/llms.txt"];

export async function middleware(req: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (await tokenIsValid(req.cookies.get(GATE_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/lock";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
