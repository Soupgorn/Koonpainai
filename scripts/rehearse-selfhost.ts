// New synthetic loopback clusters only. No dotenv, hosted URL, real SSO or deployment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {databaseConfig,databaseErrorCode} from '../src/db/connection';
import {executeReviewedMigrations} from '../src/db/migrations';
import {createTimetableRepository} from '../src/db/timetable-repository';
import {POLICY_VERSION} from '../src/lib/auth/domain';
import {osEnvironment} from '../runtime/secrets.mjs';
import {runIsolatedCanary,ISOLATED_MARKER} from './phase3-canary';
import {rehearseStudentTimetables} from './rehearse-student-timetables';
import {rehearseStudentBrowser} from './rehearse-student-browser';
import {rehearseRuntime} from './rehearse-runtime';
import {secureDirectory} from './portable/permissions';
import {generateBackupKey,hash,outside} from './portable/crypto';
import {backup,restore,verifyBackup,replicateBackup,projection,pgTool,type DatabaseTarget} from './portable/database';
import {configureAccess,verifyAccess} from './portable/access';
import {exerciseSyntheticAccounts,cleanupSyntheticAccounts,requireSyntheticDatabase,stagingFixtureSchema} from './staging/probe';
import {outputEvidence,rehearsalErrorEvidence} from './tooling/rehearsal-diagnostics.mjs';

