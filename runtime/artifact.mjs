import {readFileSync,lstatSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {NEXT_VERSION} from './secrets.mjs';
export function verifyArtifact(root,expectedSha){
  const sha=b=>createHash('sha256').update(b).digest('hex');
  const bytes=readFileSync(resolve(root,'runtime-artifact.json'));
  if(!/^[a-f0-9]{64}$/.test(expectedSha??'')||sha(bytes)!==expectedSha)throw Error('ARTIFACT_PIN_MISMATCH');
  const m=JSON.parse(bytes);
  if(m.format!==1||m.next!==NEXT_VERSION||m.policyVersion!=='2026-10-22-student-v3'||m.schemaMigrationsApplied!==false||m.nodeMajor!==24||!process.versions.node.startsWith('24.'))throw Error('ARTIFACT_VERSION_MISMATCH');
  for(const [file,pin] of Object.entries(m.files)){
    const p=resolve(root,file),r=relative(root,p);if(!r||r.startsWith('..')||isAbsolute(r)||lstatSync(p).isSymbolicLink()||sha(readFileSync(p))!==pin)throw Error('ARTIFACT_CONTENT_MISMATCH');
  }
  return m;
}
