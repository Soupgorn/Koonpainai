import { z } from "zod";
import { EXPECTED_ENDPOINTS, KMITL_DISCOVERY } from "./domain";
const metadataSchema = z
  .object({
    issuer: z.string(),
    authorization_endpoint: z.string(),
    token_endpoint: z.string(),
    userinfo_endpoint: z.string(),
    end_session_endpoint: z.string(),
    jwks_uri: z.string(),
    response_types_supported: z.array(z.string()),
    code_challenge_methods_supported: z.array(z.string()),
    id_token_signing_alg_values_supported: z.array(z.string()),
    token_endpoint_auth_methods_supported: z.array(z.string()),
  })
  .passthrough();
export type Discovery = z.infer<typeof metadataSchema>;
export function validateDiscovery(value: unknown): Discovery {
  const metadata = metadataSchema.parse(value);
  for (const [key, expected] of Object.entries(EXPECTED_ENDPOINTS))
    if (metadata[key] !== expected)
      throw new Error("KMITL discovery endpoint mismatch");
  if (
    !metadata.code_challenge_methods_supported.includes("S256") ||
    !metadata.response_types_supported.includes("code")
  )
    throw new Error(
      "Required authorization code / PKCE S256 capability missing",
    );
  if (
    !metadata.token_endpoint_auth_methods_supported.includes(
      "client_secret_basic",
    ) ||
    !metadata.id_token_signing_alg_values_supported.includes("RS256")
  )
    throw new Error(
      "Required client authentication or signing capability missing",
    );
  return metadata;
}
/** Endpoint constants validate discovery; Auth.js still discovers its own endpoints. */
export function kmitlTransport(upstream: typeof fetch = fetch) {
  let cached: { metadata: Discovery; until: number } | undefined;
  const allowed = new Set<string>([
    KMITL_DISCOVERY,
    ...Object.values(EXPECTED_ENDPOINTS),
  ]);
  const transport: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!allowed.has(url)) throw new Error("OIDC request destination rejected");
    const response = await upstream(input, {
      ...init,
      redirect: "error",
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    });
    if (url === KMITL_DISCOVERY) {
      if (!response.ok) throw new Error("KMITL discovery unavailable");
      const text = await response.text();
      if (text.length > 100_000)
        throw new Error("KMITL discovery response too large");
      const metadata = validateDiscovery(JSON.parse(text));
      cached = { metadata, until: Date.now() + 300_000 };
      return Response.json(metadata);
    }
    return response;
  };
  async function discovery() {
    if (cached && cached.until > Date.now()) return cached.metadata;
    await transport(KMITL_DISCOVERY);
    return cached!.metadata;
  }
  return { fetch: transport, discovery };
}
