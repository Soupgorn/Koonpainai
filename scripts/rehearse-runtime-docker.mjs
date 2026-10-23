// Compatibility entry point. The production Compose rehearsal supersedes the
// old shared-network-namespace fixture and tests real deployment topology.
// No dotenv, production credentials, SSH contexts or infrastructure deployment.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {osEnvironment} from '../runtime/secrets.mjs';

const root=resolve(import.meta.dirname,'..');
const child=spawn(process.execPath,[resolve(root,'node_modules/tsx/dist/cli.mjs'),resolve(root,'scripts/rehearse-compose.ts'),'--approve-isolated-writes'],{
  cwd:root,env:osEnvironment(),stdio:'inherit',windowsHide:true,
});
child.on('error',()=>{console.error(JSON.stringify({status:'NOT-PASSED',code:'COMPOSE_REHEARSAL_START_FAILED',productionConnected:false}));process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
