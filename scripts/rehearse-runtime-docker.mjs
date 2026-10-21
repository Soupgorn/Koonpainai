// Local synthetic containers ONLY. Never reads dotenv, uses SSO or pushes images.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {encode} from 'next-auth/jwt';
import {osEnvironment} from '../runtime/secrets.mjs';
const root=resolve(import.meta.dirname,'..'),id='kp-local-'+randomUUID().slice(0,12),label='koonpinai.rehearsal';
const image=id+':candidate',db=id+'-db',app=id+'-app',bad=id+'-bad',rollback=id+'-rollback',tlsVolume=id+'-tls',dataVolume=id+'-data';
const pgImage='postgres:17.11-bookworm@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27';
const nodeImage='node:24-bookworm-slim@sha256:8cabefbd444809cf0e319b5831c65da1ea202200ca552a5e75fd7938a6f86658';
const createdContainers=[],createdVolumes=[];let output,fixtures;const checks=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function tool(exe,args,input,timeout=180000){return new Promise((ok,fail)=>{const c=spawn(exe,args,{cwd:root,env:osEnvironment(),windowsHide:true,stdio:['pipe','pipe','pipe']});let out=Buffer.alloc(0);c.stdout.on('data',b=>{if(out.length<4e6)out=Buffer.concat([out,b]);});c.stderr.on('data',()=>{});c.stdin.on('error',()=>{});const timer=setTimeout(()=>{c.kill();fail(Error('ISOLATED_TOOL_TIMEOUT'));},timeout);c.once('error',()=>{clearTimeout(timer);fail(Error('ISOLATED_TOOL_UNAVAILABLE'));});c.once('exit',code=>{clearTimeout(timer);if(code===0)ok(out);else fail(Error('ISOLATED_TOOL_FAILED'));});c.stdin.end(input);});}
const docker=(args,input,timeout)=>tool('docker',args,input,timeout);
const inspect=async(type,name)=>JSON.parse((await docker([type,'inspect',name])).toString())[0];
async function owned(type,name){const i=await inspect(type,name);assert.equal(type==='container'?i.Config.Labels?.[label]:i.Labels?.[label],id);return i;}
async function sql(text){return(await docker(['exec','-i',db,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-p','55434','-U','postgres','-d','phase3_synthetic'],Buffer.from(text))).toString().trim();}
async function container(name,args){await docker(['run','-d','--name',name,'--label',label+'='+id,...args]);createdContainers.push(name);}
try{
  try{await docker(['version','--format','{{.Server.Os}}'],undefined,10000);}catch{console.log(JSON.stringify({status:'NOT-RUN',reason:'Docker CLI/daemon unavailable',productionConnected:false}));process.exit(2);}
  if(process.platform!=='linux')throw Error('LINUX_DOCKER_REHEARSAL_REQUIRED');
  output=mkdtempSync(join(tmpdir(),'koonpinai-docker-rehearsal-'));fixtures=join(output,'runtime-secrets');mkdirSync(fixtures,{mode:0o750});
  const run=async(args)=>{await tool('openssl',args,undefined,15000);};
  await run(['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(fixtures,'ca.key'),'-out',join(fixtures,'ca.crt'),'-days','2','-subj','/CN=Koonpinai Docker fixture CA','-addext','basicConstraints=critical,CA:TRUE']);
  await run(['req','-newkey','rsa:2048','-nodes','-keyout',join(fixtures,'server.key'),'-out',join(fixtures,'server.csr'),'-subj','/CN=localhost']);
  writeFileSync(join(fixtures,'extensions'),'subjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
  await run(['x509','-req','-in',join(fixtures,'server.csr'),'-CA',join(fixtures,'ca.crt'),'-CAkey',join(fixtures,'ca.key'),'-CAcreateserial','-out',join(fixtures,'server.crt'),'-days','2','-extfile',join(fixtures,'extensions')]);
  const bootstrap=sha('PUBLIC synthetic Docker owner password'),password=sha('PUBLIC synthetic Docker runtime password'),secret='PUBLIC-synthetic-Docker-Auth-secret-unchanged';
  const schema=['0000_damp_nekra.sql','0001_account_table_rls.sql'].map(f=>readFileSync(join(root,'drizzle',f),'utf8')).join('\n');
  const role=readFileSync(join(root,'operations/runtime-role.PROPOSED.sql'));assert.equal(sha(role),'43895b7b1245750b4127669aeee06a3dd6ccae8bab2a49bf71da59d072c9057f');
  const init="CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE SCHEMA drizzle;CREATE TABLE drizzle.__drizzle_migrations(id int,hash text,created_at bigint);INSERT INTO drizzle.__drizzle_migrations VALUES(1,'synthetic-0000',1),(2,'synthetic-0001',2);\n"+schema+'\n'+role+`\nALTER ROLE koonpinai_runtime PASSWORD '${password}';`;
  writeFileSync(join(fixtures,'init.sql'),init);writeFileSync(join(fixtures,'bootstrap.secret'),bootstrap);
  writeFileSync(join(fixtures,'runtime.secret'),`postgresql://koonpinai_runtime:${password}@127.0.0.1:55434/phase3_synthetic`);
  writeFileSync(join(fixtures,'bad.secret'),'postgresql://koonpinai_runtime:PUBLIC-wrong@127.0.0.1:55434/phase3_synthetic');
  writeFileSync(join(fixtures,'auth.secret'),secret);writeFileSync(join(fixtures,'oidc.secret'),'PUBLIC-fictional-client-secret');
  const buildId=sha(readFileSync(join(root,'package-lock.json'))+readFileSync(join(root,'src/db/connection.ts')));
  await docker(['build','--build-arg','KOONPINAI_BUILD_ID='+buildId,'--label',label+'='+id,'-t',image,'.'],undefined,600000);
  const artifactPin=(await docker(['run','--rm','--entrypoint','node',image,'-e',"process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/runtime-artifact.json')).digest('hex'))"])).toString().trim();assert.match(artifactPin,/^[a-f0-9]{64}$/);
  const m={version:1,artifactSha256:artifactPin,authUrl:'https://app.example/',clientId:'PUBLIC-fixture-client',database:{file:'/run/secrets/runtime.secret',format:'text'},authSecret:{file:'/run/secrets/auth.secret',format:'text'},clientSecret:{file:'/run/secrets/oidc.secret',format:'text'},caFile:'/run/secrets/ca.crt',port:3330,healthPort:3331,host:'0.0.0.0',shutdownMs:30000};
  const appStore=join(fixtures,'app'),badStore=join(fixtures,'bad-app');
  for(const store of [appStore,badStore]){mkdirSync(store,{mode:0o750});for(const f of ['auth.secret','oidc.secret','ca.crt'])cpSync(join(fixtures,f),join(store,f));cpSync(join(fixtures,store===appStore?'runtime.secret':'bad.secret'),join(store,'runtime.secret'));writeFileSync(join(store,'koonpinai-runtime-manifest.json'),JSON.stringify(store===appStore?m:{...m,port:3340,healthPort:3341}));}
  // External fixture helper is NOT included in the production image. Only its
  // loopback fixture URL exception differs; PID1 supervision is production code.
  writeFileSync(join(fixtures,'fixture-launch.mjs'),"import {loadRuntimeEnvironment,assertRuntimeSecretDirectory} from '/app/runtime/secrets.mjs';import {supervise} from '/app/runtime/supervise.mjs';assertRuntimeSecretDirectory(process.argv[2]);supervise('/app',loadRuntimeEnvironment(process.argv[2],'/app',{isolated:true}));");
  for(const name of [tlsVolume,dataVolume]){await docker(['volume','create','--label',label+'='+id,name]);createdVolumes.push(name);}
  const uid=(await docker(['run','--rm','--entrypoint','id',pgImage,'-u','postgres'])).toString().trim();assert.match(uid,/^\d+$/);
  await docker(['run','--rm','--user','0','--entrypoint','sh','-v',fixtures+':/fixture','-v',tlsVolume+':/tls',nodeImage,'-c',`cp /fixture/server.key /fixture/server.crt /tls/; chown ${uid}:${uid} /tls/server.key /tls/server.crt; chmod 600 /tls/server.key; chown -R 1001:1001 /fixture; chmod 750 /fixture; chmod 440 /fixture/*.secret /fixture/app/*.secret /fixture/bad-app/*.secret; chmod 444 /fixture/bootstrap.secret /fixture/init.sql /fixture/fixture-launch.mjs`]);
  await container(db,['-e','POSTGRES_DB=phase3_synthetic','-e','POSTGRES_PASSWORD_FILE=/fixture-bootstrap','-v',join(fixtures,'bootstrap.secret')+':/fixture-bootstrap:ro','-v',join(fixtures,'init.sql')+':/docker-entrypoint-initdb.d/10-synthetic.sql:ro','-v',tlsVolume+':/tls:ro','-v',dataVolume+':/var/lib/postgresql/data','-p','127.0.0.1:3330:3330',pgImage,'-p','55434','-c','ssl=on','-c','ssl_min_protocol_version=TLSv1.3','-c','ssl_cert_file=/tls/server.crt','-c','ssl_key_file=/tls/server.key']);
  let dbReady=false;for(let n=0;n<80;n++){try{dbReady=await sql("SELECT to_regclass('public.members') IS NOT NULL")==='t';if(dbReady)break;}catch{}await pause(250);}assert.ok(dbReady);
  const args=invalid=>['--network','container:'+db,'--read-only','--tmpfs','/tmp','--tmpfs','/app/.next/cache:uid=1001,gid=1001,mode=0700','--cap-drop','ALL','--security-opt','no-new-privileges','-v',(invalid?badStore:appStore)+':/run/secrets:ro','-v',join(fixtures,'fixture-launch.mjs')+':/fixture-launch.mjs:ro','--entrypoint','node',image,'/fixture-launch.mjs','/run/secrets/koonpinai-runtime-manifest.json'];
  await container(app,args(false));
  let healthy=false;for(let n=0;n<100;n++){const i=await owned('container',app);if(i.State.Health?.Status==='healthy'){healthy=true;break;}if(i.State.Status==='exited')break;await pause(500);}assert.ok(healthy);checks.push('Linux image, nonroot runtime-only mounts, real Docker HEALTHCHECK and verified TLS startup');
  await container(bad,args(true));let failed;for(let n=0;n<50;n++){failed=await owned('container',bad);if(failed.State.Status==='exited')break;await pause(200);}assert.equal(failed.State.ExitCode,1);assert.equal((await fetch('http://127.0.0.1:3330/login')).status,200);checks.push('Failed candidate leaves healthy instance available');
  const member=randomUUID(),sid=randomUUID(),subject='PUBLIC-docker-fixture-'+randomUUID();
  await sql(`INSERT INTO public.members(id,oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status) VALUES('${member}','https://sso.kmitl.ac.th/realms/kmitl','${subject}','PUBLIC fixture','Fixture','Synthetic',now(),'2026-10-21',now(),'approved');INSERT INTO public.application_sessions(id,member_id,expires_at) VALUES('${sid}','${member}',now()+interval '1 hour');`);
  const cookie=await encode({secret,salt:'__Secure-authjs.session-token',maxAge:3600,token:{userId:member,sid,oidcIssuer:'https://sso.kmitl.ac.th/realms/kmitl',oidcSubject:subject,deadline:Math.floor(Date.now()/1000)+3600}});
  const authenticated=path=>fetch('http://127.0.0.1:3330'+path,{headers:{host:'app.example','x-forwarded-proto':'https',cookie:'__Secure-authjs.session-token='+cookie},redirect:'manual'});
  await authenticated('/account');
  const held=sql('BEGIN;LOCK TABLE public.application_sessions IN ACCESS EXCLUSIVE MODE;SELECT pg_sleep(2);COMMIT;');await pause(100);
  const response=authenticated('/account');let blocked=false;for(let n=0;n<25;n++){blocked=Number(await sql("SELECT count(*) FROM pg_stat_activity WHERE usename='koonpinai_runtime' AND wait_event_type='Lock'"))>0;if(blocked)break;await pause(20);}assert.ok(blocked);
  const stopped=docker(['stop','--time','40',app]);assert.ok([200,307].includes((await response).status));await held;await stopped;assert.equal((await owned('container',app)).State.ExitCode,0);assert.equal(await sql("SELECT count(*) FROM pg_stat_activity WHERE usename='koonpinai_runtime'"),'0');checks.push('Real Docker SIGTERM/PID1 forwarding drains blocked authenticated request and closes all runtime clients');
  await container(rollback,args(false));for(let n=0;n<100;n++){if((await owned('container',rollback)).State.Health?.Status==='healthy')break;await pause(500);}const gated=await authenticated('/');assert.ok(gated.status===307||(await gated.text()).includes('url=/onboarding/policy'));await docker(['stop','--time','40',rollback]);assert.equal((await owned('container',rollback)).State.ExitCode,0);checks.push('Same-image rollback/restart retains synthetic session and consent gate (not previous production version)');
  await sql(`DELETE FROM public.application_sessions WHERE id='${sid}' AND member_id='${member}';DELETE FROM public.members WHERE id='${member}' AND oidc_subject='${subject}';`);assert.equal(await sql('SELECT count(*) FROM public.members'),'0');assert.equal(await sql('SELECT count(*) FROM drizzle.__drizzle_migrations'),'2');
  const report={status:'PASS',checks,artifactPin,productionConnected:false,realOidc:false,syntheticCookies:true,dockerSigtermTested:true,migration0002Executed:false,output};writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.error(JSON.stringify({status:'FAIL',code:/^[A-Z_]+$/.test(e.message)?e.message:'ISOLATED_ASSERTION_FAILED',productionConnected:false,output}));process.exitCode=1;}
finally{
  // Only exact newly named resources with this run's ownership label qualify.
  for(const name of createdContainers.reverse()){await owned('container',name);await docker(['rm','-f',name]);}
  for(const name of createdVolumes){await owned('volume',name);await docker(['volume','rm',name]);}
  // Keep the image and synthetic host evidence; never prune images or old backups.
}
