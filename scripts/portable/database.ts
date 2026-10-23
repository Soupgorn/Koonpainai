import {Pool,type PoolClient,type PoolConfig} from 'pg';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,unlinkSync,copyFileSync,constants} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {TLSSocket} from 'node:tls';
import {databaseConfig} from '../../src/db/connection';
import {migrationFiles,verifyMigrationLedger} from '../../src/db/migrations';
import {osEnvironment} from '../../runtime/secrets.mjs';
import {assertSeparatedKey,encryptFile,decryptFile,fileHash,readKey,keyId,signManifest,verifyManifest,hash,outside} from './crypto';
import {secureDirectory} from './permissions';

export const applicationTables=['public.members','public.application_sessions','public.student_timetables','public.timetable_entries','drizzle.__drizzle_migrations'] as const;
export type Projection={tables:Record<string,{count:number;sha256:string}>;ledger:{hash:string;created_at:string|number}[];schemaHash:string;serverMajor:number};
export type DatabaseTarget={url:string;caFile:string};
export function poolConfig(t:DatabaseTarget):PoolConfig{return {...databaseConfig('migration',{NODE_ENV:'production',MIGRATION_DATABASE_URL:t.url,MIGRATION_DATABASE_CA_FILE:t.caFile}),max:1};}
export function pgEnvironment(t:DatabaseTarget,readonly:boolean):NodeJS.ProcessEnv{const cfg=poolConfig(t);return {...osEnvironment(),NODE_ENV:'production',PGHOST:cfg.host,PGPORT:String(cfg.port),PGUSER:cfg.user,PGDATABASE:String(cfg.database),PGPASSWORD:String(cfg.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve(t.caFile),PGCONNECT_TIMEOUT:'5',PGAPPNAME:'koonpinai-portable-tools',PGOPTIONS:`-c statement_timeout=120000 -c lock_timeout=5000${readonly?' -c default_transaction_read_only=on':''}`};}
export async function pgTool(bin:string,tool:'pg_dump'|'pg_restore',args:string[],target?:DatabaseTarget,readonly=false,input?:Buffer):Promise<string>{
 return new Promise((ok,fail)=>{const child=spawn(join(bin,tool+(process.platform==='win32'?'.exe':'')),args,{env:target?pgEnvironment(target,readonly):{...osEnvironment(),NODE_ENV:'production'},windowsHide:true,stdio:['pipe','pipe','pipe']});let text='';const timer=setTimeout(()=>{child.kill();fail(Error('POSTGRES_TOOL_TIMEOUT'));},120000);child.stdout.on('data',b=>{if(text.length<2e6)text+=b.toString();});child.stderr.resume();child.stdin.on('error',()=>{});child.stdin.end(input);child.on('error',()=>{clearTimeout(timer);fail(Error('POSTGRES_TOOL_START_FAILED'));});child.on('exit',code=>{clearTimeout(timer);if(code===0)ok(text);else fail(Error('POSTGRES_TOOL_FAILED'));});});
}
export async function connected(t:DatabaseTarget){const pool=new Pool(poolConfig(t));let c:PoolClient|undefined;try{c=await pool.connect();if(!(c.connection.stream instanceof TLSSocket)||!c.connection.stream.authorized)throw Error('DATABASE_TLS_UNVERIFIED');return {pool,client:c};}catch(e){c?.release(true);await pool.end();throw e;}}
/** Full-row canonical JSONB digests, including private fields, never their values.
 * Schema fingerprint excludes ownership and ACLs: those are rebuilt/reviewed for the new host. */
export async function projection(c:PoolClient):Promise<Projection>{
 // JSONB timestamptz serialization follows the session timezone. Canonical
 // digests must not depend on the source/target host's local timezone.
 await c.query("SET TIME ZONE 'UTC'");
 const relations=(await c.query("SELECT n.nspname||'.'||cl.relname name FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname IN ('public','drizzle') AND cl.relkind IN ('r','p','v','m','f') ORDER BY 1")).rows.map(r=>r.name);
 if(relations.some(r=>!(applicationTables as readonly string[]).includes(r))||!relations.includes('public.members')||!relations.includes('public.application_sessions')||!relations.includes('drizzle.__drizzle_migrations'))throw Error('UNEXPECTED_APPLICATION_SCHEMA');
 const extra=(await c.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','drizzle') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')")).rows[0].n;
 if(extra)throw Error('UNREVIEWED_APPLICATION_ROUTINES');
 const tables:Projection['tables']={};
 for(const name of relations){const [schema,table]=name.split('.');const r=(await c.query(`SELECT count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C")::text,'[]'),'UTF8')),'hex') sha256 FROM "${schema}"."${table}" t`)).rows[0];tables[name]=r;}
 const ledger=(await c.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id')).rows;verifyMigrationLedger(migrationFiles(),ledger);
 const catalog=(await c.query(`SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(x ORDER BY x::text COLLATE "C") FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema IN ('public','drizzle')) x),
 'constraints',(SELECT jsonb_agg(x ORDER BY x::text COLLATE "C") FROM (SELECT n.nspname,c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid) definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','drizzle')) x),
 'indexes',(SELECT jsonb_agg(x ORDER BY x::text COLLATE "C") FROM (SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','drizzle')) x),
 'enums',(SELECT jsonb_agg(x ORDER BY x::text COLLATE "C") FROM (SELECT n.nspname,t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') x),
 'policies',(SELECT jsonb_agg(x ORDER BY x::text COLLATE "C") FROM (SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public') x),
 'rls',(SELECT jsonb_agg(x ORDER BY x::text COLLATE "C") FROM (SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle') AND c.relkind='r') x)) value`)).rows[0].value;
 return {tables,ledger,schemaHash:hash(JSON.stringify(catalog)),serverMajor:Math.floor(Number((await c.query('SHOW server_version_num')).rows[0].server_version_num)/10000)};
}
type BackupManifest={format:1;id:string;createdAt:string;reason:'scheduled'|'pre-migration'|'isolated';keyId:string;archive:string;cipherSha256:string;plainSha256:string;projection:Projection};
export async function backup(o:{source:DatabaseTarget;bin:string;outputRoot:string;keyFile:string;repoRoot:string;reason:BackupManifest['reason']}){
 assertSeparatedKey(o.keyFile,o.outputRoot,o.repoRoot);const key=readKey(o.keyFile),id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),dir=join(o.outputRoot,id);
 secureDirectory(o.outputRoot);secureDirectory(dir);
 const dump=join(dir,'application.partial.dump'),encrypted=join(dir,'application.dump.enc');const {pool,client:c}=await connected(o.source);
 try{
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='120s'; SET LOCAL idle_in_transaction_session_timeout='180s'; SET LOCAL TIME ZONE 'UTC'");
  const summary=await projection(c);if(summary.serverMajor!==17)throw Error('POSTGRES_MAJOR_REVIEW_REQUIRED');
  const snapshot=(await c.query('SELECT pg_export_snapshot() snapshot')).rows[0].snapshot;
  if(!/^[0-9A-F-]+$/.test(snapshot))throw Error('SNAPSHOT_INVALID');
  await pgTool(o.bin,'pg_dump',['--format=custom','--schema=public','--schema=drizzle','--no-owner','--no-acl','--no-security-labels','--strict-names','--no-password','--snapshot='+snapshot,'--file='+dump],o.source,true);
  await c.query('COMMIT');
  const plainSha256=await fileHash(dump),cipherSha256=await encryptFile(dump,encrypted,key);await pgTool(o.bin,'pg_restore',['--list',dump]);
  const manifest:BackupManifest={format:1,id,createdAt:new Date().toISOString(),reason:o.reason,keyId:keyId(key),archive:basename(encrypted),cipherSha256,plainSha256,projection:summary};
  writeFileSync(join(dir,'manifest.json'),JSON.stringify({manifest,signature:signManifest(manifest,key)},null,2)+'\n',{flag:'wx',mode:0o600});return {directory:dir,manifest};
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();await pool.end();key.fill(0);if(existsSync(dump))unlinkSync(dump);}
}
export async function verifyBackup(dir:string,keyFile:string){
 if(!outside(keyFile,dir))throw Error('BACKUP_KEY_MUST_BE_SEPARATE');const key=readKey(keyFile);
 try{const envelope=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));verifyManifest(envelope.manifest,envelope.signature,key);const m=envelope.manifest as BackupManifest;if(m.format!==1||m.archive!=='application.dump.enc'||m.keyId!==keyId(key)||!/^[a-f0-9]{64}$/.test(m.plainSha256)||!/^[a-f0-9]{64}$/.test(m.cipherSha256)||!m.id||!m.projection)throw Error('BACKUP_MANIFEST_INVALID');if(await fileHash(join(dir,m.archive))!==m.cipherSha256)throw Error('BACKUP_CHECKSUM_MISMATCH');return m;}finally{key.fill(0);}
}
export async function restore(o:{target:DatabaseTarget;bin:string;backupDir:string;keyFile:string;workRoot:string;expectedDatabase:string;expectedDataDirectory?:string;approveEmptyTarget:boolean}){
 if(!o.approveEmptyTarget)throw Error('EMPTY_RESTORE_TARGET_APPROVAL_REQUIRED');if(!outside(o.keyFile,o.workRoot)||resolve(o.workRoot)===resolve(o.backupDir))throw Error('RESTORE_WORKSPACE_INVALID');
 const manifest=await verifyBackup(o.backupDir,o.keyFile),{pool,client:c}=await connected(o.target);secureDirectory(o.workRoot);const work=join(o.workRoot,'restore-'+randomUUID());secureDirectory(work);const dump=join(work,'application.dump');
 try{
  const identity=(await c.query("SELECT current_database() database,current_user role,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) admin,current_setting('data_directory') data_directory")).rows[0];
  if(identity.database!==o.expectedDatabase||!identity.admin||(o.expectedDataDirectory&&resolve(identity.data_directory)!==resolve(o.expectedDataDirectory)))throw Error('RESTORE_TARGET_IDENTITY_MISMATCH');
  if((await c.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p','v','m','S')")).rows[0].n)throw Error('RESTORE_TARGET_NOT_EMPTY');
  const key=readKey(o.keyFile);try{if(await decryptFile(join(o.backupDir,manifest.archive),dump,key)!==manifest.plainSha256)throw Error('BACKUP_PLAINTEXT_CHECKSUM_MISMATCH');}finally{key.fill(0);}
  // public already exists in a newly created database. Omit only its CREATE entry;
  // retain every table, sequence, type, FK, index, policy and ledger/data item.
  const toc=await pgTool(o.bin,'pg_restore',['--list',dump]);
  const list=join(work,'restore.list');writeFileSync(list,toc.split('\n').filter(l=>!/^\d+;.* SCHEMA - public /.test(l)).join('\n'),{flag:'wx',mode:0o600});
  await pgTool(o.bin,'pg_restore',['--single-transaction','--exit-on-error','--no-owner','--no-acl','--no-security-labels','--no-password','--use-list='+list,'--dbname='+o.expectedDatabase,dump],o.target);
  const actual=await projection(c);if(JSON.stringify(actual.tables)!==JSON.stringify(manifest.projection.tables))throw Error('RESTORE_TABLE_DIGEST_MISMATCH');if(actual.schemaHash!==manifest.projection.schemaHash)throw Error('RESTORE_SCHEMA_MISMATCH');if(JSON.stringify(actual.ledger)!==JSON.stringify(manifest.projection.ledger))throw Error('RESTORE_LEDGER_MISMATCH');
  return {status:'PASS',tables:actual.tables,schemaHash:actual.schemaHash,ledgerEntries:actual.ledger.length};
 }finally{if(existsSync(dump))unlinkSync(dump);c.release();await pool.end();}
}
/** Retention is deliberately a plan. Never deletes historical DPAPI backups or
 * an archive until an operator has verified off-VM copies and approved pruning. */
export function retentionPlan(records:{id:string;createdAt:string;reason:string}[],now=new Date(),policy={daily:7,weekly:4,monthly:3}){
 if(Object.values(policy).some(n=>!Number.isInteger(n)||n<1||n>1000)||records.some(r=>!Number.isFinite(Date.parse(r.createdAt))))throw Error('RETENTION_POLICY_OR_RECORD_INVALID');
 const keep=new Set<string>(),ordered=[...records].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const select=(limit:number,key:(s:string)=>string)=>{const groups=new Set<string>();for(const r of ordered){const k=key(r.createdAt);if(groups.size<limit||groups.has(k)){if(!groups.has(k))keep.add(r.id);groups.add(k);}}};
 select(policy.daily,s=>s.slice(0,10));select(policy.weekly,s=>{const d=new Date(s);const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10);});select(policy.monthly,s=>s.slice(0,7));
 for(const r of ordered)if(r.reason==='pre-migration'||new Date(r.createdAt)>now)keep.add(r.id);
 return {keep:[...keep],candidates:ordered.filter(r=>!keep.has(r.id)).map(r=>r.id),deletionExecuted:false};
}
export async function replicateBackup(o:{source:string;replicaRoot:string;keyFile:string;repoRoot:string}){
 if(!outside(o.replicaRoot,o.repoRoot)||!outside(o.keyFile,o.replicaRoot)||resolve(o.replicaRoot)===resolve(o.source))throw Error('EXTERNAL_REPLICA_REQUIRED');
 const manifest=await verifyBackup(o.source,o.keyFile);if(!/^[0-9TZ-]+-[a-f0-9]{8}$/.test(manifest.id))throw Error('BACKUP_ID_INVALID');
 secureDirectory(o.replicaRoot);const destination=join(o.replicaRoot,manifest.id);secureDirectory(destination);for(const name of ['application.dump.enc','manifest.json'])copyFileSync(join(o.source,name),join(destination,name),constants.COPYFILE_EXCL);await verifyBackup(destination,o.keyFile);
 return {replicaVerified:true,offVmLocationRequiresOperatorConfirmation:true};
}
