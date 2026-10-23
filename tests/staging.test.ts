import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {assertLocalDocker,assertOwnedProject,assertProject,assertFixtureRoot,createStagingFixture,composeEnvironment,validateComposeContract,sourcePin} from '../scripts/staging/fixture';
import {validateManifest,validateRuntimeUrl} from '../runtime/secrets.mjs';
const yaml=createRequire(import.meta.url)('js-yaml') as {load(s:string):Record<string,unknown>};
test('Compose rehearsal refuses remote engines, unowned projects and foreign endpoints',()=>{
 assert.doesNotThrow(()=>assertLocalDocker('unix:///var/run/docker.sock','linux','linux'));
 for(const args of [['ssh://staging','linux','linux'],['tcp://127.0.0.1:2375','linux','linux'],['unix:///var/run/docker.sock','win32','linux'],['unix:///var/run/docker.sock','linux','windows']])assert.throws(()=>assertLocalDocker(...args as [string,string,string]));
 for(const project of ['koonpinai','main','kp-stage-production-source'])assert.throws(()=>assertProject(project));
 assert.throws(()=>assertOwnedProject('kp-stage-aabbccddeeff-source',{'com.docker.compose.project':'koonpinai'}));
});
test('actual Compose contract keeps database private, runtime mount isolated and all service UIDs fixed',()=>{
 const c=yaml.load(readFileSync('operations/selfhost/compose.yaml','utf8'));assert.doesNotThrow(()=>validateComposeContract(c));
 const wrong=structuredClone(c) as {services:{postgres:{ports?:string[]};web:{volumes:string[]}}};wrong.services.postgres.ports=['5432:5432'];assert.throws(()=>validateComposeContract(wrong));delete wrong.services.postgres.ports;wrong.services.web.volumes.push('/private/operator:/run/operator:ro');assert.throws(()=>validateComposeContract(wrong));
 const noTemp=structuredClone(c) as {services:{tools:{tmpfs:string[]}}};noTemp.services.tools.tmpfs=noTemp.services.tools.tmpfs.filter(v=>!v.startsWith('/tmp:'));assert.throws(()=>validateComposeContract(noTemp),/PRIVATE_TOOL_TEMPFS_REQUIRED/);
});
test('synthetic staging fixtures use independent credentials, portable separate keys and exact runtime-only files',()=>{
 const root=join(tmpdir(),'koonpinai-compose-unit-'+randomUUID());const f=createStagingFixture(root,'a'.repeat(64));
 try{
  assert.doesNotThrow(()=>assertFixtureRoot(root,f.marker));assert.throws(()=>createStagingFixture(root,'a'.repeat(64)));
  const secrets=f.projects.flatMap(p=>Object.values(p.secrets));assert.equal(new Set(secrets).size,secrets.length);
  for(const p of f.projects){const m=JSON.parse(readFileSync(join(p.dirs.web,'koonpinai-runtime-manifest.json'),'utf8'));assert.doesNotThrow(()=>validateManifest(m));assert.doesNotThrow(()=>validateRuntimeUrl(readFileSync(join(p.dirs.web,'database'),'utf8'),{endpoint:m.databaseEndpoint}));const env=composeEnvironment(p,{web:'synthetic:web',tools:'synthetic:tools'});assert.equal(env.KOONPINAI_WEB_PORT,'0');for(const value of Object.values(env))assert.ok(!secrets.some(s=>value.includes(s)));assert.equal(p.members.length,3);assert.equal(p.sessions.length,3);assert.equal(readFileSync(join(p.dirs.operator,'portable.backup-key.json'),'utf8'),readFileSync(f.backupKey,'utf8'));}
 }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('koonpinai-compose-unit-'));rmSync(root,{recursive:true,force:true});}
});
test('Docker build identity changes with production source and includes current source rather than just the lockfile',()=>{
 const root=join(tmpdir(),'koonpinai-pin-unit-'+randomUUID());mkdirSync(root,{mode:0o700});
 try{
  for(const dir of ['src','public','runtime'])mkdirSync(join(root,dir));
  for(const file of ['Dockerfile','package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs'])writeFileSync(join(root,file),'synthetic');
  mkdirSync(join(root,'scripts'));writeFileSync(join(root,'scripts/package-runtime.mjs'),'synthetic');
  for(const name of ['Z.ts','a.ts','é.ts'])writeFileSync(join(root,'src',name),name);
  const a=sourcePin(root);assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a,sourcePin(root));
  const compare=String.prototype.localeCompare;
  try {String.prototype.localeCompare=()=>{throw Error('HOST_COLLATION_USED');};assert.equal(sourcePin(root),a);}
  finally {String.prototype.localeCompare=compare;}
  writeFileSync(join(root,'src/page.tsx'),'changed production input');assert.notEqual(a,sourcePin(root));
 }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('koonpinai-pin-unit-'));rmSync(root,{recursive:true,force:true});}
});
