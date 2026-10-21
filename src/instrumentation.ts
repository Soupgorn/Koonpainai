export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.KOONPINAI_MANAGED_RUNTIME === "1") {
    if (Object.keys(process.env).some(k => /^(MIGRATION_|DIRECT_DATABASE_|PG|SUPABASE_.*KEY)/i.test(k) && process.env[k]))
      throw new Error("OPERATIONAL_SECRET_IN_RUNTIME");
    const { registerRuntimeLifecycle } = await import("./db/runtime-lifecycle");
    registerRuntimeLifecycle();
  }
}
