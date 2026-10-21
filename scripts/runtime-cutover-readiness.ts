// Capacity planning helpers. The actual artifact launcher is runtime/launch.mjs.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { connectionMode } from "../src/db/connection";

/** Run before Next.js can load dotenv. A separate clean runtime bundle is required. */
export function assertNoRuntimeDotenv(root: string) {
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local", ".env.development", ".env.development.local", ".env.test", ".env.test.local"])
    if (existsSync(join(root, name))) throw new Error("RUNTIME_DOTENV_FORBIDDEN");
}

/** An allowlist, never {...process.env}. Call only with an externally delivered secret.
 * This does not decrypt/export a secret or mutate the parent environment. */
export function runtimeOnlyEnvironment(source: Readonly<Record<string, string | undefined>>, runtimeUrl: string, caFile: string): NodeJS.ProcessEnv {
  if (source.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("GLOBAL_TLS_BYPASS_FORBIDDEN");
  let url: URL;
  try { url = new URL(runtimeUrl); } catch { throw new Error("RUNTIME_SECRET_INVALID"); }
  if (!/^postgres(ql)?:$/.test(url.protocol) || connectionMode(url) !== "session-pooler" || !/^koonpinai_runtime\.[a-z0-9]+$/.test(decodeURIComponent(url.username)) || !url.password || !caFile || url.hash || [...url.searchParams].some(([k,v]) => k !== "sslmode" || v !== "verify-full"))
    throw new Error("DEDICATED_SESSION_SECRET_REQUIRED");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const key of ["SystemRoot", "WINDIR", "PATH", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME", "LANG", "TZ", "AUTH_SECRET", "AUTH_KEYCLOAK_ID", "AUTH_KEYCLOAK_SECRET", "AUTH_KEYCLOAK_ISSUER", "AUTH_URL", "PORT", "HOSTNAME"])
    if (source[key] !== undefined) env[key] = source[key];
  return { ...env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: runtimeUrl, DATABASE_CA_FILE: caFile };
}

export interface CapacityInput {
  poolSize?: number;
  maxClients?: number;
  dbMax: number;
  reserved: number;
  otherBackendBudget: number;
  headroom: number;
  oldProcesses: number;
  newProcesses: number;
  canaryProcesses: number;
  operationalConnections: number;
  runtimePoolMax?: number;
  legacyPoolMax?: number;
  migrationConnections?: number;
  controlledRuntimeBackendBudget?: number;
}
export function assessCutoverCapacity(i: CapacityInput) {
  const values = Object.values(i);
  if (values.some(v => !Number.isInteger(v) || v < 0) || i.dbMax <= i.reserved) throw new Error("INVALID_CAPACITY_INPUT");
  const runtimeMax=i.runtimePoolMax??2, legacyMax=i.legacyPoolMax??5;
  if(runtimeMax<1||runtimeMax>2)throw new Error("RUNTIME_POOL_CAP_EXCEEDED");
  const dedicatedClients = runtimeMax * (i.newProcesses + i.canaryProcesses);
  const legacyClients = legacyMax * i.oldProcesses;
  const clientCeiling = dedicatedClients + legacyClients + i.operationalConnections + (i.migrationConnections??0);
  // Initial window has three distinct combinations: old postgres transaction,
  // postgres Session operator/fallback, and dedicated runtime Session. Reserve
  // their FULL caps until provider retention/role overrides are measured.
  const conservativeBackends = i.poolSize === undefined ? null : 3 * i.poolSize + i.otherBackendBudget + i.headroom;
  const controlledBackends = i.poolSize === undefined || i.controlledRuntimeBackendBudget === undefined ? null : 2*i.poolSize + i.controlledRuntimeBackendBudget + i.otherBackendBudget + i.headroom;
  const reasons: string[] = [];
  if (!i.poolSize || !i.maxClients) reasons.push("PROJECT_POOL_LIMITS_UNVERIFIED");
  if (i.poolSize !== undefined && dedicatedClients > i.poolSize) reasons.push("DEDICATED_SESSION_POOL_EXCEEDED");
  if (i.maxClients !== undefined && clientCeiling > i.maxClients) reasons.push("HOSTED_CLIENT_BUDGET_EXCEEDED");
  if (conservativeBackends !== null && conservativeBackends > i.dbMax - i.reserved) reasons.push("POSTGRES_BACKEND_BUDGET_EXCEEDED");
  const controlledReasons=reasons.filter(r=>r!=="POSTGRES_BACKEND_BUDGET_EXCEEDED");
  if(controlledBackends===null)controlledReasons.push("CONTROLLED_CONSUMER_BOUND_UNVERIFIED");
  if(controlledBackends!==null&&controlledBackends>i.dbMax-i.reserved)controlledReasons.push("CONTROLLED_BUDGET_EXCEEDED");
  if(i.controlledRuntimeBackendBudget!==undefined && (i.controlledRuntimeBackendBudget<dedicatedClients || (i.poolSize!==undefined&&i.controlledRuntimeBackendBudget>i.poolSize)))controlledReasons.push("INVALID_CONTROLLED_RUNTIME_BOUND");
  if(i.oldProcesses+i.newProcesses+i.canaryProcesses>2)controlledReasons.push("OVERLAPPING_PROCESS_LIMIT_EXCEEDED");
  if(i.migrationConnections)controlledReasons.push("MIGRATION_FREEZE_REQUIRED");
  return { decision: reasons.length ? "NO-GO" : "GO", controlledDecision:controlledReasons.length?"NO-GO":"CONDITIONAL-GO", dedicatedClients, legacyClients, clientCeiling, conservativeBackends,controlledBackends,reasons,controlledReasons };
}
