import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

/** Same PID1/Windows signal forwarding for real launcher and fixture rehearsal. */
export function supervise(root,env){
  const child=spawn(process.execPath,[resolve(root,'runtime/server.mjs')],{cwd:root,env,stdio:['ignore','inherit','inherit','ipc'],windowsHide:true});
  const stop=()=>{if(child.connected)child.send({type:'shutdown'});};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);process.on('disconnect',stop);
  process.on('message',m=>{if(m?.type==='shutdown')stop();});
  child.on('message',m=>process.send?.(m));
  child.on('error',()=>{console.error('[runtime] Launch rejected.');process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;if(process.connected)process.disconnect();});
  return child;
}
