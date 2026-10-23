// Synthetic-only SSH delivery. No dotenv, remote shell interpolation or key upload.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {z} from 'zod';
import {osEnvironment} from '../../runtime/secrets.mjs';
import {verifyBackup} from './database';
import {fileHash,assertSeparatedKey,outside} from './crypto';
import {assertPrivatePath,secureDirectory} from './permissions';

const hex=z.string().regex(/^[a-f0-9]{64}$/);
export const offsiteConfig=z.object({version:z.literal(1),sshAlias:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/),remoteRoot:z.string().regex(/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/).min(6),sourceMachineSha256:hex,destinationMachineSha256:hex,approvedNonProduction:z.literal(true),separateFailureDomainConfirmed:z.literal(true)}).strict().refine(c=>c.sourceMachineSha256!==c.destinationMachineSha256,'Independent destination required');
export type OffsiteConfig=z.infer<typeof offsiteConfig>;
const locatorSchema=z.object({version:z.literal(1),id:z.string().regex(/^\d[0-9TZ-]+-[a-f0-9]{8}$/),files:z.object({'manifest.json':hex,'application.dump.enc':hex}).strict(),destinationMachineSha256:hex,syntheticOnly:z.literal(true)}).strict();
export type Transport=(exe:string,args:string[],input?:string)=>Promise<string>;
export const transport:Transport=(exe,args,input)=>new Promise((ok,fail)=>{
 const c=spawn(exe,args,{env:{...osEnvironment(),NODE_ENV:'production'},windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';
 const timer=setTimeout(()=>{c.kill();fail(Error('OFFSITE_TRANSPORT_TIMEOUT'));},300000);
 c.stdout.on('data',b=>{out=(out+b.toString()).slice(-16000);});c.stderr.resume();c.stdin.on('error',()=>{});c.stdin.end(input);
 c.on('error',()=>{clearTimeout(timer);fail(Error('OFFSITE_TRANSPORT_UNAVAILABLE'));});
 c.on('exit',code=>{clearTimeout(timer);if(code===0)ok(out);else fail(Error('OFFSITE_TRANSPORT_FAILED'));});
});
const options=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10'];
// The request is base64 JSON on stdin. Only a fixed Python command reaches SSH.
export function receiverScript(request:object){return `import base64,json,pathlib,os,stat,hashlib
r=json.loads(base64.b64decode('${Buffer.from(JSON.stringify(request)).toString('base64')}'))
root=pathlib.Path(r['root'])
assert root.is_absolute() and str(root)!='/'
for p in [root,*root.parents]: assert not p.is_symlink()
assert root.is_dir() and root.stat().st_uid==os.getuid() and root.stat().st_mode&0o077==0
identity=hashlib.sha256(pathlib.Path('/etc/machine-id').read_bytes()).hexdigest()
assert identity==r['identity'] and identity!=r['sourceIdentity']
target=root/r['id'];assert target.parent==root
if r['operation']=='prepare':
 os.mkdir(target,0o700)
 print(json.dumps({'prepared':True,'machineSha256':identity}))
else:
 assert target.is_dir() and not target.is_symlink() and target.stat().st_uid==os.getuid() and target.stat().st_mode&0o077==0
 expected=set(r['files'])|({'delivery-receipt.json'} if r['operation']=='inspect' else set())
 assert set(p.name for p in target.iterdir())==expected
 for name,digest in r['files'].items():
  p=target/name;s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_mode&0o077==0
  h=hashlib.sha256()
  with p.open('rb') as f:
   for b in iter(lambda:f.read(1048576),b''):h.update(b)
   os.fsync(f.fileno())
  assert h.hexdigest()==digest
 receipt={'format':1,'machineSha256':identity,'id':r['id'],'files':r['files'],'ciphertextOnly':True}
 if r['operation']=='finish':
  fd=os.open(target/'delivery-receipt.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as f:f.write(json.dumps(receipt));f.flush();os.fsync(f.fileno())
  fd=os.open(target,os.O_RDONLY);os.fsync(fd);os.close(fd)
 else:
  p=target/'delivery-receipt.json';s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_mode&0o077==0
  assert json.loads(p.read_text())==receipt
 print(json.dumps(receipt))
`;}
async function remote(c:OffsiteConfig,id:string,files:Record<string,string>,operation:string,run:Transport){
 const result=JSON.parse(await run('ssh',['-T',...options,c.sshAlias,'python3','-'],receiverScript({root:c.remoteRoot,identity:c.destinationMachineSha256,sourceIdentity:c.sourceMachineSha256,id,files,operation})));
 if(result.machineSha256!==c.destinationMachineSha256)throw Error('OFFSITE_IDENTITY_MISMATCH');return result;
}
export async function offsiteTransfer(o:{config:unknown;source:string;keyFile:string;repoRoot:string;syntheticOnly:true},run:Transport=transport){
 const c=offsiteConfig.parse(o.config);
 if(o.syntheticOnly!==true)throw Error('SYNTHETIC_OFFSITE_ONLY');
 assertSeparatedKey(o.keyFile,o.source,o.repoRoot);
 const m=await verifyBackup(o.source,o.keyFile);
 if(m.reason!=='isolated'||!/^\d[0-9TZ-]+-[a-f0-9]{8}$/.test(m.id))throw Error('SYNTHETIC_ARCHIVE_REQUIRED');
 const names=['manifest.json','application.dump.enc'];
 const files:Record<string,string>={};for(const name of names){const p=join(o.source,name);assertPrivatePath(p);if(!lstatSync(p).isFile())throw Error('ARCHIVE_REGULAR_FILE_REQUIRED');files[name]=await fileHash(p);}
 await remote(c,m.id,files,'prepare',run);
 for(const name of names)await run('scp',[...options,'--',resolve(join(o.source,name)),`${c.sshAlias}:${c.remoteRoot}/${m.id}/${name}`]);
 await remote(c,m.id,files,'finish',run);
 return {status:'PASS',id:m.id,ciphertextOnly:true,keyUploaded:false,remoteMachineVerified:true,failureDomainOwnerConfirmed:true,independentFailureDomainAudit:false,restoredToPostgres:false,locator:{version:1,id:m.id,files,destinationMachineSha256:c.destinationMachineSha256,syntheticOnly:true}};
}
/** Recovery deliberately requires no original archive or source database. */
export async function retrieveOffsite(o:{config:unknown;locator:unknown;keyFile:string;repoRoot:string;destination:string},run:Transport=transport){
 const c=offsiteConfig.parse(o.config),locator=locatorSchema.parse(o.locator);
 if(locator.destinationMachineSha256!==c.destinationMachineSha256)throw Error('OFFSITE_LOCATOR_IDENTITY_MISMATCH');
 if(existsSync(o.destination))throw Error('NEW_EXTERNAL_RETRIEVAL_REQUIRED');
 assertSeparatedKey(o.keyFile,o.destination,o.repoRoot);assertPrivatePath(o.keyFile);
 await remote(c,locator.id,locator.files,'inspect',run);secureDirectory(o.destination);
 for(const name of Object.keys(locator.files))await run('scp',[...options,'--',`${c.sshAlias}:${c.remoteRoot}/${locator.id}/${name}`,resolve(join(o.destination,name))]);
 for(const [name,digest] of Object.entries(locator.files))if(await fileHash(join(o.destination,name))!==digest)throw Error('OFFSITE_LOCATOR_CHECKSUM_MISMATCH');
 const m=await verifyBackup(o.destination,o.keyFile);
 if(m.id!==locator.id||m.reason!=='isolated')throw Error('OFFSITE_ARCHIVE_IDENTITY_MISMATCH');
 return {status:'PASS',id:m.id,originalSourceRequired:false,keyUploaded:false,remoteMachineVerified:true,manifestAuthenticated:true,restoredToPostgres:false};
}
export async function offsiteCli(){
 const arg=(k:string)=>process.argv.find(s=>s.startsWith(k+'='))?.slice(k.length+1);
 const config=arg('--config'),source=arg('--backup'),keyFile=arg('--key-file'),destination=arg('--retrieve-to'),locator=arg('--locator'),receipt=arg('--receipt');
 if(!config||!keyFile||!process.argv.includes('--approve-synthetic-offsite')||(!destination&&!source)||(destination&&!locator))throw Error('EXPLICIT_SYNTHETIC_OFFSITE_APPROVAL_REQUIRED');
 if(receipt){if(!outside(receipt,process.cwd())||existsSync(receipt))throw Error('NEW_EXTERNAL_RECEIPT_REQUIRED');secureDirectory(dirname(receipt));}
 assertPrivatePath(config);const c=JSON.parse(readFileSync(config,'utf8'));
 const result=destination?await retrieveOffsite({config:c,locator:JSON.parse(readFileSync(locator!,'utf8')).locator,keyFile,repoRoot:process.cwd(),destination}):await offsiteTransfer({config:c,source:source!,keyFile,repoRoot:process.cwd(),syntheticOnly:true});
 if(receipt)writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify(result));
}
