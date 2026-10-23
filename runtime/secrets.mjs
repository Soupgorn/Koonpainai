import { readFileSync, lstatSync, realpathSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export const NEXT_VERSION = '16.4.2';
const deny = message => { throw new Error(message); };
/** @param {Record<string,string|undefined>} source */
export function assertNoInheritedCredentials(source=process.env){
  if(Object.keys(source).some(k=>/^(DATABASE_URL$|MIGRATION_|DIRECT_DATABASE_|PG|AUTH_|NEXTAUTH_|SUPABASE_.*(KEY|SECRET))/i.test(k)&&source[k]))deny('INHERITED_CREDENTIALS_FORBIDDEN');
}
export function assertCleanBundle(root) {
  for (const f of ['.env','.env.local','.env.production','.env.production.local','.env.development','.env.development.local','.env.test','.env.test.local'])
    if (existsSync(resolve(root,f))) deny('RUNTIME_DOTENV_FORBIDDEN');
}
/** The production launcher may mount ONLY this exact runtime-only directory. */
export function assertRuntimeSecretDirectory(manifestFile){
  const file=realpathSync(manifestFile),dir=dirname(file),m=validateManifest(JSON.parse(readFileSync(file,'utf8')));
  const allowed=new Set([file,realpathSync(m.database.file),realpathSync(m.authSecret.file),realpathSync(m.clientSecret.file),realpathSync(m.caFile)]);
  if(allowed.size!==5||[...allowed].some(p=>dirname(p)!==dir))deny('SINGLE_RUNTIME_SECRET_DIRECTORY_REQUIRED');
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const p=resolve(dir,e.name);if(!e.isFile()||e.isSymbolicLink()||!allowed.has(p))deny('UNEXPECTED_RUNTIME_SECRET_FILE');
  }
}
export function validateManifest(m) {
  const keys = ['version','artifactSha256','authUrl','clientId','database','databaseTarget','databaseEndpoint','authSecret','clientSecret','caFile','port','healthPort','host','shutdownMs'];
  if (!m || m.version !== 1 || Object.keys(m).some(k => !keys.includes(k))) deny('MANIFEST_INVALID');
  if(!/^[a-f0-9]{64}$/.test(m.artifactSha256??''))deny('ARTIFACT_PIN_REQUIRED');
  let origin; try { origin = new URL(m.authUrl); } catch { deny('MANIFEST_INVALID'); }
  if (origin.protocol !== 'https:' || origin.origin + '/' !== origin.href || origin.username || origin.password) deny('CANONICAL_HTTPS_REQUIRED');
  if (typeof m.clientId !== 'string' || !m.clientId || m.clientId.length>256) deny('MANIFEST_INVALID');
  for (const key of ['port','healthPort']) if (!Number.isInteger(m[key]) || m[key]<1024 || m[key]>65535) deny('PORT_INVALID');
  if (m.port === m.healthPort || !['127.0.0.1','0.0.0.0'].includes(m.host)) deny('PORT_OR_BIND_INVALID');
  if (!Number.isInteger(m.shutdownMs) || m.shutdownMs<5000 || m.shutdownMs>60000) deny('SHUTDOWN_BUDGET_INVALID');
  for (const k of ['database','authSecret','clientSecret']) {
    const ref=m[k]; if (!ref || Object.keys(ref).some(k=>!['file','format'].includes(k)) || typeof ref.file!=='string' || !isAbsolute(ref.file)) deny('SECRET_REFERENCE_INVALID');
    if (!['text','dpapi-text','dpapi-runtime-v1'].includes(ref.format) || (k!=='database' && ref.format==='dpapi-runtime-v1')) deny('SECRET_FORMAT_INVALID');
  }
  if (typeof m.caFile!=='string' || !isAbsolute(m.caFile)) deny('CA_PATH_REQUIRED');
  if(m.database.format==='dpapi-runtime-v1'){
    const t=m.databaseTarget;if(!t||Object.keys(t).sort().join(',')!=='database,host,user'||!Object.values(t).every(v=>typeof v==='string'&&v.length>0)||!t.host.endsWith('.pooler.supabase.com')||!/^koonpinai_runtime\.[a-z0-9]+$/.test(t.user)||!/^[A-Za-z0-9_]+$/.test(t.database))deny('DATABASE_TARGET_REQUIRED');
  }else if(m.databaseTarget!==undefined)deny('UNEXPECTED_DATABASE_TARGET');
  if(m.databaseEndpoint!==undefined){
    const t=m.databaseEndpoint;
    if(!t||Object.keys(t).sort().join(',')!=='database,host,kind,port'||t.kind!=='self-hosted'||typeof t.host!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(t.host)||/(^|\.)supabase\.(com|co)$/i.test(t.host)||!Number.isInteger(t.port)||t.port<1||t.port>65535||typeof t.database!=='string'||!/^[a-zA-Z0-9_]+$/.test(t.database)||m.database.format==='dpapi-runtime-v1')deny('SELF_HOSTED_ENDPOINT_INVALID');
  }
  return m;
}
/** @param {string} value
 * @param {{isolated?:boolean,endpoint?:{kind:string,host:string,port:number,database:string}}} [options] */
