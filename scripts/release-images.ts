// Seals already-reviewed Linux images. Does not build, push, deploy or connect to a DB.
import {spawn} from 'node:child_process';
import {createWriteStream,writeFileSync,readFileSync,existsSync,lstatSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {osEnvironment} from '../runtime/secrets.mjs';
import {POLICY_VERSION} from '../src/lib/auth/domain';
import {fileHash,outside} from './portable/crypto';
import {assertPrivatePath,secureDirectory} from './portable/permissions';
import {assertLocalDocker} from './staging/fixture';

const hex=z.string().regex(/^[a-f0-9]{64}$/);
const image=z.object({imageId:z.string().regex(/^sha256:[a-f0-9]{64}$/),artifactSha256:hex,sourcePin:hex}).strict();
export const releaseConfig=z.object({version:z.literal(1),candidate:image,rollback:image,output:z.string(),rollbackKind:z.literal('previous-verified-staging-build')}).strict().refine(v=>v.candidate.imageId!==v.rollback.imageId,'Distinct images required');
export function validateImage(config:Record<string,unknown>,metadata:Record<string,unknown>,expected:string,sourcePin:string){
 const allowed=new Set(['PATH','NODE_VERSION','YARN_VERSION','NODE_ENV','NEXT_TELEMETRY_DISABLED','PORT','HOSTNAME']);
 if(config.User!=='nodeapp'||config.WorkingDir!=='/app'||config.StopSignal!=='SIGTERM'||!config.Healthcheck||JSON.stringify(config.Cmd)!==JSON.stringify(['node','runtime/launch.mjs','/run/secrets/koonpinai-runtime-manifest.json']))throw Error('RELEASE_RUNTIME_CONFIGURATION_MISMATCH');
 if(!Array.isArray(config.Env)||config.Env.some((s:string)=>!allowed.has(s.split('=')[0])))throw Error('UNEXPECTED_IMAGE_ENVIRONMENT');
 if(metadata.artifactSha256!==expected||metadata.buildId!==sourcePin||metadata.policyVersion!==POLICY_VERSION||metadata.next!=='16.4.2'||metadata.nodeMajor!==24||metadata.schemaMigrationsApplied!==false)throw Error('RELEASE_ARTIFACT_MISMATCH');
}
async function docker(args:string[]){return new Promise<string>((ok,fail)=>{
 const p=spawn('docker',args,{env:{...osEnvironment(),NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});let out='';const timer=setTimeout(()=>{p.kill();fail(Error('RELEASE_DOCKER_TIMEOUT'));},300000);
 p.stdout.on('data',b=>{out=(out+b.toString()).slice(-2e6);});p.stderr.resume();p.on('error',()=>{clearTimeout(timer);fail(Error('RELEASE_DOCKER_UNAVAILABLE'));});p.on('exit',code=>{clearTimeout(timer);if(code===0)ok(out);else fail(Error('RELEASE_DOCKER_FAILED'));});
});}
async function save(imageId:string,file:string){
 const p=spawn('docker',['image','save',imageId],{env:{...osEnvironment(),NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});p.stderr.resume();
 const timer=setTimeout(()=>p.kill(),300000);
 const exited=new Promise<void>((ok,fail)=>{p.once('error',()=>fail(Error('RELEASE_EXPORT_FAILED')));p.once('exit',code=>code===0?ok():fail(Error('RELEASE_EXPORT_FAILED')));});
 try{await Promise.all([pipeline(p.stdout,createWriteStream(file,{flags:'wx',mode:0o600})),exited]);}finally{clearTimeout(timer);}
}
export async function verifyReleaseFiles(root:string,manifest:unknown){
 const m=z.object({format:z.literal(1),images:z.array(z.object({file:z.enum(['candidate.tar','rollback.tar']),archiveSha256:hex}).passthrough()).length(2)}).passthrough().parse(manifest);
 if(new Set(m.images.map(i=>i.file)).size!==2)throw Error('RELEASE_ARCHIVE_SET_MISMATCH');
 for(const i of m.images){const p=join(root,i.file);assertPrivatePath(p);if(!lstatSync(p).isFile()||await fileHash(p)!==i.archiveSha256)throw Error('RELEASE_ARCHIVE_CHECKSUM_MISMATCH');}
 return true;
}
export async function sealRelease(input:unknown){
 const c=releaseConfig.parse(input);
 if(!outside(c.output,process.cwd())||existsSync(c.output))throw Error('NEW_EXTERNAL_RELEASE_DIRECTORY_REQUIRED');
 const context=JSON.parse(await docker(['context','inspect']))[0];assertLocalDocker(context.Endpoints?.docker?.Host,process.platform,(await docker(['version','--format','{{.Server.Os}}'])).trim());
 secureDirectory(c.output);const images=[];
 for(const [kind,expected] of [['candidate',c.candidate],['rollback',c.rollback]] as const){
  const info=JSON.parse(await docker(['image','inspect',expected.imageId]))[0];if(info.Id!==expected.imageId)throw Error('RELEASE_IMAGE_ID_MISMATCH');
  const code=`import('/app/runtime/artifact.mjs').then(({verifyArtifact})=>{const f=require('fs'),c=require('crypto');const b=f.readFileSync('/app/runtime-artifact.json'),m=verifyArtifact('/app','${expected.artifactSha256}');process.stdout.write(JSON.stringify({artifactSha256:c.createHash('sha256').update(b).digest('hex'),buildId:m.buildId,policyVersion:m.policyVersion,next:m.next,nodeMajor:m.nodeMajor,schemaMigrationsApplied:m.schemaMigrationsApplied}));}).catch(()=>process.exit(1));`;
  const metadata=JSON.parse(await docker(['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--cpus','0.25','--pids-limit','32','--entrypoint','node',expected.imageId,'-e',code]));
  validateImage(info.Config,metadata,expected.artifactSha256,expected.sourcePin);
  const file=kind+'.tar';await save(expected.imageId,join(c.output,file));
  images.push({kind,file,imageId:expected.imageId,sourcePin:expected.sourcePin,artifactSha256:expected.artifactSha256,archiveSha256:await fileHash(join(c.output,file))});
 }
 const report={format:1,at:new Date().toISOString(),policyVersion:POLICY_VERSION,images,rollbackKind:c.rollbackKind,productionReleaseRollbackCompatibilityVerified:false,productionConnected:false,rebuildRequired:false,byteReproducibleRebuildProven:false};
 await verifyReleaseFiles(c.output,report);
 // Load only our just-created, checksum-verified images; no service starts.
 for(const i of images){await docker(['image','load','--input',resolve(join(c.output,i.file))]);if(JSON.parse(await docker(['image','inspect',i.imageId]))[0].Id!==i.imageId)throw Error('RELEASE_RELOAD_IDENTITY_MISMATCH');}
 writeFileSync(join(c.output,'release-pair.json'),JSON.stringify({...report,archiveReloadVerified:true},null,2)+'\n',{flag:'wx',mode:0o600});
 return {...report,archiveReloadVerified:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv.find(s=>s.startsWith('--config='))?.slice(9);
 void (async()=>{if(!file)throw Error('EXPLICIT_RELEASE_CONFIG_REQUIRED');assertPrivatePath(file);const report=await sealRelease(JSON.parse(readFileSync(file,'utf8')));console.log(JSON.stringify({status:'PASS',...report}));})().catch(()=>{console.error(JSON.stringify({status:'FAIL',code:'RELEASE_SEAL_FAILED',productionConnected:false,partialArtifactsPreserved:true}));process.exitCode=1;});
}
