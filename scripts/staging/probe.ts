// Never a production canary. Requires an explicitly marked, synthetic database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {TLSSocket} from 'node:tls';
import {Pool, type PoolClient} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {z} from 'zod';
import {readOperationalConfig} from '../portable-database';
import {connected, projection} from '../portable/database';
import {assertPrivatePath} from '../portable/permissions';
import {verifyAccess} from '../portable/access';
import {databaseConfig,databaseErrorCode} from '../../src/db/connection';
import {createTimetableRepository} from '../../src/db/timetable-repository';
import {createMemberRepository} from '../../src/db/member-repository';
import {KMITL_ISSUER,POLICY_VERSION,memberGate} from '../../src/lib/auth/domain';

export const stagingFixtureSchema=z.object({marker:z.string().regex(/^kp-stage-[a-f0-9]{12}$/),project:z.string().regex(/^kp-stage-[a-f0-9]{12}-(source|recovery)$/),members:z.array(z.uuid()).length(3),sessions:z.array(z.uuid()).length(3),runtimeUrlFile:z.string()}).strict().refine(f=>f.project.startsWith(f.marker+'-')&&new Set(f.members).size===3&&new Set(f.sessions).size===3);
export type StagingIdentities=z.infer<typeof stagingFixtureSchema>;
export async function requireSyntheticDatabase(c:PoolClient,f:StagingIdentities){
 stagingFixtureSchema.parse(f);
 const marker=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;
 if(marker!==f.marker)throw Error('SYNTHETIC_DATABASE_MARKER_MISMATCH');
 if((await c.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN('supabase_admin','service_role','anon','authenticated')")).rows[0].n)throw Error('PROVIDER_DATABASE_FORBIDDEN');
}
export async function exerciseSyntheticAccounts(c:PoolClient,pool:Pool,f:StagingIdentities){
 await requireSyntheticDatabase(c,f);
 if((await c.query('SELECT count(*)::int n FROM public.members')).rows[0].n!==0)throw Error('EMPTY_SYNTHETIC_ACCOUNTS_REQUIRED');
 const [a,b,pending]=f.members;
 await c.query('BEGIN');try{
  for(let i=0;i<3;i++){
   await c.query("INSERT INTO public.members(id,oidc_issuer,oidc_subject,display_name,nickname,department,profile_completed_at,policy_version,policy_accepted_at,status,role) VALUES($1,$2,$3,'Synthetic staging',$4,'Synthetic only',now(),$5,now(),$6,$7)",[f.members[i],KMITL_ISSUER,f.marker+'-'+i,['Fixture A','Fixture B','Pending fixture'][i],POLICY_VERSION,i===2?'pending':'approved',i===1?'admin':'member']);
   await c.query("INSERT INTO public.application_sessions(id,member_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[f.sessions[i],f.members[i]]);
  }
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}
 const runtime=await pool.connect();try{
  assert.equal((await runtime.query('SELECT current_user role,session_user session')).rows[0].role,'koonpinai_runtime');
  const socket=runtime.connection.stream;assert.ok(socket instanceof TLSSocket&&socket.authorized);assert.equal(socket.getProtocol(),'TLSv1.3');
 }finally{runtime.release();}
 const db=drizzle(pool),members=createMemberRepository(db),timetable=createTimetableRepository(db),checks:string[]=[];
 await members.saveProfile(a,{nickname:'Fixture A',thaiName:'ตัวอย่าง',department:'Synthetic only'});
 await c.query("UPDATE public.members SET policy_version='2026-10-21' WHERE id=$1",[a]);
 await assert.rejects(timetable.getOwn(a));await members.acknowledgePolicy(a,POLICY_VERSION);assert.equal(memberGate((await members.find(a))!),'allowed');
 assert.equal((await members.activeSession(f.sessions[0]))?.id,a);
 checks.push('Restricted profile, policy renewal and revocable session operations; synthetic authentication only');
 await assert.rejects(members.setStatus(a,pending,'approved'));await members.setStatus(b,pending,'approved');assert.equal((await members.find(pending))?.status,'approved');await members.setStatus(b,pending,'pending');
 await assert.rejects(pool.query("UPDATE public.members SET role='admin' WHERE id=$1",[a]),(e:unknown)=>(e as {code?:string}).code==='42501');
 checks.push('Administrator approval works; ordinary approval and database role elevation fail');
 const term={name:'Synthetic semester',start:'2026-01-01',end:'2027-12-31',revision:0};let own=await timetable.saveTerm(a,term);
 for(const [start,end] of [['08:45','10:15'],['10:30','12:00']])own=await timetable.saveEntry(a,{name:'Synthetic Algorithms',code:'',section:'101',room:'E-204',day:5,start,end,revision:own.revision});
 const editable=(entry:typeof own.sessions[number])=>({id:entry.id,name:entry.name,code:entry.code,section:entry.section,room:entry.room,day:entry.day,start:entry.start,end:entry.end});
 own=await timetable.saveEntry(a,{...editable(own.sessions[0]),room:'E-205',revision:own.revision});
 const overlap={name:'Synthetic overlapping seminar',code:'',section:'',room:'',day:5,start:'09:00',end:'09:30',revision:own.revision};await assert.rejects(timetable.saveEntry(a,overlap));own=await timetable.saveEntry(a,{...overlap,allowOverlap:true});
 own=await timetable.deleteEntry(a,{id:own.sessions.find(e=>e.name===overlap.name)!.id,revision:own.revision});
 const peer=await timetable.saveTerm(b,term);await assert.rejects(timetable.saveEntry(b,{...editable(own.sessions[0]),revision:peer.revision}));await assert.rejects(timetable.deleteEntry(b,{id:own.sessions[0].id,revision:peer.revision}));
 const privateTerm=await timetable.saveTerm(pending,term);await timetable.saveEntry(pending,{name:'Private pending class',code:'',section:'',room:'',day:1,start:'13:00',end:'16:00',revision:privateTerm.revision});
 const shared=await timetable.listShared(b);assert.ok(shared.some(p=>p.id===a));assert.ok(!shared.some(p=>p.id===pending));assert.deepEqual((await timetable.getOwn(a))?.sessions.map(e=>[e.start,e.end]),[['08:45','10:15'],['10:30','12:00']]);
 await members.revokeSession(f.sessions[2]);assert.equal(await members.activeSession(f.sessions[2]),null);
 checks.push('Persistent timetable Add/Edit/Delete, exact Friday times, overlap consent, pending privacy and administrator cross-owner denial');
 await verifyAccess(c);return {status:'PASS',checks,realOidc:false,syntheticSessions:true,productionConnected:false};
}
export async function cleanupSyntheticAccounts(c:PoolClient,f:StagingIdentities){
 await requireSyntheticDatabase(c,f);await c.query('BEGIN');try{
  const rows=(await c.query('SELECT id,oidc_subject FROM public.members ORDER BY id FOR UPDATE')).rows;
  if(rows.length!==3||rows.some(r=>{const i=f.members.indexOf(r.id);return i<0||r.oidc_subject!==f.marker+'-'+i;}))throw Error('EXACT_SYNTHETIC_CLEANUP_MISMATCH');
  const sessions=(await c.query('SELECT id,member_id FROM public.application_sessions FOR UPDATE')).rows;
  if(sessions.length!==3||sessions.some(r=>f.sessions.indexOf(r.id)<0||f.members[f.sessions.indexOf(r.id)]!==r.member_id))throw Error('EXACT_SYNTHETIC_CLEANUP_MISMATCH');
  await c.query('DELETE FROM public.application_sessions WHERE id=ANY($1::uuid[]) AND member_id=ANY($2::uuid[])',[f.sessions,f.members]);
  assert.equal((await c.query('DELETE FROM public.members WHERE id=ANY($1::uuid[])',[f.members])).rowCount,3);
  assert.equal((await c.query('SELECT count(*)::int n FROM public.timetable_entries')).rows[0].n,0);await c.query('COMMIT');return {status:'PASS',exactFixturesCleaned:true};
 }catch(e){await c.query('ROLLBACK');throw e;}
}
async function main(){
 const operation=process.argv[2];const cfg=readOperationalConfig('/run/operator/admin.json');
 if(process.env.KOONPINAI_SYNTHETIC_STAGING!=='1'||cfg.kind!=='self-hosted'||cfg.expectedRole!=='postgres'||cfg.expectedHost!=='postgres'||cfg.expectedDatabase!=='koonpinai'||cfg.expectedPort!==5432)throw Error('SYNTHETIC_STAGING_CONFIGURATION_REQUIRED');
 assertPrivatePath('/run/operator/fixture.json');const f=stagingFixtureSchema.parse(JSON.parse(readFileSync('/run/operator/fixture.json','utf8')));const {pool,client:c}=await connected(cfg.target);
 try{
  if(operation==='mark'){
   const row=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0];
   if(row.marker!==null||(await c.query("SELECT to_regclass('public.members') present")).rows[0].present)throw Error('NEW_EMPTY_DATABASE_REQUIRED');
   await c.query(`COMMENT ON DATABASE koonpinai IS '${f.marker}'`);console.log(JSON.stringify({status:'PASS',newSyntheticMarker:true}));return;
  }
  await requireSyntheticDatabase(c,f);
  if(operation==='exercise'){
   assertPrivatePath(f.runtimeUrlFile);const runtimeUrl=readFileSync(f.runtimeUrlFile,'utf8').trim(),u=new URL(runtimeUrl);if(u.hostname!=='postgres'||u.port!=='5432'||u.username!=='koonpinai_runtime'||u.pathname!=='/koonpinai')throw Error('SYNTHETIC_RUNTIME_TARGET_MISMATCH');
   const runtime=new Pool(databaseConfig('runtime',{NODE_ENV:'test',DATABASE_URL:runtimeUrl,DATABASE_CA_FILE:cfg.caFile}));try{console.log(JSON.stringify(await exerciseSyntheticAccounts(c,runtime,f)));}finally{await runtime.end();}
  }else if(operation==='inspect'){
   await c.query('BEGIN READ ONLY');try{await verifyAccess(c);console.log(JSON.stringify({status:'PASS',projection:await projection(c),runtimeConnections:Number((await c.query("SELECT count(*) n FROM pg_stat_activity WHERE usename='koonpinai_runtime' AND datname=current_database()")).rows[0].n)}));}finally{await c.query('ROLLBACK');}
  }else if(operation==='hold'){
   await c.query("BEGIN; SET LOCAL statement_timeout='12s'; LOCK TABLE public.application_sessions IN ACCESS EXCLUSIVE MODE");console.log('SYNTHETIC_LOCK_HELD');try{await c.query('SELECT pg_sleep(3)');await c.query('COMMIT');}finally{await c.query('ROLLBACK');}
  }else if(operation==='blocked')console.log(JSON.stringify({blocked:Number((await c.query("SELECT count(*) n FROM pg_stat_activity WHERE usename='koonpinai_runtime' AND wait_event_type='Lock'")).rows[0].n)>0}));
  else if(operation==='cleanup')console.log(JSON.stringify(await cleanupSyntheticAccounts(c,f)));
  else throw Error('UNKNOWN_STAGING_PROBE');
 }finally{c.release();await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:databaseErrorCode(e)}));process.exitCode=1;});
