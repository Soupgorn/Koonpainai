// Synthetic local Compose fixtures. No dotenv, hosted data or SSH access.
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, lstatSync} from 'node:fs';
import {join, resolve, relative, isAbsolute} from 'node:path';
import {secureDirectory} from '../portable/permissions';
import {outside, generateBackupKey} from '../portable/crypto';

export function assertLocalDocker(endpoint: string, platform: string, server: string) {
 if(platform!=='linux'||server!=='linux'||!/^unix:\/\/\/(?:var\/run\/docker\.sock|run\/(?:docker\.sock|user\/\d+\/docker\.sock))$/.test(endpoint)) throw Error('LOCAL_LINUX_DOCKER_REQUIRED');
}
export function assertProject(project: string) {
 if(!/^kp-stage-[a-f0-9]{12}-(source|recovery)$/.test(project)) throw Error('ISOLATED_COMPOSE_PROJECT_REQUIRED');
}
export function assertOwnedProject(project: string, labels: Record<string,string>|undefined) {
 assertProject(project);if(labels?.['com.docker.compose.project']!==project)throw Error('COMPOSE_RESOURCE_OWNERSHIP_MISMATCH');
}
export function sourcePin(root: string) {
 const digest=createHash('sha256');
 // Code-point ordering keeps the source identity independent of host ICU/locale.
 const visit=(p:string,rel:string)=>{for(const e of readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){if(e.isSymbolicLink())throw Error('BUILD_INPUT_LINK_FORBIDDEN');const r=rel+'/'+e.name;if(/(^|\/)vendor(\/|$)|\.pdf$/i.test(r))continue;if(e.isDirectory())visit(join(p,e.name),r);else digest.update(r).update(readFileSync(join(p,e.name)));}};
 for(const rel of ['src','public','runtime'])visit(join(root,rel),rel);
 for(const rel of ['Dockerfile','package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs','scripts/package-runtime.mjs'])digest.update(rel).update(readFileSync(join(root,rel)));
 return digest.digest('hex');
}
export function assertFixtureRoot(root:string,marker:string) {
 if(!/^kp-stage-[a-f0-9]{12}$/.test(marker)||!outside(root,process.cwd())||lstatSync(root).isSymbolicLink()||readFileSync(join(root,'synthetic-staging.marker'),'utf8')!==marker)throw Error('SYNTHETIC_FIXTURE_REQUIRED');
}
export function createStagingFixture(root:string,pin:string) {
 if(!isAbsolute(root)||!outside(root,process.cwd())||existsSync(root)||!/^[a-f0-9]{64}$/.test(pin))throw Error('NEW_EXTERNAL_STAGING_PATH_REQUIRED');
 const marker='kp-stage-'+randomBytes(6).toString('hex');secureDirectory(root);writeFileSync(join(root,'synthetic-staging.marker'),marker,{flag:'wx',mode:0o600});
 const ca=join(root,'private-ca');mkdirSync(ca,{mode:0o700});
 const backupKey=join(ca,'portable.backup-key.json');generateBackupKey(backupKey);
 const common={marker,members:Array.from({length:3},()=>randomUUID()),sessions:Array.from({length:3},()=>randomUUID())};
 const projects=['source','recovery'].map(kind=>{
  const project=marker+'-'+kind;assertProject(project);const base=join(root,kind);mkdirSync(base,{mode:0o700});
  const dirs=Object.fromEntries(['tls','admin','web','bad-web','operator','backups','replica'].map(name=>{const p=join(base,name);mkdirSync(p,{mode:0o700});return [name,p];}));
  const secrets={admin:randomBytes(48).toString('base64url'),runtime:randomBytes(48).toString('base64url'),migration:randomBytes(48).toString('base64url'),auth:randomBytes(48).toString('base64url'),oidc:randomBytes(48).toString('base64url'),badRuntime:randomBytes(48).toString('base64url')};
  const put=(dir:string,name:string,data:string)=>writeFileSync(join(dir,name),data,{flag:'wx',mode:0o600});
  const url=(role:string,password:string)=>{const u=new URL('postgresql://placeholder@postgres:5432/koonpinai');u.username=role;u.password=password;return u.href;};
  put(dirs.admin,'password',secrets.admin);
  for(const [name,data] of [['admin-url',url('postgres',secrets.admin)],['migration-url',url('koonpinai_migrator',secrets.migration)],['runtime-url',url('koonpinai_runtime',secrets.runtime)],['runtime-password',secrets.runtime],['migration-password',secrets.migration],['portable.backup-key.json',readFileSync(backupKey,'utf8')],['fixture.json',JSON.stringify({...common,project,runtimeUrlFile:'/run/operator/runtime-url'})]])put(dirs.operator,name,data);
  const config={version:1,kind:'self-hosted',urlFile:'/run/operator/admin-url',caFile:'/run/operator/ca.crt',expectedHost:'postgres',expectedPort:5432,expectedDatabase:'koonpinai',expectedRole:'postgres',pgBin:'/usr/lib/postgresql/17/bin',backupRoot:'/backups',replicaRoot:'/replica',keyFile:'/run/operator/portable.backup-key.json',workRoot:'/work'};
  put(dirs.operator,'admin.json',JSON.stringify(config));put(dirs.operator,'bootstrap.json',JSON.stringify({...config,runtimePasswordFile:'/run/operator/runtime-password',migrationPasswordFile:'/run/operator/migration-password'}));put(dirs.operator,'migration.json',JSON.stringify({...config,urlFile:'/run/operator/migration-url',expectedRole:'koonpinai_migrator'}));
  for(const [name,data] of [['database',url('koonpinai_runtime',secrets.runtime)],['auth',secrets.auth],['oidc',secrets.oidc]])put(dirs.web,name,data);
  const manifest={version:1,artifactSha256:pin,authUrl:'https://app.example/',clientId:'PUBLIC-synthetic-staging',database:{file:'/run/secrets/database',format:'text'},databaseEndpoint:{kind:'self-hosted',host:'postgres',port:5432,database:'koonpinai'},authSecret:{file:'/run/secrets/auth',format:'text'},clientSecret:{file:'/run/secrets/oidc',format:'text'},caFile:'/run/secrets/ca.crt',port:3000,healthPort:3001,host:'0.0.0.0',shutdownMs:30000};
  put(dirs.web,'koonpinai-runtime-manifest.json',JSON.stringify(manifest));
  for(const name of ['auth','oidc','koonpinai-runtime-manifest.json'])put(dirs['bad-web'],name,readFileSync(join(dirs.web,name),'utf8'));
  put(dirs['bad-web'],'database',url('koonpinai_runtime',secrets.badRuntime));
  return {project,base,dirs,secrets,...common};
 });
 return {root,ca,marker,projects,backupKey};
}
export function composeEnvironment(p:ReturnType<typeof createStagingFixture>['projects'][number],images:{web:string;tools:string},backupDir=p.dirs.backups) {
 assertProject(p.project);
 return {KOONPINAI_WEB_IMAGE:images.web,KOONPINAI_TOOLS_IMAGE:images.tools,KOONPINAI_WEB_PORT:'0',KOONPINAI_POSTGRES_TLS_DIR:p.dirs.tls,KOONPINAI_POSTGRES_ADMIN_DIR:p.dirs.admin,KOONPINAI_WEB_SECRET_DIR:p.dirs.web,KOONPINAI_OPERATOR_SECRET_DIR:p.dirs.operator,KOONPINAI_BACKUP_DIR:backupDir,KOONPINAI_BACKUP_REPLICA_DIR:p.dirs.replica};
}
/** Only the generated project may be cleaned. Never accept external volume
 * names, mounts or a service replacing the private database network. */
