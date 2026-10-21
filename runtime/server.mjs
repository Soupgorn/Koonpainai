import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveRuntime } from './lifecycle.mjs';
import { assertCleanBundle, NEXT_VERSION } from './secrets.mjs';
import { verifyArtifact } from './artifact.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'server.js'));
let runtime,stopRequested=false;
const stop=()=>{stopRequested=true;if(runtime)void runtime.shutdown().then(()=>process.exit(0),()=>{console.error('[runtime] Shutdown deadline or drain failure.');process.exit(1);});};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
process.on('message',m=>{if(m?.type==='shutdown')stop();});
process.on('disconnect',stop);
async function main(){
  assertCleanBundle(root);
  if(process.env.KOONPINAI_MANAGED_RUNTIME!=='1'||require('next/package.json').version!==NEXT_VERSION)throw Error('RUNTIME_VERSION_OR_LAUNCHER_INVALID');
  verifyArtifact(root,process.env.KOONPINAI_ARTIFACT_SHA256);
  process.chdir(root);
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG=JSON.stringify(JSON.parse(readFileSync(resolve(root,'runtime/next-config.json'),'utf8')));
  require('next');
  const {getRequestHandlers}=require('next/dist/server/lib/start-server');
  const {ensureInstrumentationRegistered}=require('next/dist/server/lib/router-utils/instrumentation-globals.external');
  const hooks=()=>{const h=globalThis[Symbol.for('koonpinai.runtime.lifecycle.v1')];if(!h)throw Error('RUNTIME_HOOKS_MISSING');return h;};
  runtime=await serveRuntime({host:process.env.HOSTNAME,port:Number(process.env.PORT),healthPort:Number(process.env.KOONPINAI_HEALTH_PORT),shutdownMs:Number(process.env.KOONPINAI_SHUTDOWN_MS),initialize:async server=>{const init=await getRequestHandlers({dir:root,port:Number(process.env.PORT),isDev:false,hostname:process.env.HOSTNAME,server,quiet:true});await ensureInstrumentationRegistered(root,'.next');return init;},ready:()=>hooks().ready(),closePools:()=>hooks().close(),report:event=>{console.log('[runtime] '+event);process.send?.({type:'runtime',event});}});
  if(stopRequested)stop();
}
void main().catch(error=>{
  let code='RUNTIME_STARTUP_FAILED';
  for(let e=error,n=0;e&&n<4;e=e.cause,n++){
    if(typeof e.message==='string'&&/^(ARTIFACT|RUNTIME|DATABASE|OPERATIONAL)_[A-Z_]+$/.test(e.message))code=e.message;
    else if(['MODULE_NOT_FOUND','28P01','42501','ECONNREFUSED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(e.code))code=e.code;
  }
  console.error('[runtime] Startup rejected ('+code+').');process.exit(1);
});
