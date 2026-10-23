import { Pool, type PoolConfig } from 'pg';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export const FIXTURE_APPLICATION = 'koonpinai-rehearsal-fixture';
const RUNTIME_APPLICATION = 'koonpinai-runtime';
export type RuntimeSession = {
  pid: number; backendStart: string; role: string; applicationName: string;
  state: string | null; waitingForLock: boolean; observer: boolean;
};
export type SessionEvidence = {
  remainingCount: number; fixtureCount: number; observerCount: number;
  sessions: { pid: number; role: string; applicationName: string; state: string }[];
};
const identity = (s: RuntimeSession) => JSON.stringify([s.pid, s.backendStart]);
const states = new Set(['active', 'idle', 'idle in transaction', 'idle in transaction (aborted)', 'disabled', 'fastpath function call']);
export function sessionEvidence(sessions: RuntimeSession[], fixtures: RuntimeSession[]): SessionEvidence {
  return {
    remainingCount: sessions.length, fixtureCount: fixtures.filter(s => !s.observer).length,
    observerCount: fixtures.filter(s => s.observer).length,
    sessions: sessions.slice(0, 8).map(s => ({
      pid: Number.isSafeInteger(s.pid) && s.pid > 0 ? s.pid : 0,
      role: s.role === 'koonpinai_runtime' ? s.role : 'unexpected',
      applicationName: [RUNTIME_APPLICATION, FIXTURE_APPLICATION].includes(s.applicationName) ? s.applicationName : 'unexpected',
      state: s.state && states.has(s.state) ? s.state : 'unknown',
    })),
  };
}
export class RuntimeSessionsRemain extends Error {
  readonly code = 'RUNTIME_SESSIONS_REMAIN';
  constructor(readonly sessions: SessionEvidence) { super('RUNTIME_SESSIONS_REMAIN'); }
}
/** Pool.query uses an autocommit observation, never the held control transaction's snapshot. */
export async function readRuntimeSessions(owner: Pool): Promise<RuntimeSession[]> {
  const query = {
    text: `SELECT pid, backend_start::text AS "backendStart", usename AS role,
      application_name AS "applicationName", state,
      coalesce(wait_event_type='Lock',false) AS "waitingForLock", pid=pg_backend_pid() AS observer
      FROM pg_stat_activity WHERE datname=current_database() AND usename='koonpinai_runtime'
      ORDER BY pid`,
    query_timeout: 1000,
  };
  return (await owner.query<RuntimeSession>(query)).rows;
}
/** Exempt only fixture backends seen before launch, identified by PID AND exact start time.
 * A new/reused PID or a runtime that changes its application_name is never exempted.
 */
export async function observeRuntimeSessions(read: () => Promise<RuntimeSession[]>) {
  const baseline = await read();
  assert.ok(baseline.every(s => s.observer || s.applicationName === FIXTURE_APPLICATION), 'RUNTIME_SESSION_BASELINE_UNEXPECTED');
  const fixtures = new Set(baseline.filter(s => !s.observer).map(identity));
  const owned = (sessions: RuntimeSession[]) => sessions.filter(s => !s.observer && !fixtures.has(identity(s)));
  let capturedCount = 0;
  return {
    owned,
    async capture() {
      const sessions = owned(await read());
      assert.ok(sessions.length > 0, 'RUNTIME_SESSIONS_NOT_OBSERVED');
      assert.ok(sessions.every(s => s.applicationName === RUNTIME_APPLICATION), 'RUNTIME_SESSION_IDENTITY_UNEXPECTED');
      capturedCount = sessions.length;
      return sessions;
    },
    async waitForLock(timeoutMs = 5000) {
      const deadline = performance.now() + timeoutMs;
      do {
        if ((await read()).some(s => owned([s]).length && s.waitingForLock)) return;
        if (performance.now() >= deadline) throw Error('RUNTIME_REQUEST_LOCK_NOT_OBSERVED');
        await delay(Math.min(25, Math.max(0, deadline - performance.now())));
      } while (true);
    },
    async waitForClosed(timeoutMs = 5000) {
      assert.ok(capturedCount > 0, 'RUNTIME_SESSIONS_NOT_OBSERVED');
      assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 5000, 'RUNTIME_OBSERVATION_DEADLINE_INVALID');
      const deadline = performance.now() + timeoutMs;
      let attempts = 0;
      do {
        const all = await read(), remaining = owned(all); attempts++;
        const evidence = sessionEvidence(remaining, all.filter(s => !remaining.includes(s)));
        if (!remaining.length) return { ...evidence, capturedCount, attempts };
        if (performance.now() >= deadline) throw new RuntimeSessionsRemain(evidence);
        await delay(Math.min(25, Math.max(0, deadline - performance.now())));
      } while (true);
    },
  };
}

/** Real PostgreSQL regression: a deliberately open runtime connection MUST fail,
 * even if it adopts the fixture label. The identical check must pass after end().
 */
export async function rehearseSessionOwnership(owner: Pool, config: PoolConfig) {
  const fixture = new Pool({ ...config, application_name: FIXTURE_APPLICATION, idleTimeoutMillis: 0, maxLifetimeSeconds: 0 });
  const leaked = new Pool({ ...config, idleTimeoutMillis: 0, maxLifetimeSeconds: 0 });
  try {
    const fixturePid = Number((await fixture.query('SELECT pg_backend_pid() pid')).rows[0].pid);
    const observation = await observeRuntimeSessions(() => readRuntimeSessions(owner));
    const leakedPid = Number((await leaked.query('SELECT pg_backend_pid() pid')).rows[0].pid);
    await observation.capture();
    await leaked.query("SELECT set_config('application_name',$1,false)", [FIXTURE_APPLICATION]);
    await assert.rejects(observation.waitForClosed(100), (error: unknown) =>
      error instanceof RuntimeSessionsRemain && error.sessions.remainingCount === 1 &&
      error.sessions.sessions[0]?.pid === leakedPid && error.sessions.fixtureCount >= 1);
    await leaked.end();
    const closed = await observation.waitForClosed();
    assert.equal(Number((await fixture.query('SELECT pg_backend_pid() pid')).rows[0].pid), fixturePid);
    return { status: 'PASS', intentionalLeakRejected: true, relabeledLeakRejected: true, liveFixtureExcluded: true, remainingCount: closed.remainingCount };
  } finally { if (!leaked.ended) await leaked.end(); await fixture.end(); }
}
