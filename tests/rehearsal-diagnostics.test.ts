import test from 'node:test';
import assert from 'node:assert/strict';
import {outputEvidence,rehearsalErrorEvidence} from '../scripts/tooling/rehearsal-diagnostics.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname,resolve,delimiter} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

test('rehearsal diagnostics keep filesystem/module causes and code locations but never child messages',()=>{
 const secret='PUBLIC-synthetic-password-that-must-never-be-printed';
 const text=`Error EACCES: permission denied /private/${secret}\n at tool (/tool/scripts/rehearse-selfhost.ts:28:11)\npostgresql://fixture:${secret}@localhost/private\nSCRAM-SHA-256$4096:${secret}`;
 const report=outputEvidence('',text),serialized=JSON.stringify(report);
 assert.ok(report.codes.includes('EACCES'));assert.ok(report.reasons.includes('PERMISSION_DENIED'));assert.deepEqual(report.locations,['rehearse-selfhost.ts:28:11']);
 for(const value of [secret,'postgresql://','SCRAM-SHA-256','/private/'])assert.ok(!serialized.includes(value));
 assert.ok(outputEvidence('MODULE_NOT_FOUND: cannot find module '+secret).codes.includes('MODULE_NOT_FOUND'));
 assert.equal(outputEvidence('{"stage":"runtime-lifecycle"}\n{"stage":"'+secret+'"}').lastStage,'runtime-lifecycle');
 assert.deepEqual(outputEvidence('{"locations":["permissions.ts:8:3"]}').locations,['permissions.ts:8:3']);
});
test('Docker wrapper identifies the failed run, scrubs child credentials and enforces volume ownership',{skip:process.platform!=='linux'},()=>{
 const harness=resolve('scripts/rehearse-selfhost-docker.mjs');
 for(const failure of ['initialize','verify','cleanup']){
  const root=mkdtempSync(join(tmpdir(),'koonpinai-docker-diagnostic-'));
  try{
   mkdirSync(join(root,'runtime'));writeFileSync(join(root,'package-lock.json'),'PUBLIC fixture');writeFileSync(join(root,'runtime/secrets.mjs'),'PUBLIC fixture');
   const poison='PUBLIC-synthetic-do-not-leak-credential';
   const source=`#!${process.execPath}\nconst a=process.argv.slice(2);if(process.env.AUTH_SECRET||process.env.NODE_OPTIONS)process.exit(91);if(a[0]==='version'){console.log('linux');process.exit(0);}if(a[0]==='run'&&(${JSON.stringify(failure)}==='initialize'||${JSON.stringify(failure)}==='verify'&&a.includes('--init'))){console.error('EACCES: permission denied postgresql://fixture:${poison}@localhost/private');process.exit(1);}if(a[0]==='volume'&&a[1]==='inspect'){console.log(JSON.stringify([{Labels:{'koonpinai.portable.rehearsal':${JSON.stringify(failure)}==='cleanup'?'foreign':a[2].replace(/-artifact$/,'')}}]));}\n`;
   writeFileSync(join(root,'docker'),source,{mode:0o700});
   const result=spawnSync(process.execPath,[harness],{cwd:root,encoding:'utf8',env:{NODE_ENV:'test',PATH:root+delimiter+dirname(process.execPath),HOME:root,AUTH_SECRET:poison},timeout:10000});
   assert.equal(result.status,1);const output=result.stdout+result.stderr;assert.ok(!output.includes(poison));assert.ok(!output.includes('postgresql://'));
   if(failure==='cleanup'){assert.ok(output.includes('OWNED_VOLUME_CLEANUP_FAILED'));assert.ok(!output.includes('"stage":"removeVolume"'));}
   else{const report=result.stderr.split('\n').filter(Boolean).map(s=>JSON.parse(s)).find(r=>r.status==='NOT-PASSED');assert.equal(report.evidence.operation,failure==='initialize'?'initializeVolume':'verify');assert.equal(report.evidence.stage,'run');assert.ok(report.evidence.command.startsWith('docker run'));assert.ok(report.evidence.codes.includes('EACCES'));assert.ok(report.evidence.reasons.includes('PERMISSION_DENIED'));}
  }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));rmSync(root,{recursive:true,force:true});}
 }
});
test('native error evidence discards assertion values, SQL/driver messages, unknown fields and unsafe child data',()=>{
 const secret='PUBLIC-fixture-token-keep-private';
 const error=Object.assign(Error(secret),{code:'ERR_ASSERTION',actual:secret,expected:0,query:'SELECT '+secret,evidence:{program:'node',exitCode:1,codes:['EROFS',secret],reasons:['READ_ONLY_FILESYSTEM',secret],stderr:secret}});
 const report=rehearsalErrorEvidence(error),text=JSON.stringify(report);
 assert.ok(report.codes.includes('ERR_ASSERTION'));assert.equal(report.expected,0);assert.ok(!('actual' in report));assert.ok(!text.includes(secret));
 assert.ok(report.child?.codes.includes('EROFS'));assert.equal(report.child?.exitCode,1);assert.ok(report.child?.reasons.includes('READ_ONLY_FILESYSTEM'));
 assert.deepEqual(outputEvidence(secret),{codes:[],reasons:[],locations:[]});
 const playwright=Object.assign(Error('Timed out 5000ms waiting for expect '+secret),{matcherResult:{name:'toHaveURL',timeout:5000,actual:'https://app.example/?token='+secret,expected:secret}});
 const diagnostic=rehearsalErrorEvidence(playwright);assert.ok(diagnostic.codes.includes('PLAYWRIGHT_TIMEOUT'));assert.deepEqual(diagnostic.assertion,{name:'toHaveURL',timeoutMs:5000});assert.ok(!JSON.stringify(diagnostic).includes(secret));
 assert.deepEqual(outputEvidence('',JSON.stringify({status:'FAIL',evidence:{assertion:{name:'toHaveURL',timeoutMs:5000,actual:secret}}})).assertion,{name:'toHaveURL',timeoutMs:5000});
});
