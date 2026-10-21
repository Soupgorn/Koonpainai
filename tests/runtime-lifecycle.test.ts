import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {serveRuntime} from '../runtime/lifecycle.mjs';
import {validateRuntimeUrl,validateManifest,osEnvironment,assertNoInheritedCredentials,assertRuntimeSecretDirectory} from '../runtime/secrets.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyArtifact} from '../runtime/artifact.mjs';
import {databaseConfig} from '../src/db/connection';

test('runtime pools are capped at two, with finite acquisition, SQL and retention limits',()=>{
  const env={NODE_ENV:'test' as const,DATABASE_URL:'postgresql://fixture:fixture@fixture.invalid/fixture'};
  const cfg=databaseConfig('runtime',env);assert.equal(cfg.max,2);assert.equal(cfg.min,0);assert.equal(cfg.idleTimeoutMillis,10000);assert.equal(cfg.connectionTimeoutMillis,5000);assert.equal(cfg.maxLifetimeSeconds,300);assert.match(cfg.options!,/statement_timeout=15s/);
  assert.equal(databaseConfig('runtime',{...env,DATABASE_POOL_MAX:'1'}).max,1);
  for(const n of ['0','3','100','2.0','-1',''])assert.throws(()=>databaseConfig('runtime',{...env,DATABASE_POOL_MAX:n}));
  assert.equal(typeof cfg.onConnect,'function');assert.equal(cfg.query_timeout,16000);
  assert.equal(databaseConfig('runtime',{...env,DATABASE_URL:'postgresql://fixture:fixture@fixture.pooler.supabase.com:6543/postgres'}).onConnect,undefined);
});
test('secret manifest and forward launcher forbid owner/Transaction routes and malformed configuration',()=>{
  const u='postgresql://koonpinai_runtime.fixture:fictional@fixture.pooler.supabase.com:5432/postgres';
  assert.doesNotThrow(()=>validateRuntimeUrl(u));
  for(const candidate of [u.replace('koonpinai_runtime','postgres'),u.replace('5432','6543'),u+'?sslmode=require','postgresql://koonpinai_runtime:fixture@127.0.0.1:55434/phase3_synthetic'])assert.throws(()=>validateRuntimeUrl(candidate));
  assert.doesNotThrow(()=>validateRuntimeUrl('postgresql://koonpinai_runtime:fixture@127.0.0.1:55434/phase3_synthetic',{isolated:true}));
  assert.throws(()=>validateManifest({version:1,DATABASE_URL:u}));
  assert.throws(()=>assertNoInheritedCredentials({MIGRATION_DATABASE_URL:'fictional'}));
  assert.doesNotThrow(()=>assertNoInheritedCredentials({PATH:'fictional'}));
  assert.deepEqual(osEnvironment({MIGRATION_DATABASE_URL:'fictional',DIRECT_DATABASE_URL:'fictional',PGPASSWORD:'fictional',NODE_OPTIONS:'fixture',AUTH_SECRET:'fixture',PATH:'fixture'}),{PATH:'fixture'});
});
test('HTTP shutdown stops admission, completes an active response and after-work before pool closure',async()=>{
  const order:string[]=[];let releaseRequest!:()=>void,releaseAfter!:()=>void;
  const waiting=new Promise<void>(r=>{releaseRequest=r;}),after=new Promise<void>(r=>{releaseAfter=r;});
  const {EventEmitter}=await import('node:events');const events=new EventEmitter();
  const app=await serveRuntime({host:'127.0.0.1',port:0,healthPort:0,shutdownMs:2000,
    initialize:async()=>({requestHandler:async(_req:unknown,res:import('node:http').ServerResponse)=>{events.emit('request');await waiting;res.end('completed');order.push('response');},server:{close:async()=>{await after;order.push('after');}}}),ready:async()=>{},closePools:async()=>{order.push('pools');}});
  try{
    const address=app.server.address() as import('node:net').AddressInfo;
    const started=once(events,'request');const response=fetch(`http://127.0.0.1:${address.port}/slow`);await started;
    const stopped=app.shutdown();assert.equal(app.shutdown(),stopped); // same completion, no repeated pool.end
    releaseRequest();assert.equal(await(await response).text(),'completed');assert.deepEqual(order,['response']);
    releaseAfter();await stopped;assert.deepEqual(order,['response','after','pools']);
    await assert.rejects(fetch(`http://127.0.0.1:${address.port}/new`));
  }finally{releaseRequest();releaseAfter();await app.shutdown();}
});
test('failed startup never opens the public listener and still closes pools',async()=>{
  let closed=false;
  await assert.rejects(serveRuntime({host:'127.0.0.1',port:0,healthPort:0,shutdownMs:1000,initialize:async()=>({requestHandler:()=>{},server:{close:async()=>{}}}),ready:async()=>{throw Error('fictional failure');},closePools:async()=>{closed=true;}}));
  assert.equal(closed,true);
});
test('production secret directory rejects mixed operational files and additional mounts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'koonpinai-secret-layout-'));
  try{
    for(const f of ['database','auth','oidc','ca.crt'])writeFileSync(join(dir,f),'PUBLIC fixture');
    const file=join(dir,'manifest.json');
    const m={version:1,artifactSha256:'a'.repeat(64),authUrl:'https://app.example/',clientId:'fixture',database:{file:join(dir,'database'),format:'text'},authSecret:{file:join(dir,'auth'),format:'text'},clientSecret:{file:join(dir,'oidc'),format:'text'},caFile:join(dir,'ca.crt'),port:3330,healthPort:3331,host:'127.0.0.1',shutdownMs:30000};
    writeFileSync(file,JSON.stringify(m));assert.doesNotThrow(()=>assertRuntimeSecretDirectory(file));
    writeFileSync(join(dir,'migration-url'),'PUBLIC fictional owner credential');assert.throws(()=>assertRuntimeSecretDirectory(file));
  }finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('koonpinai-secret-layout-'));rmSync(dir,{recursive:true,force:true});}
});
test('artifact pin detects modified code and refuses paths outside the bundle',{skip:!process.versions.node.startsWith('24.')},()=>{
  const dir=mkdtempSync(join(tmpdir(),'koonpinai-artifact-integrity-'));
  const sha=(b:string)=>createHash('sha256').update(b).digest('hex');
  try{
    const payload=join(dir,'payload.txt');writeFileSync(payload,'PUBLIC original fixture');
    const m={format:1,next:'16.4.2',nodeMajor:24,policyVersion:'2026-10-22-student-v3',schemaMigrationsApplied:false,files:{'payload.txt':sha('PUBLIC original fixture')}};
    const bytes=JSON.stringify(m);writeFileSync(join(dir,'runtime-artifact.json'),bytes);
    assert.doesNotThrow(()=>verifyArtifact(dir,sha(bytes)));assert.throws(()=>verifyArtifact(dir,'0'.repeat(64)));
    writeFileSync(payload,'PUBLIC tampered fixture');assert.throws(()=>verifyArtifact(dir,sha(bytes)));
    const outside=JSON.stringify({...m,files:{'../outside':sha('PUBLIC fixture')}});writeFileSync(join(dir,'runtime-artifact.json'),outside);assert.throws(()=>verifyArtifact(dir,sha(outside)));
  }finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('koonpinai-artifact-integrity-'));rmSync(dir,{recursive:true,force:true});}
});
