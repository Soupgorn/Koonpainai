// Called inside a secret-free build tree; never loads dotenv or accesses a DB.
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { assertCleanBundle, NEXT_VERSION } from '../runtime/secrets.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function packageRuntime(build, output) {
  if(existsSync(output))throw Error('ARTIFACT_OUTPUT_MUST_BE_NEW');
  assertCleanBundle(build);
  const required=JSON.parse(readFileSync(join(build,'.next/required-server-files.json'),'utf8'));
  if(Object.keys(required.config.env??{}).length)throw Error('BUILD_ENV_EMBEDDING_FORBIDDEN');
  const lock=JSON.parse(readFileSync(join(build,'package-lock.json'),'utf8'));
  if(lock.packages['node_modules/next'].version!==NEXT_VERSION)throw Error('NEXT_VERSION_NOT_REVIEWED');
  const policy=readFileSync(join(build,'src/lib/auth/domain.ts'),'utf8').match(/POLICY_VERSION\s*=\s*"([^"]+)"/)?.[1];
  if(policy!=='2026-10-22-student-v3')throw Error('POLICY_RENEWAL_MUST_BE_PRESERVED');
  cpSync(join(build,'.next/standalone'),output,{recursive:true,errorOnExist:true});
  cpSync(join(build,'.next/static'),join(output,'.next/static'),{recursive:true});
  cpSync(join(build,'public'),join(output,'public'),{recursive:true});
  cpSync(join(build,'runtime'),join(output,'runtime'),{recursive:true});
  writeFileSync(join(output,'runtime/next-config.json'),JSON.stringify(required.config));
  const pkg=JSON.parse(readFileSync(join(output,'package.json'),'utf8'));pkg.scripts={start:'node runtime/launch.mjs'};
  writeFileSync(join(output,'package.json'),JSON.stringify(pkg,null,2)+'\n');
  assertCleanBundle(output);
  const files={};
  function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const f=join(dir,entry.name);if(lstatSync(f).isSymbolicLink())throw Error('ARTIFACT_SYMLINK_FORBIDDEN');if(entry.isDirectory())walk(f);else{const rel=relative(output,f).replaceAll('\\','/');if(/(^|\/)(\.env(?:\..*)?|\.private|\.git)$/.test(rel))throw Error('PRIVATE_ARTIFACT_FILE');files[rel]=sha(readFileSync(f));}}}
  walk(output);
  const manifest={format:1,next:NEXT_VERSION,nodeMajor:24,policyVersion:policy,buildId:readFileSync(join(output,'.next/BUILD_ID'),'utf8').trim(),lockSha256:sha(readFileSync(join(build,'package-lock.json'))),schemaMigrationsApplied:false,previewMode:'forbidden-in-production',files};
  mkdirSync(join(output,'runtime'),{recursive:true});writeFileSync(join(output,'runtime-artifact.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {output,files:Object.keys(files).length,artifactManifestSha256:sha(readFileSync(join(output,'runtime-artifact.json'))),policyVersion:policy};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  try{if(process.argv.length!==3)throw Error();console.log(JSON.stringify(packageRuntime(process.cwd(),resolve(process.argv[2]))));}
  catch(error){const code=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'ARTIFACT_PACKAGING_FAILED';console.error(JSON.stringify({status:'FAIL',code}));process.exitCode=1;}
}
