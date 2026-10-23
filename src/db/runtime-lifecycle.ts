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
          const security = (await c.query("SELECT r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=r.oid) OR has_schema_privilege(current_user,'public','CREATE') OR has_column_privilege(current_user,'public.members','role','UPDATE') AS unsafe FROM pg_roles r WHERE r.rolname=current_user")).rows[0];
          if (!security || security.unsafe) throw new Error("DATABASE_RUNTIME_PRIVILEGES_UNSAFE");
          // The runtime cannot read the migration ledger. Operator preflight
          // verifies it; startup independently requires usable, forced-RLS
          // timetable relations before admitting traffic.
          const timetable = (await c.query("SELECT count(*)=2 AND bool_and(cl.relrowsecurity AND cl.relforcerowsecurity AND cl.relowner<>current_user::regrole AND has_table_privilege(current_user,cl.oid,'SELECT') AND has_table_privilege(current_user,cl.oid,'INSERT') AND NOT has_table_privilege(current_user,cl.oid,'TRUNCATE')) AS ready FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND cl.relname IN('student_timetables','timetable_entries') AND cl.relkind='r'")).rows[0];
          if (!timetable?.ready) throw new Error("DATABASE_TIMETABLE_SCHEMA_UNREADY");
        } finally { await c.query("ROLLBACK"); }
      } finally { c.release(); }
    },
    close: closeRuntimePools,
  };
  Object.assign(globalThis, { [LIFECYCLE_KEY]: hooks });
}
