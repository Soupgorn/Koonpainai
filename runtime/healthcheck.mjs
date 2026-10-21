// Container-local minimal readiness only; no cookies, login or account writes.
import { readFileSync } from 'node:fs';
try{
  const m=JSON.parse(readFileSync(process.argv[2]??'/run/secrets/koonpinai-runtime-manifest.json','utf8'));
  if(!Number.isInteger(m.healthPort)||m.healthPort<1024||m.healthPort>65535)throw Error();
  const response=await fetch(`http://127.0.0.1:${m.healthPort}/ready`,{signal:AbortSignal.timeout(5000)});
  if(response.status!==200)process.exitCode=1;
}catch{process.exitCode=1;}
