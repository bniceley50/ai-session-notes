type AuthConfig = {
  cognitoDomain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  logoutUri: string;
  cookieSecret: string;
  defaultPracticeId: string;
  sessionTtlSeconds: number;
};

const readEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const readNumber = (key: string): number => {
  const raw = readEnv(key);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric env var: ${key}`);
  }
  return value;
};

const normalizeDomain = (domain: string): string => domain.replace(/\/+$/, "");

export const authConfig: AuthConfig = {
  cognitoDomain: normalizeDomain(readEnv("COGNITO_DOMAIN")),
  clientId: readEnv("COGNITO_CLIENT_ID"),
  clientSecret: readEnv("COGNITO_CLIENT_SECRET"),
  redirectUri: readEnv("COGNITO_REDIRECT_URI"),
  logoutUri: readEnv("COGNITO_LOGOUT_URI"),
  cookieSecret: readEnv("AUTH_COOKIE_SECRET"),
  defaultPracticeId: readEnv("DEFAULT_PRACTICE_ID"),
  sessionTtlSeconds: readNumber("SESSION_TTL_SECONDS"),
};
