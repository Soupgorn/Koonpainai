import { TLSSocket } from "node:tls";
import { getRuntimePool, closeRuntimePools } from "./runtime-pool";

export const LIFECYCLE_KEY = Symbol.for("koonpinai.runtime.lifecycle.v1");
export function registerRuntimeLifecycle() {
  const hooks = {
    async ready() {
      const pool = getRuntimePool();
      const c = await pool.connect();
      try {
        const socket = c.connection.stream;
        if (!(socket instanceof TLSSocket) || !socket.authorized) throw new Error("DATABASE_TLS_UNVERIFIED");
        await c.query("BEGIN READ ONLY");
        try {
          await c.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'");
          const row = (await c.query("SELECT current_user AS role,session_user AS session,row_security_active('public.members') AS members_rls,row_security_active('public.application_sessions') AS sessions_rls")).rows[0];
          if (row.role !== "koonpinai_runtime" || row.session !== row.role || !row.members_rls || !row.sessions_rls)
            throw new Error("DATABASE_IDENTITY_OR_RLS_MISMATCH");
        } finally { await c.query("ROLLBACK"); }
      } finally { c.release(); }
    },
    close: closeRuntimePools,
  };
  Object.assign(globalThis, { [LIFECYCLE_KEY]: hooks });
}
