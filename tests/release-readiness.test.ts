import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,copyFileSync,rmSync,existsSync,constants} from 'node:fs';
import {join,dirname,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {getTableConfig} from 'drizzle-orm/pg-core';
import {studentTimetables,timetableEntries} from '../src/db/schema';
import {releaseConfig,validateImage,verifyReleaseFiles} from '../scripts/release-images';
import {offsiteConfig,offsiteTransfer,retrieveOffsite,receiverScript,type Transport} from '../scripts/portable/offsite';
import {secureDirectory} from '../scripts/portable/permissions';
import {encryptFile,signManifest,keyId,fileHash,generateBackupKey,readKey} from '../scripts/portable/crypto';

const config={version:1,sshAlias:'approved-test-vault',remoteRoot:'/private/koonpinai-backups',sourceMachineSha256:'a'.repeat(64),destinationMachineSha256:'b'.repeat(64),approvedNonProduction:true,separateFailureDomainConfirmed:true};
test('offsite requires explicit independent nonproduction destination and rejects shell/path injection',()=>{
 assert.doesNotThrow(()=>offsiteConfig.parse(config));
 for(const c of [{...config,sshAlias:'-oProxyCommand=evil'},{...config,remoteRoot:'/safe/../private'},{...config,remoteRoot:'/tmp/a;echo'},{...config,destinationMachineSha256:config.sourceMachineSha256},{...config,approvedNonProduction:false},{...config,separateFailureDomainConfirmed:false}])assert.throws(()=>offsiteConfig.parse(c));
 const script=receiverScript({value:"'shell; $(command)"});assert.ok(!script.includes('$(command)'));assert.ok(script.includes('os.O_EXCL'));assert.ok(script.includes('os.fsync'));
});
test('ciphertext-only offsite transport recovers without source archive, preserves keys and detects tampering',async()=>{
 const root=join(tmpdir(),'koonpinai-release-unit-'+randomUUID());secureDirectory(root);
 try{
  const source=join(root,'source'),vault=join(root,'fake-vault'),keys=join(root,'keys');for(const p of [source,vault,keys])secureDirectory(p);
  const keyFile=join(keys,'backup.key');generateBackupKey(keyFile);const key=readKey(keyFile),id='2026-10-22T15-00-00-000Z-abcdef01';
  const plain=join(root,'synthetic.dump');writeFileSync(plain,'PUBLIC synthetic test archive');
  const cipherSha256=await encryptFile(plain,join(source,'application.dump.enc'),key);
  const manifest={format:1,id,createdAt:'2026-10-22T15:00:00Z',reason:'isolated',keyId:keyId(key),archive:'application.dump.enc',cipherSha256,plainSha256:await fileHash(plain),projection:{tables:{},ledger:[],schemaHash:'c'.repeat(64),serverMajor:17}};
  writeFileSync(join(source,'manifest.json'),JSON.stringify({manifest,signature:signManifest(manifest,key)}),{mode:0o600});key.fill(0);
  let prepared=false,completed=false;const copies:string[]=[];
  const run:Transport=async(exe,args,input)=>{
   assert.ok(args.includes('StrictHostKeyChecking=yes'));assert.ok(args.includes('BatchMode=yes'));
   if(exe==='ssh'){
    const encoded=input!.match(/b64decode\('([^']+)'\)/)![1],request=JSON.parse(Buffer.from(encoded,'base64').toString());
    assert.equal(request.identity,config.destinationMachineSha256);
    if(request.operation==='prepare'){assert.equal(prepared,false);prepared=true;}
    else{for(const [file,digest] of Object.entries(request.files))assert.equal(await fileHash(join(vault,file)),digest);if(request.operation==='finish')completed=true;else assert.equal(completed,true);}
    return JSON.stringify({machineSha256:config.destinationMachineSha256});
   }
   assert.equal(exe,'scp');const [from,to]=args.slice(-2);assert.ok(!from.includes('backup.key'));assert.ok(!to.includes('backup.key'));
   if(from.startsWith(config.sshAlias+':'))copyFileSync(join(vault,from.split('/').pop()!),to,constants.COPYFILE_EXCL);
   else{const name=to.split('/').pop()!;copies.push(name);copyFileSync(from,join(vault,name),constants.COPYFILE_EXCL);}
   return '';
  };
  const pushed=await offsiteTransfer({config,source,keyFile,repoRoot:process.cwd(),syntheticOnly:true},run);
  assert.deepEqual(copies,['manifest.json','application.dump.enc']);assert.equal(pushed.keyUploaded,false);assert.ok(existsSync(keyFile));
  rmSync(source,{recursive:true});
  const destination=join(root,'recovered');const recovered=await retrieveOffsite({config,locator:pushed.locator,keyFile,repoRoot:process.cwd(),destination},run);
  assert.equal(recovered.originalSourceRequired,false);assert.equal(recovered.manifestAuthenticated,true);assert.equal(recovered.restoredToPostgres,false);
  await assert.rejects(retrieveOffsite({config,locator:pushed.locator,keyFile,repoRoot:process.cwd(),destination},run),/NEW_EXTERNAL/);
  const bytes=readFileSync(join(vault,'application.dump.enc'));bytes[bytes.length-1]^=1;writeFileSync(join(vault,'application.dump.enc'),bytes);
  await assert.rejects(retrieveOffsite({config,locator:pushed.locator,keyFile,repoRoot:process.cwd(),destination:join(root,'tampered')},run));
  assert.ok(!existsSync(join(root,'tampered')));assert.ok(existsSync(keyFile));
 }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('koonpinai-release-unit-'));rmSync(root,{recursive:true,force:true});}
});
test('release images require source, policy, nonroot launcher and runtime-only environment',()=>{
 const c={User:'nodeapp',WorkingDir:'/app',StopSignal:'SIGTERM',Healthcheck:{Test:['CMD','node']},Cmd:['node','runtime/launch.mjs','/run/secrets/koonpinai-runtime-manifest.json'],Env:['NODE_ENV=production']};
 const m={artifactSha256:'a'.repeat(64),buildId:'b'.repeat(64),policyVersion:'2026-10-22-student-v3',next:'16.4.2',nodeMajor:24,schemaMigrationsApplied:false};
 assert.doesNotThrow(()=>validateImage(c,m,'a'.repeat(64),'b'.repeat(64)));
 for(const v of [{...c,User:'root'},{...c,Env:['DATABASE_URL=PUBLIC-fixture']},{...c,Cmd:['node','server.js']}])assert.throws(()=>validateImage(v,m,'a'.repeat(64),'b'.repeat(64)));
 for(const v of [{...m,policyVersion:'2026-10-21'},{...m,buildId:'wrong'},{...m,schemaMigrationsApplied:true}])assert.throws(()=>validateImage(c,v,'a'.repeat(64),'b'.repeat(64)));
 const i={imageId:'sha256:'+'a'.repeat(64),artifactSha256:'a'.repeat(64),sourcePin:'b'.repeat(64)};
 assert.throws(()=>releaseConfig.parse({version:1,candidate:i,rollback:i,output:'/tmp/new',rollbackKind:'previous-verified-staging-build'}));
});
test('release archive verification fails on altered bytes or an incomplete archive pair',async()=>{
 const root=join(tmpdir(),'koonpinai-release-unit-'+randomUUID());secureDirectory(root);
 try{
  for(const f of ['candidate.tar','rollback.tar'])writeFileSync(join(root,f),randomBytes(128),{mode:0o600});
  const manifest={format:1,images:await Promise.all(['candidate.tar','rollback.tar'].map(async file=>({file,archiveSha256:await fileHash(join(root,file))})))};
  assert.equal(await verifyReleaseFiles(root,manifest),true);
  await assert.rejects(verifyReleaseFiles(root,{...manifest,images:[manifest.images[0],manifest.images[0]]}));
  writeFileSync(join(root,'candidate.tar'),'PUBLIC changed bytes');await assert.rejects(verifyReleaseFiles(root,manifest),/CHECKSUM/);
 }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('koonpinai-release-unit-'));rmSync(root,{recursive:true,force:true});}
});
test('pinned 0002 creates exactly the final Drizzle timetable columns and checks',()=>{
 const sql=readFileSync('drizzle/0002_student_timetables.sql','utf8');
 assert.equal(createHash('sha256').update(sql).digest('hex'),'3989028cb638c6518be87f77b74136f380dff6f9ada1f7864b041eafcb9ec78a');
 assert.equal([...sql.matchAll(/CREATE TABLE /g)].length,2);
 for(const table of [studentTimetables,timetableEntries]){
  const c=getTableConfig(table),body=sql.match(new RegExp('CREATE TABLE "'+c.name+'" \\(([\\s\\S]*?)\\n\\);'))![1];
  const columns=[...body.matchAll(/^\s*"([^"]+)" /gm)].map(m=>m[1]);
  assert.deepEqual(columns,c.columns.map(column=>column.name));
  for(const check of c.checks)assert.ok(body.includes('CONSTRAINT "'+check.name+'" CHECK'));
  assert.ok(sql.includes('ALTER TABLE public.'+c.name+' FORCE ROW LEVEL SECURITY'));
 }
 assert.ok(!/CREATE (?:TABLE|TYPE) "?(application_settings|timetable_sync)/i.test(sql));
});
