import { KMITL_ISSUER } from "./domain";
export type AuthSettings = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  secret: string;
  origin: string;
  databaseUrl: string;
};
export function readAuthSettings(
  env: NodeJS.ProcessEnv = process.env,
): AuthSettings | null {
  const {
    AUTH_SECRET,
    AUTH_KEYCLOAK_ID,
    AUTH_KEYCLOAK_SECRET,
    DATABASE_URL,
    AUTH_URL,
  } = env;
  if (
    !AUTH_SECRET ||
    !AUTH_KEYCLOAK_ID ||
    !AUTH_KEYCLOAK_SECRET ||
    !DATABASE_URL ||
    !AUTH_URL
  )
    return null;
  if (AUTH_SECRET.length < 32) return null;
  if (env.AUTH_REDIRECT_PROXY_URL) return null;
  if (env.AUTH_KEYCLOAK_ISSUER && env.AUTH_KEYCLOAK_ISSUER !== KMITL_ISSUER)
    return null;
  try {
    const origin = new URL(AUTH_URL),
      db = new URL(DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(db.protocol)) return null;
    if (
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      origin.username ||
      origin.password
    )
      return null;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      origin.hostname,
    );
    if (
      origin.protocol !== "https:" &&
      !(
        env.NODE_ENV !== "production" &&
        loopback &&
        origin.protocol === "http:"
      )
    )
      return null;
    return {
      issuer: KMITL_ISSUER,
      clientId: AUTH_KEYCLOAK_ID,
      clientSecret: AUTH_KEYCLOAK_SECRET,
      secret: AUTH_SECRET,
      origin: origin.origin,
      databaseUrl: DATABASE_URL,
    };
  } catch {
    return null;
  }
}
/** Explicit fictional UI mode only. Even partial real credentials disable it. */
export function isFictionalPreview(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NODE_ENV === "development" &&
    env.ENABLE_UI_PREVIEW === "true" &&
    ![
      env.AUTH_SECRET,
      env.AUTH_KEYCLOAK_ID,
      env.AUTH_KEYCLOAK_SECRET,
      env.DATABASE_URL,
      env.DIRECT_DATABASE_URL,
    ].some(Boolean)
  );
}
