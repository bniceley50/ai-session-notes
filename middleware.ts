import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/auth/session";

const PUBLIC_PREFIXES = ["/api/auth", "/_next"];
const PUBLIC_PATHS = ["/login", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/api/health"];
const PUBLIC_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".gif",
  ".webp",
  ".ico",
  ".css",
  ".js",
  ".map",
  ".txt",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
];

export const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
};

export async function middleware(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await readSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