export function validateComposeContract(c:Record<string,unknown>) {
 const services=c.services as Record<string,Record<string,unknown>>,pg=services?.postgres,web=services?.web,tools=services?.tools;
 if(!pg||!web||!tools||pg.ports||String(pg.user)!=='999:999'||String(web.user)!=='1001:1001'||String(tools.user)!=='1002:1002')throw Error('COMPOSE_SECURITY_CONTRACT_MISMATCH');
 const networks=c.networks as Record<string,{internal?:boolean}>;if(networks?.database?.internal!==true)throw Error('PRIVATE_DATABASE_NETWORK_REQUIRED');
 if((web.volumes as string[]).length!==1||!(web.volumes as string[])[0].endsWith(':/run/secrets:ro')||!web.read_only)throw Error('RUNTIME_ONLY_MOUNT_REQUIRED');
 if(!tools.read_only||!(tools.tmpfs as string[]|undefined)?.some(v=>v.startsWith('/tmp:')&&v.includes('uid=1002')&&v.includes('mode=0700')))throw Error('PRIVATE_TOOL_TEMPFS_REQUIRED');
 if(Object.values(c.volumes as object).some(v=>v!==null&&Object.keys(v as object).length))throw Error('ISOLATED_NAMED_VOLUME_REQUIRED');
 for(const token of web.ports as string[])if(!token.startsWith('127.0.0.1:'))throw Error('LOOPBACK_WEB_PORT_REQUIRED');
}
export function assertFixtureChild(root:string,path:string){const rel=relative(resolve(root),resolve(path));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('FIXTURE_CHILD_REQUIRED');}
