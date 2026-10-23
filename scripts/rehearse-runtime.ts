// Isolated native PostgreSQL + real Next standalone. Never reads dotenv.
import assert from 'node:assert/strict';
import {Pool,type PoolConfig} from 'pg';
import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {request} from 'node:http';
import {pathToFileURL} from 'node:url';
import {encode} from 'next-auth/jwt';
import {assertLocalCanaryTarget,ISOLATED_MARKER} from './phase3-canary';
import {loadRuntimeEnvironment,validateRuntimeUrl,osEnvironment} from '../runtime/secrets.mjs';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
type Options={owner:Pool;config:PoolConfig;url:string;caFile:string;root:string;secretRoot:string;artifact:string;rollbackArtifact:string;selfHosted?:boolean};
export async function rehearseRuntime(o:Options){
  assertLocalCanaryTarget(o.config.host,o.config.port,o.config.database);
  assert.equal(readFileSync(join(o.root,'created-for-isolated-verification.marker'),'utf8'),ISOLATED_MARKER);
  assert.equal(resolve((await o.owner.query('SHOW data_directory')).rows[0].data_directory),resolve(o.root,'data'));
  const u=new URL(o.url),databaseEndpoint={kind:'self-hosted',host:u.hostname,port:Number(u.port||5432),database:u.pathname.slice(1)};
  validateRuntimeUrl(o.url,{isolated:!o.selfHosted,endpoint:o.selfHosted?databaseEndpoint:undefined});
  const checks:string[]=[];const children:ChildProcess[]=[];
  const baseline=(await o.owner.query("SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS digest FROM public.members t")).rows[0].digest;
  const pool=new Pool(o.config);
  try{
    assert.equal(pool.options.max,2);const a=await pool.connect(),b=await pool.connect();let aReleased=false,bReleased=false;
    try{
      const start=Date.now();await assert.rejects(pool.connect());assert.ok(Date.now()-start>=4500&&Date.now()-start<9000);assert.equal(pool.totalCount,2);
      const pending=pool.connect();await sleep(25);assert.equal(pool.waitingCount,1);a.release();aReleased=true;const recycled=await pending;assert.equal(pool.totalCount,2);recycled.release();
      await b.query('BEGIN');await b.query("SET LOCAL statement_timeout='100ms'");await assert.rejects(b.query('SELECT pg_sleep(0.3)'),(e:unknown)=>(e as {code?:string}).code==='57014');await b.query('ROLLBACK');
      let drained=false;const ending=pool.end().then(()=>{drained=true;});await sleep(30);assert.equal(drained,false);b.release();bReleased=true;await ending;assert.equal(pool.totalCount,0);
    }finally{if(!aReleased)a.release();if(!bReleased)b.release();}
    checks.push('Two-client cap, five-second exhaustion timeout, queued acquisition, SQL cancellation and awaited pool.end');
    const denied=new Pool({...o.config,onConnect:async()=>{throw Error('PUBLIC fixture initialization rejection');}});
    try{await assert.rejects(denied.connect());assert.equal(denied.totalCount,0);}finally{await denied.end();}
    checks.push('Failed awaited connection initializer destroys the client and never leases it');
  }finally{if(!pool.ended)await pool.end();}
  const authSecret='public-fictional-runtime-rehearsal-auth-secret-unchanged';
  for(const [name,value] of [['database',o.url],['auth',authSecret],['oidc','public-fictional-oidc-client-secret']])writeFileSync(join(o.secretRoot,name+'.secret'),value,{flag:'wx',mode:0o600});
  const artifactSha=(artifact:string)=>createHash('sha256').update(readFileSync(join(artifact,'runtime-artifact.json'))).digest('hex');
  function manifest(artifact:string,port:number,healthPort:number){return{version:1,artifactSha256:artifactSha(artifact),authUrl:'https://app.example/',clientId:'fictional-client',database:{file:join(o.secretRoot,'database.secret'),format:'text'},...(o.selfHosted?{databaseEndpoint}:{}),authSecret:{file:join(o.secretRoot,'auth.secret'),format:'text'},clientSecret:{file:join(o.secretRoot,'oidc.secret'),format:'text'},caFile:o.caFile,port,healthPort,host:'127.0.0.1',shutdownMs:30000};}
  function environment(artifact:string,port:number,healthPort:number){const file=join(o.secretRoot,'manifest-'+randomUUID()+'.json');writeFileSync(file,JSON.stringify(manifest(artifact,port,healthPort)),{flag:'wx'});return loadRuntimeEnvironment(file,artifact,{isolated:!o.selfHosted});}
  const env=environment(o.artifact,3330,3331);
  for(const k of Object.keys(env))assert.ok(!/^(MIGRATION_|DIRECT_DATABASE_|PG|SUPABASE_)/i.test(k));
  assert.equal(env.DATABASE_POOL_MAX,'2');assert.equal(env.ENABLE_UI_PREVIEW,undefined);
  checks.push('Actual external-file loader and private ACLs; runtime-only environment with no migration/provider variables');
  if(process.platform==='win32'){
    const ps='$ErrorActionPreference="Stop";Add-Type -AssemblyName System.Security;$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($p));[Array]::Clear($b,0,$b.Length)';
    const protect=(text:string)=>{const out=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:Buffer.from(text).toString('base64'),env:{...osEnvironment(),NODE_ENV:'test'},windowsHide:true,stdio:['pipe','pipe','ignore'],timeout:10000});const encrypted=Buffer.from(out.toString().trim(),'base64');out.fill(0);return encrypted;};
    const encryptedFile=join(o.secretRoot,'fixture-database.dpapi');writeFileSync(encryptedFile,protect(o.url),{flag:'wx'});
    const textManifest={...manifest(o.artifact,3330,3331),database:{file:encryptedFile,format:'dpapi-text'}};
    const textPath=join(o.secretRoot,'fixture-dpapi-text.json');writeFileSync(textPath,JSON.stringify(textManifest),{flag:'wx'});
    assert.equal(loadRuntimeEnvironment(textPath,o.artifact,{isolated:true}).DATABASE_URL,o.url);
    const payloadFile=join(o.secretRoot,'fixture-runtime-payload.dpapi');writeFileSync(payloadFile,protect(JSON.stringify({version:1,role:'koonpinai_runtime',password:String(o.config.password)})),{flag:'wx'});
    const {databaseEndpoint:_endpoint,...hostedManifest}=manifest(o.artifact,3330,3331);void _endpoint;
    const payloadManifest={...hostedManifest,database:{file:payloadFile,format:'dpapi-runtime-v1'},databaseTarget:{host:'fictional.pooler.supabase.com',database:'postgres',user:'koonpinai_runtime.fictional'}};
    const payloadPath=join(o.secretRoot,'fixture-dpapi-payload.json');writeFileSync(payloadPath,JSON.stringify(payloadManifest),{flag:'wx'});
    const recovered=loadRuntimeEnvironment(payloadPath,o.artifact);assert.equal(new URL(recovered.DATABASE_URL!).password,String(o.config.password));
    // Format conversion is in-memory only; the fictional hosted URL is NEVER connected.
    checks.push('Actual Windows DPAPI text and existing runtime-payload formats round trip; no production secret used');
  }
  const memberId=randomUUID(),sid=randomUUID(),subject='synthetic-lifecycle-'+randomUUID();
  const cookie=await encode({secret:authSecret,salt:'__Secure-authjs.session-token',token:{sub:memberId,userId:memberId,sid,oidcIssuer:'https://sso.kmitl.ac.th/realms/kmitl',oidcSubject:subject,deadline:Math.floor(Date.now()/1000)+3600},maxAge:3600});
  let fixtureCreated=false;
  async function start(artifact:string,e:NodeJS.ProcessEnv,expectReady=true){
    let executable=join(artifact,'runtime/server.mjs');
    let argumentsForChild:string[]=[];
    let childEnv=e;
    if(existsSync(join(artifact,'runtime/supervise.mjs'))){
      const store=join(o.secretRoot,'launch-'+randomUUID());mkdirSync(store,{mode:0o700});
      if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','$ErrorActionPreference="Stop";$p=[Console]::In.ReadToEnd();$a=Get-Acl -LiteralPath $p;$a.SetAccessRuleProtection($true,$true);Set-Acl -LiteralPath $p -AclObject $a'],{input:store,env:{...osEnvironment(),NODE_ENV:'test'},windowsHide:true,stdio:['pipe','ignore','ignore']});
      for(const [name,value] of [['database',e.DATABASE_URL!],['auth',e.AUTH_SECRET!],['oidc',e.AUTH_KEYCLOAK_SECRET!],['ca.crt',readFileSync(o.caFile,'utf8')]]){const f=join(store,name);writeFileSync(f,value,{flag:'wx'});if(process.platform!=='win32')chmodSync(f,0o400);}
      const m={...manifest(artifact,Number(e.PORT),Number(e.KOONPINAI_HEALTH_PORT)),database:{file:join(store,'database'),format:'text'},authSecret:{file:join(store,'auth'),format:'text'},clientSecret:{file:join(store,'oidc'),format:'text'},caFile:join(store,'ca.crt')};
      const mf=join(store,'manifest.json');writeFileSync(mf,JSON.stringify(m),{flag:'wx'});
      if(o.selfHosted){executable=join(artifact,'runtime/launch.mjs');argumentsForChild=[mf];}
      else{executable=join(o.secretRoot,'fixture-supervisor-'+randomUUID()+'.mjs');
       writeFileSync(executable,`import {supervise} from ${JSON.stringify(pathToFileURL(join(artifact,'runtime/supervise.mjs')).href)};import {loadRuntimeEnvironment,assertRuntimeSecretDirectory} from ${JSON.stringify(pathToFileURL(join(artifact,'runtime/secrets.mjs')).href)};assertRuntimeSecretDirectory(${JSON.stringify(mf)});supervise(${JSON.stringify(artifact)},loadRuntimeEnvironment(${JSON.stringify(mf)},${JSON.stringify(artifact)},{isolated:true}));`,{flag:'wx'});}
      childEnv={...osEnvironment(),NODE_ENV:'production'};
    }
    const child=spawn(process.execPath,[executable,...argumentsForChild],{cwd:artifact,env:childEnv,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});children.push(child);
    let logs='';for(const s of [child.stdout,child.stderr])s?.on('data',b=>{logs+=b.toString();if(logs.length>50000)logs=logs.slice(-50000);});
    const exited=new Promise<number|null>(ok=>child.once('exit',code=>ok(code)));
    const ready=new Promise<void>((ok,fail)=>{const timer=setTimeout(()=>fail(Error('ISOLATED_STARTUP_TIMEOUT')),45000);child.on('message',(m:unknown)=>{if((m as {event?:string}).event==='ready'){clearTimeout(timer);ok();}});child.once('exit',()=>{clearTimeout(timer);const code=logs.match(/Startup rejected \(([A-Z0-9_]+)\)/)?.[1]??'UNKNOWN';fail(Error('ISOLATED_STARTUP_'+code));});});
    if(expectReady)await ready;else{void ready.catch(()=>{});assert.equal(await exited,1);}
    const verifyLogs=()=>{for(const secret of [o.url,authSecret,String(o.config.password),'public-fictional-oidc-client-secret'])assert.ok(!logs.includes(secret),'SECRET_LOGGING_DETECTED');};
    verifyLogs();return{child,exited,verifyLogs,rejectionCode:logs.match(/Startup rejected \(([A-Z0-9_]+)\)/)?.[1]};
  }
  async function stop(p:Awaited<ReturnType<typeof start>>){if(p.child.exitCode!==null)return; if(process.platform==='win32')p.child.send({type:'shutdown'});else p.child.kill('SIGTERM');let timer:ReturnType<typeof setTimeout>|undefined;try{const code=await Promise.race([p.exited,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('DRAIN_TIMEOUT')),35000);})]);assert.equal(code,0);p.verifyLogs();}finally{clearTimeout(timer);}}
  function http(port:number,path:string,authenticated=false):Promise<{status:number;location?:string;body:string}>{return new Promise((ok,fail)=>{const req=request({hostname:'127.0.0.1',port,path,headers:{host:'app.example','x-forwarded-proto':'https',...(authenticated?{cookie:'__Secure-authjs.session-token='+cookie}:{})}},res=>{const chunks:Buffer[]=[];res.on('data',b=>chunks.push(b));res.on('end',()=>ok({status:res.statusCode!,location:res.headers.location,body:Buffer.concat(chunks).toString()}));});req.setTimeout(20000,()=>req.destroy(Error('ISOLATED_HTTP_TIMEOUT')));req.on('error',fail);req.end();});}
  function assertPolicyGate(r:Awaited<ReturnType<typeof http>>){
    const redirect=r.status===307&&r.location?.endsWith('/onboarding/policy');
    const streamed=r.status===200&&/<meta[^>]+http-equiv="refresh"[^>]+url=\/onboarding\/policy/i.test(r.body);
    if(!redirect&&!streamed)throw Error('ISOLATED_POLICY_GATE_'+r.status+'_'+(r.location?.endsWith('/login')?'LOGIN':'OTHER'));
  }
  try{
    await o.owner.query("INSERT INTO public.members(id,oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status) VALUES($1,'https://sso.kmitl.ac.th/realms/kmitl',$2,'Synthetic lifecycle','Fixture','Synthetic',now(),'2026-10-21',now(),'approved')",[memberId,subject]);fixtureCreated=true;
    await o.owner.query("INSERT INTO public.application_sessions(id,member_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[sid,memberId]);
    const candidate=await start(o.artifact,env);
    assert.equal((await http(3331,'/ready')).status,200);assert.equal((await http(3330,'/login')).status,200);
    assert.equal((await http(3330,'/')).status,307);
    const gated=await http(3330,'/',true);assertPolicyGate(gated);
    const provider=await http(3330,'/api/auth/providers');assert.equal(provider.status,200);assert.ok(provider.body.includes('https://app.example/api/auth/callback/keycloak'));
    checks.push('Real Next artifact: startup identity/TLS readiness, login, private redirects, canonical callback, old consent requires renewal');
    const bad={...environment(o.artifact,3340,3341),DATABASE_URL:o.url.replace(encodeURIComponent(String(o.config.password)),'public-wrong-fixture-password')};
    const failed=await start(o.artifact,bad,false);assert.equal(failed.rejectionCode,'28P01');assert.equal((await http(3330,'/login')).status,200);
    checks.push('Failed candidate authentication never opens traffic; previous healthy process remains available');
    if(o.selfHosted){
      await o.owner.query('ALTER TABLE public.timetable_entries NO FORCE ROW LEVEL SECURITY');
      try{const unready=await start(o.artifact,environment(o.artifact,3340,3341),false);assert.equal(unready.rejectionCode,'DATABASE_TIMETABLE_SCHEMA_UNREADY');}
      finally{await o.owner.query('ALTER TABLE public.timetable_entries FORCE ROW LEVEL SECURITY');}
      assert.equal((await http(3331,'/ready')).status,200);
      checks.push('Candidate refuses timetable RLS drift before opening traffic; restored invariant returns readiness without data changes');
    }
    const held=await o.owner.connect();
    try{
      await held.query('BEGIN');await held.query('LOCK TABLE public.application_sessions IN ACCESS EXCLUSIVE MODE');
      const response=http(3330,'/account',true);
      let blocked=false;for(let i=0;i<35;i++){blocked=Number((await o.owner.query("SELECT count(*) AS n FROM pg_stat_activity WHERE usename='koonpinai_runtime' AND wait_event_type='Lock'")).rows[0].n)>0;if(blocked)break;await sleep(30);}assert.ok(blocked);
      if(process.platform==='win32')candidate.child.send({type:'shutdown'});else candidate.child.kill('SIGTERM');
      await sleep(100);assert.equal(candidate.child.exitCode,null);await held.query('COMMIT');
      assert.ok([200,307].includes((await response).status));assert.equal(await candidate.exited,0);candidate.verifyLogs();
    }finally{await held.query('ROLLBACK');held.release();}
    assert.equal(Number((await o.owner.query("SELECT count(*) AS n FROM pg_stat_activity WHERE usename='koonpinai_runtime'")).rows[0].n),0);
    checks.push('Real in-flight authenticated SQL request completes before shutdown; all runtime database clients close');
    const rollback=await start(o.rollbackArtifact,environment(o.rollbackArtifact,3330,3331));
    const oldSession=await http(3330,'/',true);assertPolicyGate(oldSession);
    assert.equal((await http(3331,'/ready')).status,200);await stop(rollback);
    checks.push((artifactSha(o.artifact)!==artifactSha(o.rollbackArtifact)?'Previous same-policy build rollback':'Same-artifact restart')+' preserves encrypted session and renewed-consent gate');
  }finally{
    for(const child of children){if(child.exitCode===null&&child.connected)child.send({type:'shutdown'});}
    await sleep(150);
    for(const child of children)if(child.exitCode===null){child.kill();throw Error('ISOLATED_CHILD_DID_NOT_DRAIN');}
    if(fixtureCreated){const c=await o.owner.connect();try{await c.query('BEGIN');await c.query('DELETE FROM public.application_sessions WHERE id=$1 AND member_id=$2',[sid,memberId]);assert.equal((await c.query('DELETE FROM public.members WHERE id=$1 AND oidc_subject=$2',[memberId,subject])).rowCount,1);assert.equal((await c.query("SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS digest FROM public.members t")).rows[0].digest,baseline);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  }
  return{checks,checkCount:checks.length,status:'PASS',realNext:true,realPostgres:true,realOidc:false,syntheticCookie:true,productionConnected:false,productionLauncher:o.selfHosted??false,rollbackDistinctArtifact:artifactSha(o.artifact)!==artifactSha(o.rollbackArtifact),signalMechanism:process.platform==='win32'?'IPC invokes same shutdown handler; POSIX SIGTERM not tested':'SIGTERM',dockerTested:false};
}