const env={...osEnvironment(),NODE_ENV:'test' as const};
async function tool(exe:string,args:string[],input?:Buffer|string){return new Promise<string>((ok,fail)=>{const c=spawn(exe,args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',stderr='';const evidence=(exitCode:number|null)=>({program:basename(exe).replace(/\.exe$/i,''),exitCode,...outputEvidence(out,stderr)});const t=setTimeout(()=>{c.kill();fail(Object.assign(Error('ISOLATED_TOOL_TIMEOUT'),{evidence:evidence(null)}));},120000);c.stdout.on('data',b=>{out=(out+b.toString()).slice(-2e6);});c.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-16000);});c.stdin.on('error',()=>{});c.stdin.end(input);c.on('error',()=>{clearTimeout(t);fail(Object.assign(Error('ISOLATED_TOOL_UNAVAILABLE'),{evidence:evidence(null)}));});c.on('close',code=>{clearTimeout(t);if(code===0)ok(out);else fail(Object.assign(Error('ISOLATED_TOOL_FAILED'),{evidence:evidence(code)}));});});}
export type HistoricalArchive={bytes:Buffer;sha256:string;records:{table:string;rows:string;digest:string}[];ledger:{hash:string;created_at:string|number}[]};
export async function rehearseSelfhost(o:{bin:string;artifact:string;rollbackArtifact?:string;root:string;archiveRoot:string;keyRoot:string;historical?:HistoricalArchive;sourcePortable?:{directory:string;keyFile:string}}){
 for(const p of [o.root,o.archiveRoot,o.keyRoot])if(!outside(p,process.cwd())||existsSync(p))throw Error('NEW_EXTERNAL_ISOLATED_PATH_REQUIRED');
 secureDirectory(o.root);secureDirectory(o.archiveRoot);secureDirectory(o.keyRoot);writeFileSync(join(o.root,'created-for-isolated-verification.marker'),ISOLATED_MARKER,{flag:'wx'});const checks:string[]=[];
 const executable=(name:string)=>join(o.bin,name+(process.platform==='win32'?'.exe':''));
 const password=hash('PUBLIC synthetic isolated administrator; not production'),runtimePassword=hash('PUBLIC synthetic runtime; not production'),migrationPassword=hash('PUBLIC synthetic migrator; not production');
 const ca=join(o.root,'ca.crt'),key=join(o.root,'server.key'),cert=join(o.root,'server.crt');
 await tool('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(o.root,'ca.key'),'-out',ca,'-days','2','-subj','/CN=Koonpinai isolated portable backup CA','-addext','basicConstraints=critical,CA:TRUE']);
 await tool('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',key,'-out',join(o.root,'server.csr'),'-subj','/CN=localhost']);
 writeFileSync(join(o.root,'cert.ext'),'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
 await tool('openssl',['x509','-req','-in',join(o.root,'server.csr'),'-CA',ca,'-CAkey',join(o.root,'ca.key'),'-CAcreateserial','-out',cert,'-days','2','-extfile',join(o.root,'cert.ext')]);
 const started:{root:string;port:number}[]=[];const pools:Pool[]=[];
 const target=(port:number,db='phase3_synthetic',user='postgres',pw=password):DatabaseTarget=>({url:`postgresql://${user}:${pw}@127.0.0.1:${port}/${db}`,caFile:ca});
 // Canary helpers intentionally hold one control transaction while another
 // connection verifies it. Only this disposable fixture owner needs two slots;
 // operational migration/backup clients retain their production max-one cap.
 // Canonical fixture digests must not vary with which control connection a
 // pool leases after projection() has normalized one session's timezone.
 const pool=(t:DatabaseTarget,runtime=false)=>{const p=new Pool({...databaseConfig(runtime?'runtime':'migration',{NODE_ENV:'test',DATABASE_URL:t.url,MIGRATION_DATABASE_URL:t.url,DATABASE_CA_FILE:t.caFile,MIGRATION_DATABASE_CA_FILE:t.caFile}),max:2,options:'-c timezone=UTC'});p.on('error',()=>{});pools.push(p);return p;};
 const ctl=(root:string,action:'start'|'stop')=>{execFileSync(executable('pg_ctl'),['-D',join(root,'data'),...(action==='start'?['-l',join(root,'server.log')]:['-m','fast']),'-w',action],{env,windowsHide:true,stdio:'ignore',timeout:30000});};
 async function cluster(name:string,port:number){
  const probe=new Pool({host:'127.0.0.1',port,user:'isolated-port-probe',database:'postgres',connectionTimeoutMillis:500});try{await probe.connect();throw Error('ISOLATED_PORT_OCCUPIED');}catch(e){assert.equal((e as {code:string}).code,'ECONNREFUSED');}finally{await probe.end();}
  const root=join(o.root,name);secureDirectory(root);writeFileSync(join(root,'created-for-isolated-verification.marker'),ISOLATED_MARKER,{flag:'wx'});const pw=join(root,'bootstrap');writeFileSync(pw,password,{flag:'wx',mode:0o600});
  await tool(executable('initdb'),['-D',join(root,'data'),'-U','postgres','--pwfile='+pw,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--data-checksums','--no-instructions']);
  writeFileSync(join(root,'data/postgresql.conf'),readFileSync(join(root,'data/postgresql.conf'),'utf8')+`\nlisten_addresses='127.0.0.1'\nunix_socket_directories='${process.platform==='win32'?'':root.replaceAll('\\','/')}'\nport=${port}\nssl=on\nssl_min_protocol_version='TLSv1.3'\nssl_cert_file='${cert.replaceAll('\\','/')}'\nssl_key_file='${key.replaceAll('\\','/')}'\nlog_statement='none'\nlog_min_error_statement='panic'\nmax_connections=30\nsuperuser_reserved_connections=3\nreserved_connections=2\n`);
  ctl(root,'start');started.push({root,port});const admin=pool(target(port,'postgres'));await admin.query('CREATE DATABASE phase3_synthetic');return {root,admin:pool(target(port)),port};
 }
 let historicalResult:unknown,sourceSnapshotResult:unknown,sourceAuth:unknown,timetable:unknown,lifecycle:unknown,browser:unknown;
 try{
  const a=await cluster('source',55435),b=await cluster('target',55436);console.log(JSON.stringify({stage:'two isolated TLS PostgreSQL clusters ready',productionConnected:false}));
  const ac=await a.admin.connect();try{await executeReviewedMigrations(ac,'0001');await ac.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN');await ac.query(readFileSync('operations/runtime-role.PROPOSED.sql','utf8'));await ac.query(`ALTER ROLE koonpinai_runtime PASSWORD '${runtimePassword}'`);}finally{ac.release();}
  const ar=pool(target(a.port,'phase3_synthetic','koonpinai_runtime',runtimePassword),true);
  sourceAuth=await runIsolatedCanary(a.admin,ar,a.root,()=>pool(target(a.port,'phase3_synthetic','koonpinai_runtime',runtimePassword),true));
  const another=pool(target(a.port,'phase3_synthetic','koonpinai_runtime',runtimePassword),true);timetable=await rehearseStudentTimetables(a.admin,another,a.root);
  const id=randomUUID();await a.admin.query("INSERT INTO public.members(id,oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status) VALUES($1,'https://sso.kmitl.ac.th/realms/kmitl',$2,'Fictional portable student','Fixture','Synthetic',now(),$3,now(),'approved')",[id,'portable-fixture-'+randomUUID(),POLICY_VERSION]);
  const repo=createTimetableRepository(drizzle(another));let saved=await repo.saveTerm(id,{name:'Semester 1 / 2569',start:'2026-08-01',end:'2026-12-31',revision:0});
  for(const [start,end] of [['08:45','10:15'],['10:30','12:00']])saved=await repo.saveEntry(id,{name:'วิชาตัวอย่าง',code:'',room:'E-204',section:'101',day:5,start,end,revision:saved.revision});
  const operation=join(o.root,'operator');secureDirectory(operation);for(const [name,value] of [['runtime-password',runtimePassword],['migration-password',migrationPassword],['url',target(b.port).url]])writeFileSync(join(operation,name),value,{flag:'wx',mode:0o600});
  const config=join(operation,'config.json');writeFileSync(config,JSON.stringify({version:1,kind:'self-hosted',urlFile:join(operation,'url'),caFile:ca,expectedHost:'127.0.0.1',expectedPort:b.port,expectedDatabase:'phase3_synthetic',expectedRole:'postgres',pgBin:o.bin,runtimePasswordFile:join(operation,'runtime-password'),migrationPasswordFile:join(operation,'migration-password')}),{flag:'wx',mode:0o600});
  await tool(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/portable-database.ts','bootstrap','--config='+config,'--approve-target=phase3_synthetic']);checks.push('Exact bootstrap CLI creates only independent admin/migrator/runtime access; distinct SCRAM credentials');
  console.log(JSON.stringify({stage:'source authorization and migration regressions passed; testing portable recovery',productionConnected:false}));const backupKey=join(o.keyRoot,'backup.key');generateBackupKey(backupKey);
  const archive=await backup({source:target(a.port),bin:o.bin,outputRoot:o.archiveRoot,keyFile:backupKey,repoRoot:process.cwd(),reason:'isolated'});
  await replicateBackup({source:archive.directory,replicaRoot:join(o.archiveRoot,'isolated-replica'),keyFile:backupKey,repoRoot:process.cwd()});checks.push('Encrypted replica copy and authentication checks pass; isolated copy does not claim off-VM delivery');
  const recoveredKey=join(o.keyRoot,'recovered-key');copyFileSync(backupKey,recoveredKey);const restored=await restore({target:target(b.port),bin:o.bin,backupDir:archive.directory,keyFile:recoveredKey,workRoot:join(o.root,'work'),expectedDatabase:'phase3_synthetic',expectedDataDirectory:join(b.root,'data'),approveEmptyTarget:true});assert.equal(restored.status,'PASS');
  checks.push('Consistent snapshot encrypted backup restores all four application tables, every column and exact ledger/schema using separately delivered portable key');
  const bc=await b.admin.connect();try{await configureAccess(bc);await verifyAccess(bc);await assert.rejects(restore({target:target(b.port),bin:o.bin,backupDir:archive.directory,keyFile:backupKey,workRoot:join(o.root,'work'),expectedDatabase:'phase3_synthetic',approveEmptyTarget:true}));assert.equal((await projection(bc)).schemaHash,archive.manifest.projection.schemaHash);}finally{bc.release();}
  checks.push('Scoped grant/ownership reconstruction preserves RLS/policies; second restore into non-empty target fails before writes');
  const br=pool(target(b.port,'phase3_synthetic','koonpinai_runtime',runtimePassword),true);assert.equal((await br.query('SELECT current_user role')).rows[0].role,'koonpinai_runtime');
  await assert.rejects(br.query('CREATE TABLE public.denied(id int)'));await assert.rejects(br.query('SELECT * FROM drizzle.__drizzle_migrations'));await assert.rejects(br.query('TRUNCATE public.members'));
  assert.equal((await b.admin.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN('anon','authenticated','service_role','supabase_admin')")).rows[0].n,0);checks.push('No provider roles imported; runtime has no DDL, ledger, truncation, role management or owner privileges');
  ctl(b.root,'stop');await new Promise(r=>setTimeout(r,100));ctl(b.root,'start');assert.equal((await br.query('SELECT current_user role')).rows[0].role,'koonpinai_runtime');const c=await b.admin.connect();try{assert.deepEqual((await projection(c)).tables,archive.manifest.projection.tables);}finally{c.release();}checks.push('PostgreSQL restart preserves full data and the existing runtime pool acquires a new verified TLS connection');
  console.log(JSON.stringify({stage:'runtime-lifecycle',productionConnected:false}));
  const life=join(o.root,'lifecycle');secureDirectory(life);lifecycle=await rehearseRuntime({owner:b.admin,config:databaseConfig('runtime',{NODE_ENV:'test',DATABASE_URL:target(b.port,'phase3_synthetic','koonpinai_runtime',runtimePassword).url,DATABASE_CA_FILE:ca}),url:target(b.port,'phase3_synthetic','koonpinai_runtime',runtimePassword).url,caFile:ca,root:b.root,secretRoot:life,artifact:o.artifact,rollbackArtifact:o.rollbackArtifact??o.artifact,selfHosted:true});
  console.log(JSON.stringify({stage:'server-action-browser',productionConnected:false}));
  const browserSecrets=join(o.root,'browser-secrets');secureDirectory(browserSecrets);browser=await rehearseStudentBrowser({owner:b.admin,root:b.root,secretRoot:browserSecrets,artifact:o.artifact,url:target(b.port,'phase3_synthetic','koonpinai_runtime',runtimePassword).url,caFile:ca,selfHosted:true});
  const forged=join(o.archiveRoot,'tampered');secureDirectory(forged);copyFileSync(join(archive.directory,'manifest.json'),join(forged,'manifest.json'));const bytes=readFileSync(join(archive.directory,'application.dump.enc'));bytes[bytes.length-20]^=1;writeFileSync(join(forged,'application.dump.enc'),bytes);await assert.rejects(verifyBackup(forged,backupKey));checks.push('Tampered ciphertext is rejected before decryption or database restore');
  if(o.historical){
   assert.equal(hash(o.historical.bytes),o.historical.sha256);await b.admin.query('CREATE DATABASE historical_restored');const t=target(b.port,'historical_restored');
   const toc=await pgTool(o.bin,'pg_restore',['--list'],undefined,false,o.historical.bytes);const list=join(o.root,'historical.list');writeFileSync(list,toc.split('\n').filter(l=>!/^\d+;.* SCHEMA - public /.test(l)).join('\n'),{flag:'wx',mode:0o600});
   await pgTool(o.bin,'pg_restore',['--single-transaction','--exit-on-error','--no-owner','--no-acl','--use-list='+list,'--dbname=historical_restored'],t,false,o.historical.bytes);
   const h=pool(t),hc=await h.connect();try{
    await hc.query("SET TIME ZONE 'UTC'");for(const e of o.historical.records){assert.ok(['members','application_sessions'].includes(e.table));const row=(await hc.query(`SELECT count(*)::text rows,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) digest FROM public.${e.table} t`)).rows[0];assert.equal(row.rows,e.rows);assert.equal(row.digest,e.digest);}
    assert.deepEqual((await projection(hc)).ledger,o.historical.ledger);await configureAccess(hc);await verifyAccess(hc);
    const portable=await backup({source:t,bin:o.bin,outputRoot:join(o.archiveRoot,'historical'),keyFile:backupKey,repoRoot:process.cwd(),reason:'pre-migration'});
    await b.admin.query('CREATE DATABASE historical_independent');await restore({target:target(b.port,'historical_independent'),bin:o.bin,backupDir:portable.directory,keyFile:recoveredKey,workRoot:join(o.root,'historical-work'),expectedDatabase:'historical_independent',expectedDataDirectory:join(b.root,'data'),approveEmptyTarget:true});
    const before=(await projection(hc)).tables;const migration=pool(target(b.port,'historical_restored','koonpinai_migrator',migrationPassword));const mc=await migration.connect();try{assert.equal(await executeReviewedMigrations(mc,'0002'),1);}finally{mc.release();}
    const after=(await projection(hc)).tables;for(const table of ['public.members','public.application_sessions'])assert.deepEqual(after[table],before[table]);historicalResult={status:'PASS',members:before['public.members'].count,sessions:before['public.application_sessions'].count,allRecordDigestsMatchApprovedBackup:true,independentPortableRestore:true,isolated0002Applied:true,accountRecordsUnchanged:true,liveSourceSnapshot:false};
   }finally{hc.release();}
  }
  if(o.sourcePortable){
   const manifest=await verifyBackup(o.sourcePortable.directory,o.sourcePortable.keyFile);
   await b.admin.query('CREATE DATABASE source_snapshot_restored');const t=target(b.port,'source_snapshot_restored');
   await restore({target:t,bin:o.bin,backupDir:o.sourcePortable.directory,keyFile:o.sourcePortable.keyFile,workRoot:join(o.root,'source-snapshot-work'),expectedDatabase:'source_snapshot_restored',expectedDataDirectory:join(b.root,'data'),approveEmptyTarget:true});
   const p=pool(t),c=await p.connect();try{
    const before=await projection(c);assert.deepEqual(before.tables,manifest.projection.tables);await configureAccess(c);await verifyAccess(c);
    const mp=pool(target(b.port,'source_snapshot_restored','koonpinai_migrator',migrationPassword)),mc=await mp.connect();try{assert.equal(await executeReviewedMigrations(mc,'0002'),manifest.projection.ledger.length===2?1:0);}finally{mc.release();}
    const after=await projection(c);for(const name of Object.keys(before.tables).filter(n=>n!=='drizzle.__drizzle_migrations'))assert.deepEqual(after.tables[name],before.tables[name]);assert.equal(after.ledger.length,3);
    sourceSnapshotResult={status:'PASS',createdAt:manifest.createdAt,members:before.tables['public.members'].count,sessions:before.tables['public.application_sessions'].count,allRecordDigestsMatch:true,schemaAndLedgerMatch:true,independentPortableKey:true,isolated0002Applied:before.ledger.length===2,accountRecordsUnchanged:true,productionConnected:false};
   }finally{c.release();}
  }
  console.log(JSON.stringify({stage:'fresh-migration-rls',productionConnected:false}));
  await b.admin.query('CREATE DATABASE fresh_install');
  const fresh=pool(target(b.port,'fresh_install')),fc=await fresh.connect();try{
   await fc.query('REVOKE ALL ON DATABASE fresh_install FROM PUBLIC; GRANT CONNECT,CREATE ON DATABASE fresh_install TO koonpinai_migrator; REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE,CREATE ON SCHEMA public TO koonpinai_migrator');
   const migrator=pool(target(b.port,'fresh_install','koonpinai_migrator',migrationPassword)),mc=await migrator.connect();try{assert.equal(await executeReviewedMigrations(mc,'0002'),3);assert.equal(await executeReviewedMigrations(mc,'0002'),0);}finally{mc.release();}
   await configureAccess(fc);await verifyAccess(fc);
   const check=await migrator.connect();try{
    await check.query('BEGIN; CREATE TABLE public.permission_probe(id int); CREATE FUNCTION public.permission_probe_fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$');
    assert.equal((await check.query("SELECT has_table_privilege('koonpinai_runtime','public.permission_probe','SELECT') unsafe_table,has_function_privilege('koonpinai_runtime','public.permission_probe_fn()','EXECUTE') unsafe_function")).rows[0].unsafe_table,false);
    assert.equal((await check.query("SELECT has_function_privilege('koonpinai_runtime','public.permission_probe_fn()','EXECUTE') unsafe")).rows[0].unsafe,false);
   }finally{await check.query('ROLLBACK');check.release();}
   const marker='kp-stage-'+randomUUID().replaceAll('-','').slice(0,12),f=stagingFixtureSchema.parse({marker,project:marker+'-source',members:Array.from({length:3},()=>randomUUID()),sessions:Array.from({length:3},()=>randomUUID()),runtimeUrlFile:'unused-native-fixture'});
   await fc.query(`COMMENT ON DATABASE fresh_install IS '${marker}'`);
   await assert.rejects(requireSyntheticDatabase(fc,{...f,marker:'kp-stage-000000000000',project:'kp-stage-000000000000-source'}));
   const syntheticRuntime=pool(target(b.port,'fresh_install','koonpinai_runtime',runtimePassword),true);
   assert.equal((await exerciseSyntheticAccounts(fc,syntheticRuntime,f)).status,'PASS');
   await assert.rejects(cleanupSyntheticAccounts(fc,{...f,sessions:[randomUUID(),...f.sessions.slice(1)]}));
   assert.equal((await fc.query('SELECT count(*)::int n FROM public.members')).rows[0].n,3);
   assert.equal((await cleanupSyntheticAccounts(fc,f)).status,'PASS');
   await assert.rejects(cleanupSyntheticAccounts(fc,f));
  }finally{fc.release();}
  checks.push('Fresh install applies all three migrations as non-superuser migrator; repeat is a no-op; future tables/functions grant no PUBLIC runtime access');
  checks.push('Exact Compose probe exercised natively over TLS1.3: marker/mutation/cleanup guards, profile/session/policy/admin and owner-only CRUD pass');
  const report={status:'PASS',at:new Date().toISOString(),checks,sourceAuth,timetable,lifecycle,browser,historical:historicalResult??{status:'NOT_REQUESTED'},sourceSnapshot:sourceSnapshotResult??{status:'NOT_REQUESTED'},root:o.root,portableArchiveRoot:o.archiveRoot,backupKeyDirectory:o.keyRoot,productionConnected:false,externalOidc:'mocked/synthetic',docker:false,sourceAndTargetClustersIndependent:true};
  writeFileSync(join(o.root,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});return report;
 }finally{for(const p of pools)if(!p.ended)await p.end();for(const c of started.reverse())try{ctl(c.root,'stop');}catch{throw Error('ISOLATED_CLUSTER_STOP_FAILED');}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const arg=(k:string)=>process.argv.find(s=>s.startsWith(k+'='))?.slice(k.length+1),bin=arg('--pg-bin'),artifact=arg('--artifact');
 if(!process.argv.includes('--approve-isolated-writes')||!bin||!artifact){console.error('Explicit isolated-write approval, existing PostgreSQL binaries and a built artifact are required.');process.exitCode=1;}
 else{const id=randomUUID(),root=join(tmpdir(),'koonpinai-selfhost-'+id);void rehearseSelfhost({bin:resolve(bin),artifact:resolve(artifact),root,archiveRoot:join(tmpdir(),'koonpinai-portable-archives-'+id),keyRoot:join(tmpdir(),'koonpinai-portable-keys-'+id)}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:databaseErrorCode(e),evidence:rehearsalErrorEvidence(e)}));process.exitCode=1;});}
}