export function validateRuntimeUrl(value, {isolated=false,endpoint=undefined}={}) {
  let u; try { u=new URL(value); } catch { deny('RUNTIME_DATABASE_INVALID'); }
  const hosted=u.hostname.endsWith('.pooler.supabase.com') && (u.port||'5432')==='5432' && /^koonpinai_runtime\.[a-z0-9]+$/.test(decodeURIComponent(u.username));
  // Tests use a NEW local synthetic cluster, never a tunnel or hosted fallback.
  const fixture=isolated && u.hostname==='127.0.0.1' && Number(u.port)>=55434 && Number(u.port)<=55534 && u.pathname==='/phase3_synthetic' && u.username==='koonpinai_runtime';
  const selfHosted=endpoint?.kind==='self-hosted'&&u.hostname===endpoint.host&&(Number(u.port||5432)===endpoint.port)&&decodeURIComponent(u.pathname.slice(1))===endpoint.database&&u.username==='koonpinai_runtime';
  if (!['postgres:','postgresql:'].includes(u.protocol) || (endpoint ? !selfHosted : !hosted&&!fixture) || !u.password || u.pathname.length<2 || u.hash || [...u.searchParams].some(([k,v])=>k!=='sslmode'||v!=='verify-full')) deny('DEDICATED_SESSION_DATABASE_REQUIRED');
  return u;
}
function privateFile(file, bundleRoot) {
  const target=realpathSync(file), rel=relative(realpathSync(bundleRoot),target);
  if (!isAbsolute(file) || lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile() || !rel || (!rel.startsWith('..')&&!isAbsolute(rel))) deny('SECRET_MUST_BE_EXTERNAL_REGULAR_FILE');
  if (process.platform==='win32') {
    const ps='$ErrorActionPreference="Stop"; $p=[Console]::In.ReadToEnd();$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$parent=[IO.Path]::GetDirectoryName($p);if(-not (Get-Acl -LiteralPath $parent).AreAccessRulesProtected){throw "ACL"};foreach($f in @($p,$parent)){$a=Get-Acl -LiteralPath $f;foreach($r in $a.Access){if($r.AccessControlType -ne "Allow" -or $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($sid,"S-1-5-18")){throw "ACL"}}};[Console]::Out.Write("PASS")';
    const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:target,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','ignore'],timeout:10000,env:osEnvironment()});
    if(result!=='PASS') deny('SECRET_ACL_INVALID');
  } else {
    for (const p of [target,dirname(target)]) {
      const s=lstatSync(p);if(![0,process.getuid()].includes(s.uid) || (s.mode&0o027)!==0) deny('SECRET_PERMISSIONS_INVALID');
    }
  }
  return target;
}
/** @param {Record<string,string|undefined>} source */
export function osEnvironment(source=process.env) {
  /** @type {Record<string,string|undefined>} */
  const out={};for(const k of ['SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOME','LANG','TZ']) if(source[k]!==undefined) out[k]=source[k];
  return out;
}
function readSecret(ref, root) {
  const file=privateFile(ref.file,root);let data=readFileSync(file);
  try {
    if(ref.format.startsWith('dpapi')) {
      if(process.platform!=='win32') deny('DPAPI_REQUIRES_WINDOWS');
      const ps='$ErrorActionPreference="Stop";Add-Type -AssemblyName System.Security;$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($p));[Array]::Clear($p,0,$p.Length)';
      const b=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:data.toString('base64'),windowsHide:true,stdio:['pipe','pipe','ignore'],timeout:10000,env:osEnvironment()});
      data.fill(0);data=Buffer.from(b.toString().trim(),'base64');b.fill(0);
    }
    const text=data.toString('utf8').trim();if(!text||text.includes('\n')||text.includes('\r')) deny('SECRET_INVALID');
    return text;
  } finally {data.fill(0);}
}
export function loadRuntimeEnvironment(manifestFile, root, {isolated=false}={}) {
  assertCleanBundle(root);
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0') deny('TLS_BYPASS_FORBIDDEN');
  const m=validateManifest(JSON.parse(readFileSync(manifestFile,'utf8')));
  let database=readSecret(m.database,root);
  if(m.database.format==='dpapi-runtime-v1') {
    const p=JSON.parse(database);if(p.version!==1||p.role!=='koonpinai_runtime'||!/^[A-Za-z0-9_-]{64}$/.test(p.password))deny('STAGED_CREDENTIAL_INVALID');
    const t=m.databaseTarget,u=new URL('postgresql://placeholder@'+t.host+':5432/'+t.database);u.username=t.user;u.password=p.password;database=u.href;
  }
  validateRuntimeUrl(database,{isolated,endpoint:m.databaseEndpoint});
  const secret=readSecret(m.authSecret,root),clientSecret=readSecret(m.clientSecret,root);
  if(secret.length<32) deny('AUTH_SECRET_INVALID');
  /** @type {NodeJS.ProcessEnv} */
  const env={...osEnvironment(),NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',KOONPINAI_MANAGED_RUNTIME:'1',KOONPINAI_ARTIFACT_SHA256:m.artifactSha256,DATABASE_POOL_MAX:'2',DATABASE_URL:database,DATABASE_CA_FILE:m.caFile,AUTH_SECRET:secret,AUTH_KEYCLOAK_SECRET:clientSecret,AUTH_KEYCLOAK_ID:m.clientId,AUTH_KEYCLOAK_ISSUER:'https://sso.kmitl.ac.th/realms/kmitl',AUTH_URL:m.authUrl,PORT:String(m.port),HOSTNAME:m.host,KOONPINAI_HEALTH_PORT:String(m.healthPort),KOONPINAI_SHUTDOWN_MS:String(m.shutdownMs)};
  database='';
  return env;
}
