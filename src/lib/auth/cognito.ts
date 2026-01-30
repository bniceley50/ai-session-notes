import { createRemoteJWKSet, jwtVerify } from "jose";
import { authConfig } from "./config";

type OidcDiscovery = {
  issuer: string;
  jwks_uri: string;
};

let discoveryPromise: Promise<OidcDiscovery> | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getDiscovery = async (): Promise<OidcDiscovery> => {
  if (!discoveryPromise) {
    const url = new URL("/.well-known/openid-configuration", authConfig.cognitoDomain);
    discoveryPromise = fetch(url.toString()).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load Cognito OIDC discovery document");
      }
      const json = (await response.json()) as OidcDiscovery;
      if (!json.issuer || !json.jwks_uri) {
        throw new Error("Cognito OIDC discovery document missing fields");
      }
      return json;
    });
  }
  return discoveryPromise;
};

const getJwks = async () => {
  if (!jwks) {
    const discovery = await getDiscovery();
    jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
  }
  return jwks;
};

export const buildAuthorizeUrl = (state: string): string => {
  const url = new URL("/oauth2/authorize", authConfig.cognitoDomain);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", authConfig.clientId);
  url.searchParams.set("redirect_uri", authConfig.redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  return url.toString();
};

export const buildLogoutUrl = (): string => {
  const url = new URL("/logout", authConfig.cognitoDomain);
  url.searchParams.set("client_id", authConfig.clientId);
  url.searchParams.set("logout_uri", authConfig.logoutUri);
  return url.toString();
};

export const exchangeCodeForTokens = async (
  code: string,
): Promise<{ idToken: string; accessToken?: string; refreshToken?: string }> => {
  const url = new URL("/oauth2/token", authConfig.cognitoDomain);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    code,
  });

  const auth = Buffer.from(
    `${authConfig.clientId}:${authConfig.clientSecret}`,
  ).toString("base64");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Cognito token exchange failed");
  }

  const json = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!json.id_token) {
    throw new Error("Cognito token response missing id_token");
  }

  return {
    idToken: json.id_token,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
  };
};

export const verifyIdToken = async (
  idToken: string,
): Promise<{ sub: string; email?: string }> => {
  const discovery = await getDiscovery();
  const jwkSet = await getJwks();

  const { payload } = await jwtVerify(idToken, jwkSet, {
    issuer: discovery.issuer,
    audience: authConfig.clientId,
  });

  if (typeof payload.sub !== "string") {
    throw new Error("id_token missing sub claim");
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;
  return { sub: payload.sub, email };
};
