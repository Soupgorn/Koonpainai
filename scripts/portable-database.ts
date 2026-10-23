// Explicit file-based operational configuration. Never loads dotenv or web secrets.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {pbkdf2Sync,createHmac,createHash,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {backup,restore,verifyBackup,replicateBackup,connected,projection,retentionPlan,type DatabaseTarget} from './portable/database';
import {generateBackupKey,outside} from './portable/crypto';
import {assertPrivatePath,secureDirectory} from './portable/permissions';
import {configureAccess,verifyAccess} from './portable/access';
import {executeReviewedMigrations} from '../src/db/migrations';
import {databaseErrorCode} from '../src/db/connection';

const configSchema=z.object({version:z.literal(1),kind:z.enum(['source-readonly','self-hosted']),urlFile:z.string(),caFile:z.string(),expectedHost:z.string(),expectedPort:z.number().int().min(1).max(65535),expectedDatabase:z.string().regex(/^[a-zA-Z0-9_]+$/),expectedRole:z.string(),pgBin:z.string(),backupRoot:z.string().optional(),replicaRoot:z.string().optional(),keyFile:z.string().optional(),workRoot:z.string().optional(),runtimePasswordFile:z.string().optional(),migrationPasswordFile:z.string().optional()}).strict();
export function readOperationalConfig(file:string){assertPrivatePath(file);assertPrivatePath(dirname(file));const c=configSchema.parse(JSON.parse(readFileSync(file,'utf8')));assertPrivatePath(c.urlFile);const value=readFileSync(c.urlFile,'utf8').trim();const u=new URL(value);if(u.hostname!==c.expectedHost||Number(u.port||5432)!==c.expectedPort||decodeURIComponent(u.pathname.slice(1))!==c.expectedDatabase||decodeURIComponent(u.username)!==c.expectedRole||!u.password)throw Error('OPERATIONAL_TARGET_MISMATCH');if(c.kind==='self-hosted'&&(/supabase\.(com|co)$/.test(u.hostname)||c.expectedRole==='koonpinai_runtime'))throw Error('OPERATIONAL_TARGET_MISMATCH');return {...c,target:{url:value,caFile:c.caFile} satisfies DatabaseTarget};}
function scram(password:string){const salt=randomBytes(16),salted=pbkdf2Sync(password,salt,4096,32,'sha256'),client=createHmac('sha256',salted).update('Client Key').digest(),stored=createHash('sha256').update(client).digest(),server=createHmac('sha256',salted).update('Server Key').digest();salted.fill(0);client.fill(0);return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored.toString('base64')}:${server.toString('base64')}`;}
async function main(){
 const command=process.argv[2],arg=(k:string)=>process.argv.find(s=>s.startsWith(k+'='))?.slice(k.length+1);
 if(command==='keygen'){const file=arg('--key-file');if(!file||!outside(file,process.cwd()))throw Error('EXTERNAL_KEY_FILE_REQUIRED');secureDirectory(dirname(file));generateBackupKey(file);console.log('Portable backup key created in the external private directory.');return;}
 const file=arg('--config');if(!file)throw Error('EXPLICIT_OPERATIONAL_CONFIG_REQUIRED');const c=readOperationalConfig(file);
 if(['bootstrap','migrate','restore','access'].includes(command??'')){
  if(c.kind!=='self-hosted'||arg('--approve-target')!==c.expectedDatabase)throw Error('EXPLICIT_SELF_HOSTED_TARGET_APPROVAL_REQUIRED');
 }
 if(command==='backup'){
  if(!c.backupRoot||!c.keyFile)throw Error('BACKUP_CONFIGURATION_REQUIRED');const reason=arg('--reason')??'scheduled';if(!['scheduled','pre-migration','isolated'].includes(reason))throw Error('BACKUP_REASON_INVALID');
  if(reason!=='isolated'&&!c.replicaRoot)throw Error('BACKUP_REPLICA_CONFIGURATION_REQUIRED');
  const b=await backup({source:c.target,bin:c.pgBin,outputRoot:c.backupRoot,keyFile:c.keyFile,repoRoot:process.cwd(),reason:reason as 'scheduled'|'pre-migration'|'isolated'});const replica=c.replicaRoot?await replicateBackup({source:b.directory,replicaRoot:c.replicaRoot,keyFile:c.keyFile,repoRoot:process.cwd()}):undefined;console.log(JSON.stringify({status:'PASS',backup:b.directory,counts:Object.fromEntries(Object.entries(b.manifest.projection.tables).map(([k,v])=>[k,v.count])),encryptedSha256:b.manifest.cipherSha256,replica}));return;
 }
 if(command==='verify'||command==='replicate'){
  if(!c.keyFile||!arg('--backup'))throw Error('BACKUP_AND_KEY_REQUIRED');const source=resolve(arg('--backup')!),m=await verifyBackup(source,c.keyFile);
  if(command==='replicate'){
   const replica=arg('--replica-root');if(!replica)throw Error('EXTERNAL_REPLICA_REQUIRED');console.log(JSON.stringify({status:'PASS',...await replicateBackup({source,replicaRoot:replica,keyFile:c.keyFile,repoRoot:process.cwd()})}));
  }else console.log(JSON.stringify({status:'PASS',id:m.id,encryptedSha256:m.cipherSha256}));return;
 }
 if(command==='retention'){
  if(!c.keyFile||!c.backupRoot)throw Error('BACKUP_CONFIGURATION_REQUIRED');const records=[];for(const d of readdirSync(c.backupRoot,{withFileTypes:true})){if(d.isDirectory()&&!d.isSymbolicLink())records.push(await verifyBackup(join(c.backupRoot,d.name),c.keyFile));}const policy={daily:Number(arg('--daily')??7),weekly:Number(arg('--weekly')??4),monthly:Number(arg('--monthly')??3)};console.log(JSON.stringify(retentionPlan(records,new Date(),policy)));return;
 }
 if(command==='restore'){
  if(!arg('--backup')||!c.keyFile||!c.workRoot||!process.argv.includes('--approve-empty-target'))throw Error('EMPTY_RESTORE_TARGET_APPROVAL_REQUIRED');console.log(JSON.stringify(await restore({target:c.target,bin:c.pgBin,backupDir:arg('--backup')!,keyFile:c.keyFile,workRoot:c.workRoot,expectedDatabase:c.expectedDatabase,approveEmptyTarget:true})));return;
 }
 const {pool,client}=await connected(c.target);
 try{
  if(command==='bootstrap'){
   if(!c.runtimePasswordFile||!c.migrationPasswordFile||c.expectedRole!=='postgres')throw Error('NEW_TARGET_BOOTSTRAP_CONFIGURATION_REQUIRED');
   if((await client.query("SELECT count(*)::int n FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname IN('public','drizzle') AND cl.relkind IN('r','p','S')")).rows[0].n)throw Error('BOOTSTRAP_TARGET_NOT_EMPTY');
   for(const p of [c.runtimePasswordFile,c.migrationPasswordFile])assertPrivatePath(p);const runtime=readFileSync(c.runtimePasswordFile,'utf8').trim(),migration=readFileSync(c.migrationPasswordFile,'utf8').trim();if(runtime.length<43||migration.length<43||runtime===migration||[runtime,migration].some(s=>s===new URL(c.target.url).password))throw Error('UNIQUE_STRONG_ROLE_PASSWORDS_REQUIRED');
   const sql=readFileSync('operations/selfhost/roles.sql','utf8').replace('COMMIT;',`ALTER ROLE koonpinai_runtime PASSWORD '${scram(runtime)}'; ALTER ROLE koonpinai_migrator PASSWORD '${scram(migration)}'; COMMIT;`);await client.query(sql);console.log(JSON.stringify({status:'PASS',newSelfHostedRolesCreated:true}));
  }else if(command==='migrate'){
   if(c.expectedRole!=='koonpinai_migrator')throw Error('DEDICATED_MIGRATION_ROLE_REQUIRED');console.log(JSON.stringify({applied:await executeReviewedMigrations(client,arg('--approve-through'))}));
  }else if(command==='access'){if(c.expectedRole!=='postgres')throw Error('ADMINISTRATIVE_ACCESS_SETUP_REQUIRED');await configureAccess(client);console.log(JSON.stringify(await verifyAccess(client)));}
  else if(command==='audit'){await client.query('BEGIN READ ONLY');try{const p=await projection(client);console.log(JSON.stringify({counts:Object.fromEntries(Object.entries(p.tables).map(([k,v])=>[k,v.count])),schemaHash:p.schemaHash,ledgerEntries:p.ledger.length}));}finally{await client.query('ROLLBACK');}}
  else throw Error('UNKNOWN_OPERATION');
 }finally{client.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:databaseErrorCode(e)}));process.exitCode=1;});
