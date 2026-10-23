import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE_APPLICATION, observeRuntimeSessions, RuntimeSessionsRemain, sessionEvidence, type RuntimeSession } from '../scripts/runtime-session-observer';
import { outputEvidence, rehearsalErrorEvidence } from '../scripts/tooling/rehearsal-diagnostics.mjs';

const fixture: RuntimeSession = { pid: 10, backendStart: '2026-01-01 00:00:00.000001+00', role: 'koonpinai_runtime', applicationName: FIXTURE_APPLICATION, state: 'idle', waitingForLock: false, observer: false };
const runtime: RuntimeSession = { ...fixture, pid: 20, applicationName: 'koonpinai-runtime' };

test('shutdown observation excludes only known fixture identities and its own backend', async () => {
  const observer = { ...fixture, pid: 30, observer: true };
  let rows = [fixture, observer];
  const check = await observeRuntimeSessions(async () => rows);
  rows = [fixture, observer, runtime]; await check.capture();
  rows = [fixture, observer];
  const result = await check.waitForClosed(100);
  assert.equal(result.remainingCount, 0); assert.equal(result.fixtureCount, 1); assert.equal(result.observerCount, 1);
});

test('a deliberately leaked runtime session fails at the deadline, even when relabeled as a fixture', async () => {
  let rows = [fixture]; const check = await observeRuntimeSessions(async () => rows);
  rows = [fixture, runtime]; await check.capture();
  rows = [fixture, { ...runtime, applicationName: FIXTURE_APPLICATION }];
  await assert.rejects(check.waitForClosed(40), (e: unknown) => e instanceof RuntimeSessionsRemain && e.sessions.remainingCount === 1 && e.sessions.sessions[0].pid === runtime.pid);
  rows = [fixture]; assert.equal((await check.waitForClosed(100)).remainingCount, 0);
});

test('bounded observation waits for backend disappearance and never exempts reused fixture PIDs', async () => {
  let rows = [fixture], reads = 0;
  const check = await observeRuntimeSessions(async () => { reads++; return rows; });
  rows = [fixture, runtime]; await check.capture();
  const before = reads;
  const closing = check.waitForClosed(200);
  setTimeout(() => { rows = [fixture]; }, 35);
  assert.equal((await closing).remainingCount, 0); assert.ok(reads - before >= 2);
  rows = [{ ...fixture, backendStart: '2026-01-01 00:00:00.000002+00' }];
  await assert.rejects(check.waitForClosed(30), RuntimeSessionsRemain);
});

test('unobserved runtimes and unexpected baseline connections cannot produce a vacuous pass', async () => {
  await assert.rejects(observeRuntimeSessions(async () => [runtime]), /RUNTIME_SESSION_BASELINE_UNEXPECTED/);
  const check = await observeRuntimeSessions(async () => [fixture]);
  await assert.rejects(check.capture(), /RUNTIME_SESSIONS_NOT_OBSERVED/);
  await assert.rejects(check.waitForClosed(100), /RUNTIME_SESSIONS_NOT_OBSERVED/);
});

test('lock observation cannot be satisfied by a fixture and timeout evidence never forwards private fields', async () => {
  let rows = [fixture]; const check = await observeRuntimeSessions(async () => rows);
  rows = [{ ...fixture, waitingForLock: true }];
  await assert.rejects(check.waitForLock(30), /RUNTIME_REQUEST_LOCK_NOT_OBSERVED/);
  rows = [fixture, { ...runtime, waitingForLock: true }]; await check.waitForLock(100);
  const poison = 'postgresql://private:PRIVATE-token@private.example/private';
  const evidence = sessionEvidence([{ ...runtime, role: poison, applicationName: poison, state: poison }], []);
  const error = new RuntimeSessionsRemain(evidence);
  const report = rehearsalErrorEvidence(error);
  const roundTrip = outputEvidence(JSON.stringify({ evidence: report }));
  assert.equal(report.runtimeSessions?.remainingCount, 1);
  assert.equal(roundTrip.runtimeSessions?.sessions[0].applicationName, 'unexpected');
  assert.ok(!JSON.stringify(roundTrip).includes(poison));
  const malicious = outputEvidence(JSON.stringify({ evidence: { runtimeSessions: { ...evidence, sessions: [{ pid: 20, role: poison, applicationName: poison, state: poison, query: poison }], url: poison } } }));
  assert.ok(!JSON.stringify(malicious).includes(poison));
});
