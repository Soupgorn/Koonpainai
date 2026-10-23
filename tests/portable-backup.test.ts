import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join,dirname,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID,X509Certificate} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {encryptFile,decryptFile,signManifest,verifyManifest,assertSeparatedKey,outside} from '../scripts/portable/crypto';
import {retentionPlan,pgEnvironment} from '../scripts/portable/database';
import {secureDirectory} from '../scripts/portable/permissions';
test('portable authenticated backup encryption recovers exact bytes and rejects tampering, wrong keys and overwrite',async()=>{
 const root=join(tmpdir(),'koonpinai-portable-unit-'+randomUUID());secureDirectory(root);const key=randomBytes(32);
 try{
  const source=join(root,'plain'),encrypted=join(root,'encrypted'),restored=join(root,'restored');writeFileSync(source,randomBytes(1024*1024+17));
  await encryptFile(source,encrypted,key);await decryptFile(encrypted,restored,key);assert.deepEqual(readFileSync(source),readFileSync(restored));
  await assert.rejects(encryptFile(source,encrypted,key));assert.ok(existsSync(encrypted));await assert.rejects(decryptFile(encrypted,restored,key));assert.deepEqual(readFileSync(source),readFileSync(restored));
  await assert.rejects(decryptFile(encrypted,join(root,'wrong'),randomBytes(32)));assert.equal(existsSync(join(root,'wrong')),false);
  const changed=readFileSync(encrypted);changed[changed.length-20]^=1;writeFileSync(join(root,'tampered'),changed);await assert.rejects(decryptFile(join(root,'tampered'),join(root,'invalid'),key));assert.equal(existsSync(join(root,'invalid')),false);
  const manifest={id:'fixture',sha256:'a'.repeat(64)};const signature=signManifest(manifest,key);assert.doesNotThrow(()=>verifyManifest(manifest,signature,key));assert.throws(()=>verifyManifest({...manifest,id:'forged'},signature,key));assert.throws(()=>verifyManifest(manifest,signature,randomBytes(32)));
 }finally{key.fill(0);assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('koonpinai-portable-unit-'));rmSync(root,{recursive:true,force:true});}
});
test('keys and archives must be external and separate; operational children inherit no web or migration secrets',()=>{
 assert.throws(()=>assertSeparatedKey('/repo/key','/repo/backups','/repo'));assert.equal(outside('/tmp/key','/tmp/backups'),true);
 assert.equal(outside(join(process.cwd(),'nested'),process.cwd()),false);assert.equal(outside(process.cwd(),process.cwd()),false);
 if(process.platform==='win32')assert.equal(outside('C:\\private\\backup','D:\\Project\\Koonpinai'),true);
 const root=join(tmpdir(),'koonpinai-portable-unit-'+randomUUID());secureDirectory(root);
 try{const ca=rootCertificates.find(p=>{const c=new X509Certificate(p);return c.ca&&Date.parse(c.validTo)>Date.now()&&Date.parse(c.validFrom)<Date.now();});assert.ok(ca);const file=join(root,'ca.crt');writeFileSync(file,ca);const env=pgEnvironment({url:'postgresql://fixture:fixture@db.example.invalid:5432/fixture',caFile:file},true);
 assert.equal(env.PGSSLMODE,'verify-full');assert.match(env.PGOPTIONS!,/default_transaction_read_only=on/);assert.equal(env.DATABASE_URL,undefined);assert.equal(env.MIGRATION_DATABASE_URL,undefined);assert.equal(env.AUTH_SECRET,undefined);
 }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('koonpinai-portable-unit-'));rmSync(root,{recursive:true,force:true});}
});
test('retention keeps daily, weekly, monthly recovery points and protects pre-migration archives without deleting files',()=>{
 const records=Array.from({length:150},(_,i)=>({id:String(i),createdAt:new Date(Date.UTC(2026,9,22-i)).toISOString(),reason:i===149?'pre-migration':'scheduled'}));
 const plan=retentionPlan(records,new Date('2026-10-22T12:00:00Z'));assert.equal(plan.deletionExecuted,false);for(let i=0;i<7;i++)assert.ok(plan.keep.includes(String(i)));assert.ok(plan.keep.includes('149'));assert.ok(plan.candidates.length>100);assert.equal(plan.keep.some(id=>plan.candidates.includes(id)),false);
});
