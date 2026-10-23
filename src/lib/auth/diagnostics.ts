import { AuthError } from "next-auth";
import { databaseErrorCode } from "../../db/connection";

const errorTypes = new Set([
  "AccessDenied", "CallbackRouteError", "Configuration", "InvalidCheck",
  "JWTSessionError", "MissingCSRF", "OAuthCallbackError", "OAuthSignInError",
  "SessionTokenError",
]);

/** Emit allowlisted identifiers only. Auth.js wraps driver errors in cause.err. */
export function authFailureDetails(error: Error) {
  const authError = error instanceof AuthError ? error : undefined;
  const code = databaseErrorCode(authError?.cause?.err ?? error);
  return {
    event: "AUTH_FAILED",
    type: authError && errorTypes.has(authError.type)
      ? authError.type : "AuthenticationError",
    code: code === "DATABASE_OPERATION_FAILED" ? "UNCLASSIFIED" : code,
  };
}
