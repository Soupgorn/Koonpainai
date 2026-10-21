import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuntimeEnvironment,assertNoInheritedCredentials,assertRuntimeSecretDirectory } from './secrets.mjs';
import { supervise } from './supervise.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try {
  if(process.argv.length!==3)throw Error('MANIFEST_PATH_REQUIRED');
  assertNoInheritedCredentials();
  assertRuntimeSecretDirectory(resolve(process.argv[2]));
  const env=loadRuntimeEnvironment(resolve(process.argv[2]),root);
  supervise(root,env);
}catch{console.error('[runtime] Secret or configuration rejected.');process.exitCode=1;}
