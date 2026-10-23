// Never forward raw child output, SQL, driver messages or credentials.
const codes=new Set(['EACCES','EPERM','EROFS','ENOENT','ENOSPC','ECONNREFUSED','ETIMEDOUT','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_ASSERTION','PLAYWRIGHT_TIMEOUT','PLAYWRIGHT_ASSERTION','DATABASE_OPERATION_FAILED','PRIVATE_PATH_PERMISSIONS_INVALID','PRIVATE_PATH_SYMLINK_FORBIDDEN','ISOLATED_TOOL_FAILED','ISOLATED_TOOL_UNAVAILABLE','ISOLATED_TOOL_TIMEOUT','ISOLATED_CLUSTER_STOP_FAILED','SELF_HOSTED_ROLE_MISMATCH','SELF_HOSTED_PRIVILEGES_UNSAFE','SELF_HOSTED_COLUMN_PRIVILEGES_UNSAFE','ARTIFACT_INTEGRITY_MISMATCH','RUNTIME_DOTENV_FORBIDDEN','23505','42501','28P01','42P01','42704','55P03','57014']);
codes.add('RUNTIME_SESSIONS_REMAIN');
const files=['rehearse-selfhost.ts','rehearse-runtime.ts','runtime-session-observer.ts','rehearse-student-browser.ts','phase3-canary.ts','rehearse-student-timetables.ts','permissions.ts','database.ts','access.ts','secrets.mjs','artifact.mjs'];
/** @type {[RegExp,string][]} */
const reasons=[[/permission denied/i,'PERMISSION_DENIED'],[/operation not permitted/i,'OPERATION_NOT_PERMITTED'],[/read-only file system/i,'READ_ONLY_FILESYSTEM'],[/no space left on device/i,'NO_SPACE'],[/cannot find (?:module|package)/i,'MODULE_MISSING'],[/out of memory|heap limit|oom.?killed/i,'OUT_OF_MEMORY'],[/error while loading shared libraries/i,'SHARED_LIBRARY_MISSING']];
const stages=new Set(['two isolated TLS PostgreSQL clusters ready','source authorization and migration regressions passed; testing portable recovery','runtime-lifecycle','server-action-browser','fresh-migration-rls']);
const assertions=new Set(['toHaveURL','toBeVisible','toHaveCount','toContainText']);
/** @param {unknown} value */
function safeSessions(value){
 if(!value||typeof value!=='object')return;
 const v=/** @type {Record<string,any>} */(value);
 const counts=['remainingCount','fixtureCount','observerCount'];
 if(!counts.every(k=>Number.isSafeInteger(v[k])&&v[k]>=0&&v[k]<=100000)||!Array.isArray(v.sessions))return;
 const states=['active','idle','idle in transaction','idle in transaction (aborted)','disabled','fastpath function call'];
 return {remainingCount:v.remainingCount,fixtureCount:v.fixtureCount,observerCount:v.observerCount,
  sessions:v.sessions.slice(0,8).map(s=>({pid:Number.isSafeInteger(s?.pid)&&s.pid>0?s.pid:0,
   role:s?.role==='koonpinai_runtime'?s.role:'unexpected',
   applicationName:['koonpinai-runtime','koonpinai-rehearsal-fixture'].includes(s?.applicationName)?s.applicationName:'unexpected',
   state:states.includes(s?.state)?s.state:'unknown'}))};
}
/** @typedef {{codes:string[],reasons:string[],locations:string[],lastStage?:string,assertion?:{name:string,timeoutMs?:number},exitCode?:number,program?:string,runtimeSessions?:ReturnType<typeof safeSessions>}} OutputEvidence */
/** @returns {OutputEvidence} */
export function outputEvidence(stdout='',stderr=''){
 const text=(stdout+'\n'+stderr).slice(-32000),found=[],locations=[];
 for(const code of codes)if(new RegExp('\\b'+code+'\\b').test(text))found.push(code);
 for(const file of files)for(const m of text.matchAll(new RegExp('(?:^|[\\s/("\\[])('+file.replaceAll('.','\\.')+':\\d+:\\d+)','gm')))if(!locations.includes(m[1]))locations.push(m[1]);
 let lastStage,assertion,runtimeSessions;for(const line of (stdout+'\n'+stderr).split('\n'))try{const d=JSON.parse(line);if(stages.has(d.stage))lastStage=d.stage;const a=d.evidence?.assertion;if(a&&assertions.has(a.name))assertion={name:a.name,...(Number.isFinite(a.timeoutMs)&&a.timeoutMs>=0&&a.timeoutMs<=60000?{timeoutMs:a.timeoutMs}:{})};runtimeSessions=safeSessions(d.evidence?.runtimeSessions)??runtimeSessions;}catch{/* Ordinary child output is not diagnostic JSON. */}
 return {codes:found,reasons:reasons.filter(([pattern,label])=>pattern.test(text)||text.includes(label)).map(([,label])=>label),locations:locations.slice(0,8),...(lastStage?{lastStage}:{}),...(assertion?{assertion}:{}),...(runtimeSessions?{runtimeSessions}:{})};
}
/** @param {unknown} error
 * @returns {OutputEvidence & {actual?:number|boolean,expected?:number|boolean,assertion?:{name:string,timeoutMs?:number},child?:OutputEvidence}} */
export function rehearsalErrorEvidence(error){
 const e=error&&typeof error==='object'?error:{};
 const out=outputEvidence(typeof e.stack==='string'?e.stack:'','');
 const runtimeSessions=safeSessions(e.sessions);if(runtimeSessions)out.runtimeSessions=runtimeSessions;
 for(const v of [e.code,e.message])if(typeof v==='string'&&codes.has(v)&&!out.codes.includes(v))out.codes.push(v);
 if(e.name==='TimeoutError'||typeof e.message==='string'&&/Timeout \d+ms exceeded|Timed out \d+ms waiting for expect/.test(e.message))out.codes.push('PLAYWRIGHT_TIMEOUT');
 if(e.matcherResult&&assertions.has(e.matcherResult.name)){
  out.codes.push('PLAYWRIGHT_ASSERTION');out.assertion={name:e.matcherResult.name};
  if(Number.isFinite(e.matcherResult.timeout)&&e.matcherResult.timeout>=0&&e.matcherResult.timeout<=60000)out.assertion.timeoutMs=e.matcherResult.timeout;
 }
 for(const k of ['actual','expected'])if(typeof e[k]==='boolean'||typeof e[k]==='number'&&Number.isFinite(e[k]))out[k]=e[k];
 if(e.evidence&&typeof e.evidence==='object'){
  const c=e.evidence;
  out.child=outputEvidence(JSON.stringify(Array.isArray(c.codes)?c.codes.filter(v=>codes.has(v)):[]),'');
  if(Number.isInteger(c.exitCode))out.child.exitCode=c.exitCode;
  if(typeof c.program==='string'&&['node','openssl','initdb','pg_ctl','pg_dump','pg_restore'].includes(c.program))out.child.program=c.program;
  if(Array.isArray(c.reasons))out.child.reasons=c.reasons.filter(v=>reasons.some(([,label])=>label===v));
 }
 return out;
}
