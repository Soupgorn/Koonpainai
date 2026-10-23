// Local Linux Docker only. No dotenv, hosted credentials, pushes or deployment.
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {osEnvironment} from '../runtime/secrets.mjs';
const id='kp-portable-'+randomUUID().slice(0,10),web=id+':web',tools=id+':tools',volume=id+'-artifact',label='koonpinai.portable.rehearsal';let created=false;
async function docker(args){return new Promise((ok,fail)=>{const c=spawn('docker',args,{env:osEnvironment(),windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',stderr='';const t=setTimeout(()=>{c.kill();fail(Error('DOCKER_REHEARSAL_TIMEOUT'));},1200000);c.stdout.on('data',b=>{if(out.length<2e6)out+=b.toString();});c.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-16000);});c.on('error',()=>{clearTimeout(t);fail(Error('DOCKER_UNAVAILABLE'));});c.on('exit',code=>{clearTimeout(t);if(code===0)ok(out);else{const e=Error('DOCKER_REHEARSAL_FAILED');e.evidence={stage:args[0],exitCode:code,missingModule:/code: ['"]MODULE_NOT_FOUND['"]/.test(stderr)};fail(e);}});});}
try{
 const os=(await docker(['version','--format','{{.Server.Os}}'])).trim();if(os!=='linux'||process.platform!=='linux')throw Error('LINUX_DOCKER_REQUIRED');
 const build=createHash('sha256').update(readFileSync('package-lock.json')).update(readFileSync('runtime/secrets.mjs')).digest('hex');
 await docker(['build','--build-arg','KOONPINAI_BUILD_ID='+build,'-t',web,'.']);
 await docker(['build','-f','operations/selfhost/Dockerfile.tools','--target','verification','-t',tools,'.']);
 await docker(['volume','create','--label',label+'='+id,volume]);created=true;
 await docker(['run','--rm','--user','0:0','--entrypoint','sh','-v',volume+':/artifact',web,'-c','cp -a /app/. /artifact/ && chown -R 1002:1002 /artifact']);
 const result=await docker(['run','--rm','--init','--user','1002:1002','--read-only','--tmpfs','/tmp:rw,size=512m,mode=1777','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','2g','--cpus','2','-v',volume+':/artifact:ro','--entrypoint','node',tools,'node_modules/tsx/dist/cli.mjs','scripts/rehearse-selfhost.ts','--pg-bin=/usr/lib/postgresql/17/bin','--artifact=/artifact','--approve-isolated-writes']);
 console.log(result);
}catch(e){console.error(JSON.stringify({status:'NOT-PASSED',code:e.message,evidence:e.evidence,productionConnected:false}));process.exitCode=1;}
finally{if(created){const info=JSON.parse(await docker(['volume','inspect',volume]))[0];if(info.Labels?.[label]!==id)throw Error('OWNED_VOLUME_REQUIRED');await docker(['volume','rm',volume]);}}
