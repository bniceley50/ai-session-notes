import { SignJWT, jwtVerify } from "jose";
import {
  authCookieSecret,
  sessionTtlSeconds,
  isProduction as envIsProduction,
} from "@/lib/config";

export const SESSION_COOKIE_NAME = "asn_session";

export type SessionRole = "clinician" | "admin";

export type SessionInput = {
  sub: string;
  email?: string;
  practiceId: string;
  role: SessionRole;
};

export type SessionPayload = SessionInput & {
  iat: number;
  exp: number;
};

export type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  secure: boolean;
  maxAge: number;
};

const encoder = new TextEncoder();

const readCookieSecret = (): Uint8Array | null => {
  try {
    return encoder.encode(authCookieSecret());
  } catch {
    return null;
  }
};

const requireCookieSecret = (): Uint8Array => {
  return encoder.encode(authCookieSecret());
};

const readSessionTtlSeconds = (): number => {
  return sessionTtlSeconds();
};

const getCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const raw = rest.join("=");
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
};

const serializeCookie = (cookie: { name: string; value: string; options: CookieOptions }): string => {
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Max-Age=${cookie.options.maxAge}`,
    `Path=${cookie.options.path}`,
    `SameSite=${cookie.options.sameSite}`,
  ];
  if (cookie.options.httpOnly) parts.push("HttpOnly");
  if (cookie.options.secure) parts.push("Secure");
  return parts.join("; ");
};

const toSessionPayload = (payload: Record<string, unknown>): SessionPayload | null => {
  if (typeof payload.sub !== "string") return null;
  if (typeof payload.practiceId !== "string") return null;
  if (typeof payload.role !== "string") return null;
  if (typeof payload.iat !== "number") return null;
  if (typeof payload.exp !== "number") return null;

  const role = payload.role;
  if (role !== "clinician" && role !== "admin") return null;

  const email = typeof payload.email === "string" ? payload.email : undefined;

  return {
    sub: payload.sub,
    email,
    practiceId: payload.practiceId,
    role,
    iat: payload.iat,
    exp: payload.exp,
  };
};

export const createSessionCookie = async (session: SessionInput): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = readSessionTtlSeconds();
  const exp = now + ttl;
  const secret = requireCookieSecret();

  const token = await new SignJWT({
    sub: session.sub,
    email: session.email,
    practiceId: session.practiceId,
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);

  return serializeCookie({
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: envIsProduction(),
      maxAge: ttl,
    },
  });
};

export const clearSessionCookie = (): string =>
  serializeCookie({
    name: SESSION_COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: envIsProduction(),
      maxAge: 0,
    },
  });

export const readSessionFromCookieHeader = async (
  cookieHeader: string | null,
): Promise<SessionPayload | null> => {
  const token = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) return null;

  const secret = readCookieSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return toSessionPayload(payload as Record<string, unknown>);
  } catch {
    return null;
  }
};