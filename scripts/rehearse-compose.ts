// Exact production Compose configuration; generated synthetic data only.
// Refuses remote Docker contexts. Does not load dotenv or use SSH/real backups.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {writeFileSync,copyFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {request} from 'node:http';
import {StringDecoder} from 'node:string_decoder';
import {encode} from 'next-auth/jwt';
import {osEnvironment} from '../runtime/secrets.mjs';
import {assertLocalDocker,assertOwnedProject,assertFixtureRoot,createStagingFixture,composeEnvironment,sourcePin} from './staging/fixture';
import {releaseConfig,validateImage,verifyReleaseFiles} from './release-images';
import {assertPrivatePath} from './portable/permissions';
import {outside} from './portable/crypto';

type RunOptions={env?:Record<string,string>;allowFailure?:boolean;timeout?:number};
async function run(exe:string,args:string[],o:RunOptions={}){return new Promise<{stdout:string;stderr:string;code:number|null}>((ok,fail)=>{
 const c=spawn(exe,args,{env:{...osEnvironment(),...o.env,NODE_ENV:'test'},windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',size=0;const outDecoder=new StringDecoder('utf8'),errDecoder=new StringDecoder('utf8');
 const timer=setTimeout(()=>{c.kill();fail(Error('STAGING_TOOL_TIMEOUT'));},o.timeout??120000);
 const receive=(b:Buffer,channel:'stdout'|'stderr')=>{size+=b.length;if(size>8e6){c.kill();clearTimeout(timer);fail(Error('STAGING_TOOL_OUTPUT_LIMIT'));return;}if(channel==='stdout')stdout+=outDecoder.write(b);else stderr+=errDecoder.write(b);};
 c.stdout.on('data',b=>receive(b,'stdout'));c.stderr.on('data',b=>receive(b,'stderr'));c.on('error',()=>{clearTimeout(timer);fail(Error('STAGING_TOOL_UNAVAILABLE'));});c.on('close',code=>{clearTimeout(timer);stdout+=outDecoder.end();stderr+=errDecoder.end();if(code===0||o.allowFailure)ok({stdout,stderr,code});else {let detail='';for(const line of (stdout+'\n'+stderr).split('\n'))try{const parsed=JSON.parse(line);if(typeof parsed.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(parsed.code))detail='_'+parsed.code;}catch{}fail(Error('STAGING_TOOL_FAILED'+detail));}});
});}
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const progress=(stage:string)=>console.log(JSON.stringify({stage,productionConnected:false,syntheticOnly:true}));
const base=resolve('operations/selfhost/compose.yaml');
type Fixture=ReturnType<typeof createStagingFixture>;
type Project=Fixture['projects'][number];
let fixture:Fixture|undefined;const started:Project[]=[];const checks:string[]=[];
const id=randomUUID().replaceAll('-','').slice(0,12),images={web:'kp-stage-'+id+':web',tools:'kp-stage-'+id+':tools'};
let reviewedRollback:{imageId:string;artifactSha256:string;sourcePin:string}|undefined;
const exercisedWebImages=new Set<string>();
const envFor=(p:Project)=>composeEnvironment(p,images,p.project.endsWith('-recovery')?fixture!.projects[0].dirs.replica:p.dirs.backups);
const compose=(p:Project,args:string[],o:RunOptions={})=>run('docker',['compose','--project-name',p.project,'--env-file','/dev/null','-f',base,...args],{...o,env:{...envFor(p),...o.env}});
const tools=(p:Project,args:string[])=>compose(p,['--profile','operations','run','--rm','--no-deps','tools',...args]);
const probe=(p:Project,operation:string)=>compose(p,['--profile','operations','run','--rm','--no-deps','-e','KOONPINAI_SYNTHETIC_STAGING=1','--entrypoint','node','tools','node_modules/tsx/dist/cli.mjs','scripts/staging/probe.ts',operation]);
async function inspect(p:Project,service:string){const name=(await run('docker',['ps','--all','--quiet','--filter','label=com.docker.compose.project='+p.project,'--filter','label=com.docker.compose.service='+service,'--filter','label=com.docker.compose.oneoff=False'])).stdout.trim();if(!/^[a-f0-9]{12,64}$/.test(name))throw Error('ONE_OWNED_SERVICE_REQUIRED');const c=JSON.parse((await run('docker',['inspect',name])).stdout)[0];assertOwnedProject(p.project,c.Config.Labels);return {id:name,...c};}
async function waitHealthy(p:Project,service:string){for(let i=0;i<180;i++){const c=await inspect(p,service);if(c.State.Health?.Status==='healthy')return c;if(c.State.Status==='exited')throw Error('STAGING_SERVICE_EXITED');await pause(500);}throw Error('STAGING_HEALTH_TIMEOUT');}
async function waitExit(p:Project,service:string){for(let i=0;i<100;i++){const c=await inspect(p,service);if(c.State.Status==='exited')return c;await pause(300);}throw Error('STAGING_EXIT_TIMEOUT');}
function http(port:number,path:string,cookie?:string){return new Promise<{status:number;body:string;location?:string}>((ok,fail)=>{const r=request({hostname:'127.0.0.1',port,path,headers:{host:'app.example','x-forwarded-proto':'https',...(cookie?{cookie:'__Secure-authjs.session-token='+cookie}:{})}},res=>{const chunks:Buffer[]=[];res.on('data',b=>chunks.push(b));res.on('end',()=>ok({status:res.statusCode!,body:Buffer.concat(chunks).toString(),location:res.headers.location}));});r.setTimeout(30000,()=>r.destroy(Error('STAGING_HTTP_TIMEOUT')));r.on('error',fail);r.end();});}
async function ownedResources(p:Project,type:'container'|'volume'|'network'){
 const args=type==='container'?['ps','--all','--quiet']:[''+type,'ls','--quiet'];const names=(await run('docker',[...args,'--filter','label=com.docker.compose.project='+p.project])).stdout.trim().split('\n').filter(Boolean);
 for(const name of names){const r=JSON.parse((await run('docker',[type,'inspect',name])).stdout)[0];assertOwnedProject(p.project,type==='container'?r.Config.Labels:r.Labels);}return names;
}
async function main(){
 if(!process.argv.includes('--approve-isolated-writes'))throw Error('EXPLICIT_ISOLATED_WRITE_APPROVAL_REQUIRED');
 const server=(await run('docker',['version','--format','{{.Server.Os}}'])).stdout.trim();const context=JSON.parse((await run('docker',['context','inspect'])).stdout)[0];assertLocalDocker(context.Endpoints?.docker?.Host,process.platform,server);
 if((await run('docker',['info','--format','{{json .SecurityOptions}}'])).stdout.includes('rootless'))throw Error('ROOTFUL_DOCKER_REQUIRED_FOR_UID_REHEARSAL');
 const root=join(tmpdir(),'koonpinai-compose-'+id),pin=sourcePin(process.cwd());
 const pairFile=process.argv.find(s=>s.startsWith('--reviewed-pair='))?.slice(16);
 if(pairFile){
  if(!outside(pairFile,process.cwd()))throw Error('EXTERNAL_REVIEWED_PAIR_REQUIRED');assertPrivatePath(pairFile);
  const pair=JSON.parse(readFileSync(pairFile,'utf8'));await verifyReleaseFiles(dirname(pairFile),pair);
  const select=(kind:string)=>{const i=pair.images.find((v:{kind:string})=>v.kind===kind);return {imageId:i?.imageId,artifactSha256:i?.artifactSha256,sourcePin:i?.sourcePin};};
  const reviewed=releaseConfig.parse({version:1,candidate:select('candidate'),rollback:select('rollback'),output:dirname(pairFile),rollbackKind:pair.rollbackKind});
  if(reviewed.candidate.sourcePin!==pin)throw Error('CURRENT_SOURCE_PIN_MISMATCH');
  const toolsId=process.argv.find(s=>s.startsWith('--tools-image='))?.slice(14);if(!toolsId||!/^sha256:[a-f0-9]{64}$/.test(toolsId))throw Error('IMMUTABLE_TOOLS_IMAGE_REQUIRED');
  for(const item of [reviewed.candidate,reviewed.rollback]){
   const info=JSON.parse((await run('docker',['image','inspect',item.imageId])).stdout)[0];assert.equal(info.Id,item.imageId);
   const code=`import('/app/runtime/artifact.mjs').then(({verifyArtifact})=>{const m=verifyArtifact('/app','${item.artifactSha256}');process.stdout.write(JSON.stringify({artifactSha256:'${item.artifactSha256}',buildId:m.buildId,policyVersion:m.policyVersion,next:m.next,nodeMajor:m.nodeMajor,schemaMigrationsApplied:m.schemaMigrationsApplied}));}).catch(()=>process.exit(1));`;
   const metadata=JSON.parse((await run('docker',['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--pids-limit','32','--entrypoint','node',item.imageId,'-e',code])).stdout);validateImage(info.Config,metadata,item.artifactSha256,item.sourcePin);
  }
  const tool=JSON.parse((await run('docker',['image','inspect',toolsId])).stdout)[0];assert.equal(tool.Id,toolsId);assert.equal(tool.Config.User,'1002:1002');
  images.web=reviewed.candidate.imageId;images.tools=toolsId;reviewedRollback=reviewed.rollback;progress('verified sealed candidate and rollback images; no rebuild');
 }else{
  progress('building production web and tools images');
  await run('docker',['build','--build-arg','KOONPINAI_BUILD_ID='+pin,'-t',images.web,'.'],{timeout:1200000});await run('docker',['build','-f','operations/selfhost/Dockerfile.tools','--target','tools','-t',images.tools,'.'],{timeout:1200000});
 }
 const artifactPin=(await run('docker',['run','--rm','--network','none','--entrypoint','node',images.web,'-e',"process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/runtime-artifact.json')).digest('hex'))"])).stdout.trim();assert.match(artifactPin,/^[a-f0-9]{64}$/);
 exercisedWebImages.add(images.web);
 fixture=createStagingFixture(root,artifactPin);const [source,recovery]=fixture.projects;
 // Temporary CA is never mounted into web or PostgreSQL. Only the leaf key
 // enters the database mount; clients receive its trusted public CA.
 await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=Koonpinai synthetic Compose CA','-addext','basicConstraints=critical,CA:TRUE','-keyout',join(fixture.ca,'ca.key'),'-out',join(fixture.ca,'ca.crt')]);
 await run('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=postgres','-keyout',join(fixture.ca,'server.key'),'-out',join(fixture.ca,'server.csr')]);
 writeFileSync(join(fixture.ca,'extensions'),'subjectAltName=DNS:postgres,DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n',{mode:0o600});
 await run('openssl',['x509','-req','-days','2','-in',join(fixture.ca,'server.csr'),'-CA',join(fixture.ca,'ca.crt'),'-CAkey',join(fixture.ca,'ca.key'),'-CAcreateserial','-extfile',join(fixture.ca,'extensions'),'-out',join(fixture.ca,'server.crt')]);
 for(const p of fixture.projects){for(const file of ['server.key','server.crt','ca.crt'])copyFileSync(join(fixture.ca,file),join(p.dirs.tls,file));for(const dir of [p.dirs.web,p.dirs['bad-web'],p.dirs.operator])copyFileSync(join(fixture.ca,'ca.crt'),join(dir,'ca.crt'));}
 assertFixtureRoot(root,fixture.marker);
 const ownerScript='test "$(cat /fixture/synthetic-staging.marker)" = "$1"; for p in source recovery; do chown -R 999:999 /fixture/$p/tls /fixture/$p/admin; chown -R 1001:1001 /fixture/$p/web /fixture/$p/bad-web; chown -R 1002:1002 /fixture/$p/operator /fixture/$p/backups /fixture/$p/replica; find /fixture/$p -type d -exec chmod 700 {} +; find /fixture/$p -type f -exec chmod 600 {} +; done';
 await run('docker',['run','--rm','--network','none','--user','0:0','--cap-drop','ALL','--cap-add','CHOWN','--cap-add','FOWNER','--cap-add','DAC_OVERRIDE','-v',root+':/fixture','--entrypoint','sh',images.web,'-eu','-c',ownerScript,'fixture',fixture.marker]);
 for(const p of fixture.projects){
  progress('bootstrap '+p.project);
  for(const kind of ['container','volume','network'] as const)assert.equal((await ownedResources(p,kind)).length,0);
  await compose(p,['config','--quiet']);started.push(p);await compose(p,['up','--detach','postgres']);const database=await waitHealthy(p,'postgres');assert.equal(database.HostConfig.PortBindings?.['5432/tcp'],undefined);assert.equal(database.Config.User,'999:999');assert.equal(database.HostConfig.Memory,512*1024**2);assert.equal(database.HostConfig.PidsLimit,128);
  await probe(p,'mark');await tools(p,['bootstrap','--config=/run/operator/bootstrap.json','--approve-target=koonpinai']);
 }
 progress('migrations and restricted account/timetable canaries');
 await tools(source,['migrate','--config=/run/operator/migration.json','--approve-target=koonpinai','--approve-through=0002']);await tools(source,['access','--config=/run/operator/admin.json','--approve-target=koonpinai']);
 const exercise=JSON.parse((await probe(source,'exercise')).stdout);assert.equal(exercise.status,'PASS');checks.push(...exercise.checks);
 const before=JSON.parse((await probe(source,'inspect')).stdout).projection;assert.equal(before.ledger.length,3);
 progress('encrypted backup and independent restore');
 const archive=JSON.parse((await tools(source,['backup','--config=/run/operator/admin.json','--reason=isolated'])).stdout);assert.equal(archive.status,'PASS');const archiveId=archive.backup.split('/').pop();assert.match(archiveId,/^[0-9TZ-]+-[a-f0-9]{8}$/);
 await tools(source,['verify','--config=/run/operator/admin.json','--backup=/backups/'+archiveId]);const retention=JSON.parse((await tools(source,['retention','--config=/run/operator/admin.json','--daily=7','--weekly=4','--monthly=3'])).stdout);assert.equal(retention.deletionExecuted,false);assert.ok(retention.keep.includes(archiveId));
 await tools(recovery,['restore','--config=/run/operator/admin.json','--approve-target=koonpinai','--approve-empty-target','--backup=/backups/'+archiveId]);await tools(recovery,['access','--config=/run/operator/admin.json','--approve-target=koonpinai']);assert.deepEqual(JSON.parse((await probe(recovery,'inspect')).stdout).projection,before);
 checks.push('Portable backup and separately delivered raw key restore into an independent PostgreSQL container/volume; complete records/schema/ledger match; retention deletes nothing');
 progress('web startup and resource/secret isolation');
 await compose(source,['up','--detach','web']);let web=await waitHealthy(source,'web');assert.equal(web.Config.User,'1001:1001');assert.equal(web.HostConfig.Memory,1024**3);assert.equal(web.HostConfig.NanoCpus,1e9);assert.equal(web.HostConfig.PidsLimit,128);assert.equal(web.HostConfig.ReadonlyRootfs,true);
 const mounts=web.Mounts.filter((m:{Type:string})=>m.Type==='bind');assert.equal(mounts.length,1);assert.equal(mounts[0].Destination,'/run/secrets');assert.equal(mounts[0].RW,false);
 const binding=web.NetworkSettings.Ports['3000/tcp'];assert.equal(binding.length,1);assert.equal(binding[0].HostIp,'127.0.0.1');let port=Number(binding[0].HostPort);
 const cookie=await encode({secret:source.secrets.auth,salt:'__Secure-authjs.session-token',maxAge:3600,token:{userId:source.members[0],sid:source.sessions[0],oidcIssuer:'https://sso.kmitl.ac.th/realms/kmitl',oidcSubject:source.marker+'-0',deadline:Math.floor(Date.now()/1000)+3600}});
 assert.equal((await http(port,'/login')).status,200);assert.equal((await http(port,'/')).status,307);const own=await http(port,'/my-timetable',cookie);assert.equal(own.status,200);assert.ok(own.body.includes('Synthetic Algorithms'));checks.push('Actual Compose web image starts as nonroot, private mounts/resource limits and synthetic authenticated timetable rendering pass');
 // A failed candidate has no published port and only its own runtime mount.
 const config=JSON.parse((await compose(source,['config','--format','json'])).stdout),candidate={...config.services.web,ports:[],restart:'no',volumes:config.services.web.volumes.map((v:Record<string,unknown>)=>v.target==='/run/secrets'?{...v,source:source.dirs['bad-web']}:v)};
 const override=join(root,'candidate.json');writeFileSync(override,JSON.stringify({services:{candidate}}),{flag:'wx',mode:0o600});
 await compose(source,['-f',override,'up','--detach','--no-deps','candidate']);assert.equal((await waitExit(source,'candidate')).State.ExitCode,1);assert.equal((await http(port,'/login')).status,200);checks.push('Wrong-credential candidate exits without taking traffic or changing the healthy instance');
 progress('database outage and persistent-volume recovery');
 await compose(source,['stop','postgres']);let unhealthy=false;for(let i=0;i<180;i++){if((await inspect(source,'web')).State.Health?.Status==='unhealthy'){unhealthy=true;break;}await pause(500);}assert.ok(unhealthy);
 await compose(source,['start','postgres']);await waitHealthy(source,'postgres');await waitHealthy(source,'web');assert.deepEqual(JSON.parse((await probe(source,'inspect')).stdout).projection,before);checks.push('Actual Compose PostgreSQL named volume survives stop/start; web becomes unhealthy during outage and recovers with unchanged data');
 progress('SIGTERM with an in-flight authenticated SQL request');
 const lockName=source.project+'-lock';
 await compose(source,['--profile','operations','run','--rm','--detach','--no-deps','--name',lockName,'-e','KOONPINAI_SYNTHETIC_STAGING=1','--entrypoint','node','tools','node_modules/tsx/dist/cli.mjs','scripts/staging/probe.ts','hold']);
 for(let i=0;i<40;i++){const log=(await run('docker',['logs',lockName])).stdout;if(log.includes('SYNTHETIC_LOCK_HELD'))break;if(i===39)throw Error('SYNTHETIC_LOCK_NOT_ACQUIRED');await pause(100);}
 // A cold tsx tools container can consume the entire lock window. Check using
 // the existing PostgreSQL process so the three-second hold remains below the
 // runtime's five-second lock timeout. The password is read inside the private
 // database container and never enters argv, output or the web container.
 const lockCheck="export PGPASSWORD=\"$(cat /run/postgres-admin/password)\" PGSSLMODE=verify-full PGSSLROOTCERT=/run/postgres-tls/ca.crt; exec psql -X -w -h localhost -U postgres -d koonpinai -Atc \"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='koonpinai_runtime' AND wait_event_type='Lock')\"";
 const inFlight=http(port,'/account',cookie);let blocked=false;for(let i=0;i<20;i++){blocked=(await compose(source,['exec','-T','postgres','sh','-ec',lockCheck])).stdout.trim()==='t';if(blocked)break;await pause(50);}assert.ok(blocked);
 const stopping=compose(source,['stop','--timeout','40','web']);assert.ok([200,307].includes((await inFlight).status));await stopping;assert.equal((await inspect(source,'web')).State.ExitCode,0);assert.equal(JSON.parse((await probe(source,'inspect')).stdout).runtimeConnections,0);
 checks.push('Real Compose SIGTERM drains an authenticated in-flight SQL request and closes every runtime backend');
 progress('same-image restart and loopback port discovery');
 await compose(source,['start','web']);web=await waitHealthy(source,'web');
 // Docker can allocate a different host port after restarting a :0 binding.
 const restartedBinding=web.NetworkSettings.Ports['3000/tcp'];assert.equal(restartedBinding.length,1);assert.equal(restartedBinding[0].HostIp,'127.0.0.1');port=Number(restartedBinding[0].HostPort);
 assert.equal((await http(port,'/my-timetable',cookie)).status,200);checks.push('Same-image Compose restart preserves sessions and data; ephemeral loopback port is rediscovered; different-artifact rollback requires separate evidence');
 if(reviewedRollback){
  progress('rollback to distinct sealed image with unchanged database');
  const manifestFile=join(source.dirs.web,'koonpinai-runtime-manifest.json');assertFixtureRoot(fixture.root,fixture.marker);
  // The web mount belongs to UID1001 with mode0700. Change only this reviewed
  // synthetic manifest pin as the existing sudo operator; never weaken its ACL.
  const changePin="const fs=require('fs'),p=process.argv[1];if(!fs.lstatSync(p).isFile()||fs.lstatSync(p).isSymbolicLink())throw Error('FIXTURE_MANIFEST_REQUIRED');const m=JSON.parse(fs.readFileSync(p));if(m.artifactSha256!==process.argv[2])throw Error('FIXTURE_ARTIFACT_PIN_MISMATCH');m.artifactSha256=process.argv[3];fs.writeFileSync(p,JSON.stringify(m));";
  await compose(source,['stop','--timeout','40','web']);await run('sudo',['-n','node','-e',changePin,manifestFile,artifactPin,reviewedRollback.artifactSha256]);images.web=reviewedRollback.imageId;exercisedWebImages.add(images.web);
  await compose(source,['up','--detach','--no-deps','web']);const rolledBack=await waitHealthy(source,'web');assert.equal(rolledBack.Config.Image,reviewedRollback.imageId);
  const binding=rolledBack.NetworkSettings.Ports['3000/tcp'];assert.equal(binding[0].HostIp,'127.0.0.1');port=Number(binding[0].HostPort);
  assert.equal((await http(port,'/my-timetable',cookie)).status,200);assert.deepEqual(JSON.parse((await probe(source,'inspect')).stdout).projection,before);
  checks.push('Distinct sealed same-policy image rollback starts healthy, preserves encrypted session, every record and exact ledger, without database rollback');
 }
 const allSecrets=fixture.projects.flatMap(p=>Object.values(p.secrets));for(const p of fixture.projects)for(const cid of await ownedResources(p,'container')){const logs=await run('docker',['logs',cid],{allowFailure:true});assert.ok(!allSecrets.some(s=>logs.stdout.includes(s)||logs.stderr.includes(s)),'STAGING_SECRET_LOGGING');}
 for(const image of new Set([...Object.values(images),...exercisedWebImages])){const history=(await run('docker',['history','--no-trunc',image])).stdout;assert.ok(!allSecrets.some(s=>history.includes(s)),'STAGING_SECRET_IN_IMAGE_HISTORY');}
 await probe(source,'cleanup');await probe(recovery,'cleanup');
 const result={status:'PASS',at:new Date().toISOString(),checks,sourcePin:pin,artifactPin,rollbackDistinctImage:!!reviewedRollback,productionConnected:false,realOidc:false,syntheticDataOnly:true,actualCompose:true,independentPostgresContainers:true,linuxPortableRestore:true,offVmDisasterRecoveryDemonstrated:false,retentionDeletionExecuted:false,output:root};
 writeFileSync(join(root,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(result));
}
void main().catch(async e=>{
 const lifecycle=[];
 if(fixture)for(const p of started)for(const cid of await ownedResources(p,'container')){
  const c=JSON.parse((await run('docker',['inspect',cid])).stdout)[0];const output=await run('docker',['logs',cid],{allowFailure:true});
  const events=(output.stdout+'\n'+output.stderr).split('\n').filter(line=>/^\[runtime\] (ready|draining|drained|Shutdown deadline or drain failure\.|Startup rejected \([A-Z0-9_]+\)\.)$/.test(line));
  lifecycle.push({service:c.Config.Labels['com.docker.compose.service'],exitCode:c.State.ExitCode,status:c.State.Status,oomKilled:c.State.OOMKilled,events});
 }
 console.error(JSON.stringify({status:'NOT-PASSED',code:e instanceof Error&&/^[A-Z0-9_]+$/.test(e.message)?e.message:typeof e?.code==='string'&&/^[A-Z0-9_]+$/.test(e.code)?e.code:'COMPOSE_REHEARSAL_FAILED',actual:typeof e?.actual==='number'||typeof e?.actual==='boolean'?e.actual:undefined,expected:typeof e?.expected==='number'||typeof e?.expected==='boolean'?e.expected:undefined,locations:e instanceof Error?e.stack?.split('\n').filter(line=>line.includes('rehearse-compose.ts:')).map(line=>line.match(/rehearse-compose\.ts:\d+:\d+/)?.[0]):undefined,lifecycle,productionConnected:false,realOidc:false}));process.exitCode=1;
}).finally(async()=>{
 if(!fixture)return;assertFixtureRoot(fixture.root,fixture.marker);
 for(const p of started.reverse()){
  for(const type of ['container','volume','network'] as const)await ownedResources(p,type);
  // Project names are random and ownership-checked. These are exclusively new
  // synthetic volumes; no external/production backup or existing volume input.
  await compose(p,['down','--volumes','--remove-orphans','--timeout','40']);
  for(const type of ['container','volume','network'] as const)assert.equal((await ownedResources(p,type)).length,0,'ISOLATED_COMPOSE_CLEANUP_INCOMPLETE');
 }
});
