// New, isolated output only. Original app, dotenv and node_modules stay untouched.
import { mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { osEnvironment } from '../runtime/secrets.mjs';
import { packageRuntime } from './package-runtime.mjs';
const source=resolve(import.meta.dirname,'..');
const out=process.argv[2]?resolve(process.argv[2]):resolve(process.env.TEMP??'/tmp','koonpinai-artifact-'+randomUUID());
if(existsSync(out))throw Error('NEW_OUTPUT_DIRECTORY_REQUIRED');
mkdirSync(out,{recursive:true});const build=join(out,'build');mkdirSync(build);
const inputs=['src','public','runtime','scripts/package-runtime.mjs','package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs'];
const hash=createHash('sha256');
function digest(dir,rel){for(const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=join(dir,e.name),r=rel+'/'+e.name;if(e.isDirectory())digest(f,r);else hash.update(r).update(readFileSync(f));}}
for(const p of inputs){const f=join(source,p);if(!existsSync(f))continue;cpSync(f,join(build,p),{recursive:true,filter:f=>!/(^|[\\/])vendor([\\/]|$)|\.pdf$/i.test(f)});if(readdirSync(source).includes(p)&&!p.includes('.') )digest(join(build,p),p);else if(!['src','public','runtime'].includes(p))hash.update(p).update(readFileSync(join(build,p)));}
const sourceSha256=hash.digest('hex');
const env={...osEnvironment(),NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',KOONPINAI_BUILD_ID:sourceSha256.slice(0,32)};
async function npm(args){return new Promise((ok,fail)=>{const cli=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');if(!existsSync(cli)){fail(Error('NPM_CLI_PATH_REQUIRED'));return;}const child=spawn(process.execPath,[cli,...args],{cwd:build,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;if(output.length>2e6)output=output.slice(-2e6);});child.on('error',()=>fail(Error('BUILD_TOOL_START_FAILED')));child.on('exit',code=>{if(code===0)ok();else{writeFileSync(join(out,'build-failure.log'),output,{flag:'wx'});fail(Error('ISOLATED_BUILD_FAILED'));}});});}
try{console.log(JSON.stringify({stage:'secret-free npm ci',output:out}));await npm(['ci','--include=dev','--no-audit','--no-fund']);console.log(JSON.stringify({stage:'secret-free Next build'}));await npm(['run','build']);const result=packageRuntime(build,join(out,'artifact'));writeFileSync(join(out,'build-evidence.json'),JSON.stringify({sourceSha256,...result,secretFreeBuild:true,productionConnected:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',sourceSha256,...result}));}
catch(e){console.error(e.message);process.exitCode=1;}
