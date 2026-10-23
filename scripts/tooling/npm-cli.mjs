// Resolve npm's JavaScript entry point; never execute a PATH shell/cmd shim.
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {basename,dirname,isAbsolute,join} from 'node:path';

function npmEntry(candidate){
  try{
    if(!isAbsolute(candidate))return;
    const file=realpathSync(candidate);
    if(!statSync(file).isFile()||basename(file)!=='npm-cli.js'||basename(dirname(file))!=='bin')return;
    const pkg=JSON.parse(readFileSync(join(dirname(file),'../package.json'),'utf8'));
    if(pkg.name==='npm'&&pkg.bin?.npm==='bin/npm-cli.js')return file;
  }catch{/* A missing or unrelated candidate is not an executable fallback. */}
}

/** @param {{execPath?:string,environment?:Record<string,string|undefined>,platform?:string}} [options] */
export function resolveNpmCli({execPath=process.execPath,environment=process.env,platform=process.platform}={}){
  const candidates=[];
  if(environment.npm_execpath)candidates.push(environment.npm_execpath);
  const nodes=[execPath];try{nodes.push(realpathSync(execPath));}catch{/* Test/missing toolchain. */}
  for(const node of new Set(nodes)){
    candidates.push(join(dirname(node),'node_modules/npm/bin/npm-cli.js'));
    candidates.push(join(dirname(node),'../lib/node_modules/npm/bin/npm-cli.js'));
  }
  // Distro installations can put npm under /usr/share/nodejs, exposed by a
  // symlink on PATH. Ignore empty/relative PATH entries (including the cwd).
  for(const directory of (environment.PATH??environment.Path??'').split(platform==='win32'?';':':')){
    if(!isAbsolute(directory))continue;
    if(platform==='win32')candidates.push(join(directory,'node_modules/npm/bin/npm-cli.js'));
    else try{candidates.push(realpathSync(join(directory,'npm')));}catch{/* No npm in this directory. */}
  }
  for(const candidate of candidates){const file=npmEntry(candidate);if(file)return file;}
  throw Error('NPM_CLI_PATH_REQUIRED');
}
