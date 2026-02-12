import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import {
  createSessionCookie,
  readSessionFromCookieHeader,
  SESSION_COOKIE_NAME,
  type SessionInput,
} from "@/lib/auth/session";

const TEST_SECRET = process.env.AUTH_COOKIE_SECRET!;
const encoder = new TextEncoder();

const aliceSession: SessionInput = {
  sub: "user-alice",
  email: "alice@test.com",
  practiceId: "practice-test",
  role: "clinician",
};

// ---------------------------------------------------------------------------
// JWT round-trip: sign → cookie string → parse → matching payload
// ---------------------------------------------------------------------------

test("sign/verify JWT round-trip returns matching payload", async () => {
  const setCookie = await createSessionCookie(aliceSession);

  // Extract "asn_session=<token>" from the full Set-Cookie header
  const nameValue = setCookie.split(";")[0];
  assert.ok(nameValue.startsWith(`${SESSION_COOKIE_NAME}=`), "cookie has correct name");

  const payload = await readSessionFromCookieHeader(nameValue);
  assert.ok(payload, "payload should not be null");
  assert.equal(payload.sub, aliceSession.sub);
  assert.equal(payload.email, aliceSession.email);
  assert.equal(payload.practiceId, aliceSession.practiceId);
  assert.equal(payload.role, aliceSession.role);
  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.exp, "number");
  assert.ok(payload.exp > payload.iat, "exp must be after iat");
});

// ---------------------------------------------------------------------------
// Expired JWT → null
// ---------------------------------------------------------------------------

test("expired JWT is rejected (returns null)", async () => {
  const secret = encoder.encode(TEST_SECRET);
  const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago

  const token = await new SignJWT({
    sub: aliceSession.sub,
    email: aliceSession.email,
    practiceId: aliceSession.practiceId,
    role: aliceSession.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(pastExp - 3600)
    .setExpirationTime(pastExp)
    .sign(secret);

  const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;
  const payload = await readSessionFromCookieHeader(cookieHeader);
  assert.equal(payload, null, "expired token must return null");
});

// ---------------------------------------------------------------------------
// Missing cookie → null (not crash)
// ---------------------------------------------------------------------------

test("null cookie header returns null", async () => {
  const payload = await readSessionFromCookieHeader(null);
  assert.equal(payload, null);
});

test("empty cookie header returns null", async () => {
  const payload = await readSessionFromCookieHeader("");
  assert.equal(payload, null);
});

// ---------------------------------------------------------------------------
// Garbage token → null (not crash)
// ---------------------------------------------------------------------------

test("garbage token returns null (not throw)", async () => {
  const cookieHeader = `${SESSION_COOKIE_NAME}=not-a-real-jwt`;
  const payload = await readSessionFromCookieHeader(cookieHeader);
  assert.equal(payload, null);
});

// ---------------------------------------------------------------------------
// Wrong secret → null
// ---------------------------------------------------------------------------

test("token signed with wrong secret is rejected", async () => {
  const wrongSecret = encoder.encode("wrong-secret-that-doesnt-match!!");
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    sub: "user-evil",
    practiceId: "practice-test",
    role: "clinician",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(wrongSecret);

  const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;
  const payload = await readSessionFromCookieHeader(cookieHeader);
  assert.equal(payload, null, "wrong-secret token must return null");
});

// ---------------------------------------------------------------------------
// Malformed claims → null (toSessionPayload rejects empty / invalid claims)
// ---------------------------------------------------------------------------

const signMalformed = async (claims: Record<string, unknown>): Promise<string> => {
  const secret = encoder.encode(TEST_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(secret);
  return `${SESSION_COOKIE_NAME}=${token}`;
};

test("empty sub claim → null", async () => {
  const cookie = await signMalformed({ sub: "", practiceId: "p", role: "clinician" });
  const payload = await readSessionFromCookieHeader(cookie);
  assert.equal(payload, null, "empty sub must be rejected");
});

test("empty practiceId claim → null", async () => {
  const cookie = await signMalformed({ sub: "user-1", practiceId: "", role: "clinician" });
  const payload = await readSessionFromCookieHeader(cookie);
  assert.equal(payload, null, "empty practiceId must be rejected");
});

test("missing practiceId claim → null", async () => {
  const cookie = await signMalformed({ sub: "user-1", role: "clinician" });
  const payload = await readSessionFromCookieHeader(cookie);
  assert.equal(payload, null, "missing practiceId must be rejected");
});

test("invalid role claim → null", async () => {
  const cookie = await signMalformed({ sub: "user-1", practiceId: "p", role: "superadmin" });
  const payload = await readSessionFromCookieHeader(cookie);
  assert.equal(payload, null, "invalid role must be rejected");
});

test("missing role claim → null", async () => {
  const cookie = await signMalformed({ sub: "user-1", practiceId: "p" });
  const payload = await readSessionFromCookieHeader(cookie);
  assert.equal(payload, null, "missing role must be rejected");
});

test("missing sub claim → null", async () => {
  const cookie = await signMalformed({ practiceId: "p", role: "clinician" });
  const payload = await readSessionFromCookieHeader(cookie);
  assert.equal(payload, null, "missing sub must be rejected");
});
