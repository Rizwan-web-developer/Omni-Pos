import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, getAuthSecret, verifySession } from "@/lib/auth/edge";

const PUBLIC_PATHS = ["/", "/login", "/signup"];
const PUBLIC_API = /^\/api\/(?:auth\/(?:login|logout|me|signup)|db-check|platform\/settings)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_API.test(pathname) || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  let session = null;
  try {
    session = await verifySession(token, getAuthSecret());
  } catch {
    session = null;
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isAdminRole = session.role === "SUPER_ADMIN" || session.role === "SUB_ADMIN";

  // Authenticated APIs: allow through (route handlers enforce fine-grained access)
  if (pathname.startsWith("/api/")) return NextResponse.next();

  if (isAdminRole) return NextResponse.next();

  // Tenant (business) users: restrict to their own store panel
  const tenantId = (session as { tenantId?: string | null }).tenantId || null;
  const storeMatch = pathname.match(/^\/store\/([^/]+)/);
  if (tenantId && storeMatch && storeMatch[1] === tenantId) return NextResponse.next();

  // Send tenant users to their own panel (or login if unbound)
  const url = request.nextUrl.clone();
  url.pathname = tenantId ? `/store/${tenantId}` : "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
