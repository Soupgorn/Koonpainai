import type {PoolClient} from 'pg';
/** Scoped ownership/grants after a no-owner/no-acl restore. Never recreates
 * provider roles, rewrites policies or changes account records. */
export async function configureAccess(c:PoolClient){
 await c.query("BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
 try{
  const roles=(await c.query("SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname IN ('koonpinai_runtime','koonpinai_migrator')")).rows;
  if(roles.length!==2||roles.some(r=>r.rolsuper||r.rolbypassrls||r.rolcreatedb||r.rolcreaterole||r.rolreplication))throw Error('SELF_HOSTED_ROLE_MISMATCH');
  // CONNECT/CREATE and default ACLs are database-local. Restoring into another
  // new database must repeat them; cluster-wide role creation is insufficient.
  await c.query("DO $$ BEGIN EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC',current_database()); EXECUTE format('GRANT CONNECT,CREATE ON DATABASE %I TO koonpinai_migrator',current_database()); EXECUTE format('GRANT CONNECT ON DATABASE %I TO koonpinai_runtime',current_database()); END $$");
  await c.query('ALTER DEFAULT PRIVILEGES FOR ROLE koonpinai_migrator IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE koonpinai_migrator IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC; ALTER DEFAULT PRIVILEGES FOR ROLE koonpinai_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
  await c.query("DO $$ DECLARE item record; BEGIN FOR item IN SELECT n.nspname,c.relname,attr.attname FROM pg_attribute attr JOIN pg_class c ON c.oid=attr.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('members','application_sessions','student_timetables','timetable_entries') AND attr.attnum>0 AND NOT attr.attisdropped LOOP EXECUTE format('REVOKE ALL (%I) ON TABLE %I.%I FROM koonpinai_runtime',item.attname,item.nspname,item.relname); END LOOP; END $$");
  const objects=(await c.query("SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname IN ('members','application_sessions','student_timetables','timetable_entries')) OR (n.nspname='drizzle' AND c.relname IN ('__drizzle_migrations','__drizzle_migrations_id_seq')) ORDER BY CASE WHEN c.relkind='S' THEN 1 ELSE 0 END,c.relname")).rows;
  for(const o of objects){if(!['r','S'].includes(o.relkind))throw Error('SELF_HOSTED_OBJECT_KIND_MISMATCH');await c.query(`ALTER ${o.relkind==='S'?'SEQUENCE':'TABLE'} "${o.nspname}"."${o.relname}" OWNER TO koonpinai_migrator`);}
  for(const name of ['member_role','approval_status'])await c.query(`ALTER TYPE public.${name} OWNER TO koonpinai_migrator`);
  await c.query('ALTER SCHEMA public OWNER TO koonpinai_migrator; ALTER SCHEMA drizzle OWNER TO koonpinai_migrator; REVOKE ALL ON SCHEMA public,drizzle FROM PUBLIC; REVOKE ALL ON SCHEMA drizzle FROM koonpinai_runtime; GRANT USAGE ON SCHEMA public TO koonpinai_runtime; GRANT USAGE ON TYPE public.member_role,public.approval_status TO koonpinai_runtime');
  await c.query('REVOKE ALL ON public.members,public.application_sessions FROM PUBLIC,koonpinai_runtime; GRANT SELECT,INSERT ON public.members,public.application_sessions TO koonpinai_runtime; GRANT UPDATE(display_name,verified_email,last_login_at,updated_at,nickname,thai_name,department,profile_completed_at,policy_version,policy_accepted_at,status) ON public.members TO koonpinai_runtime; GRANT UPDATE(revoked_at) ON public.application_sessions TO koonpinai_runtime');
  // Restore retains these six reviewed account policies. A freshly migrated
  // empty database needs them once; never overwrite an unexpected policy.
  for(const [table,kind,suffix,expression] of [['members','SELECT','select','USING (true)'],['members','INSERT','insert',"WITH CHECK (role='member' AND status='pending')"],['members','UPDATE','update','USING (true) WITH CHECK (true)'],['application_sessions','SELECT','select','USING (true)'],['application_sessions','INSERT','insert','WITH CHECK (true)'],['application_sessions','UPDATE','update','USING (true) WITH CHECK (true)']]){
   const name=`koonpinai_runtime_${table==='members'?'members':'sessions'}_${suffix}`;
   if(!(await c.query('SELECT 1 FROM pg_policy WHERE polrelid=$1::regclass AND polname=$2',['public.'+table,name])).rowCount)await c.query(`CREATE POLICY ${name} ON public.${table} FOR ${kind} TO koonpinai_runtime ${expression}`);
  }
  if(objects.some(o=>o.relname==='student_timetables'))await c.query('REVOKE ALL ON public.student_timetables,public.timetable_entries FROM PUBLIC,koonpinai_runtime; GRANT SELECT,INSERT ON public.student_timetables,public.timetable_entries TO koonpinai_runtime; GRANT UPDATE(name,start_date,end_date,revision,updated_at) ON public.student_timetables TO koonpinai_runtime; GRANT UPDATE(course_name,course_code,section,day,start_time,end_time,room) ON public.timetable_entries TO koonpinai_runtime; GRANT DELETE ON public.timetable_entries TO koonpinai_runtime');
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}
}
export async function verifyAccess(c:PoolClient){
 const unsafe=(await c.query("SELECT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname='koonpinai_runtime' AND (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)) OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='koonpinai_runtime'::regrole) OR EXISTS(SELECT 1 FROM pg_class WHERE relowner='koonpinai_runtime'::regrole) OR has_schema_privilege('koonpinai_runtime','public','CREATE') OR has_schema_privilege('koonpinai_runtime','drizzle','USAGE') OR has_table_privilege('koonpinai_runtime','public.members','DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR has_table_privilege('koonpinai_runtime','public.application_sessions','DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN') OR has_column_privilege('koonpinai_runtime','public.members','role','UPDATE') AS unsafe")).rows[0].unsafe;
 if(unsafe)throw Error('SELF_HOSTED_PRIVILEGES_UNSAFE');
 const allowed:Record<string,string[]>={members:['display_name','verified_email','last_login_at','updated_at','nickname','thai_name','department','profile_completed_at','policy_version','policy_accepted_at','status'],application_sessions:['revoked_at'],student_timetables:['name','start_date','end_date','revision','updated_at'],timetable_entries:['course_name','course_code','section','day','start_time','end_time','room']};
 for(const [table,columns] of Object.entries(allowed)){
  if(!(await c.query('SELECT to_regclass($1) present',['public.'+table])).rows[0].present)continue;
  const mismatch=(await c.query("SELECT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege('koonpinai_runtime',a.attrelid,a.attnum,'UPDATE') IS DISTINCT FROM (a.attname=ANY($2::text[]))) mismatch",['public.'+table,columns])).rows[0].mismatch;
  if(mismatch)throw Error('SELF_HOSTED_COLUMN_PRIVILEGES_UNSAFE');
 }
 return {runtimeSafe:true,migrationCredentialsSeparate:true};
}
