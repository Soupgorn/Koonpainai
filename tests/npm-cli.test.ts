import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,realpathSync,symlinkSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {resolveNpmCli} from '../scripts/tooling/npm-cli.mjs';
import {spawnSync} from 'node:child_process';

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'koonpinai-npm-cli-'));
 const npm=(directory:string)=>{mkdirSync(join(directory,'bin'),{recursive:true});writeFileSync(join(directory,'package.json'),JSON.stringify({name:'npm',bin:{npm:'bin/npm-cli.js'}}));const cli=join(directory,'bin/npm-cli.js');writeFileSync(cli,'// PUBLIC test fixture; never executed');return realpathSync(cli);};
 return {root,npm,close:()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));rmSync(root,{recursive:true,force:true});}};
}
test('direct Node resolves npm in GitHub Actions/POSIX prefix layout without npm_execpath',()=>{
 const f=fixture();try{const node=join(f.root,'prefix/bin/node');const expected=f.npm(join(f.root,'prefix/lib/node_modules/npm'));assert.equal(resolveNpmCli({execPath:node,environment:{}}),expected);}finally{f.close();}
});
test('direct Node resolves the Windows adjacent npm layout, including paths with spaces',()=>{
 const f=fixture();try{const node=join(f.root,'Program Files/nodejs/node.exe');const expected=f.npm(join(dirname(node),'node_modules/npm'));assert.equal(resolveNpmCli({execPath:node,environment:{},platform:'win32'}),expected);}finally{f.close();}
});
test('validated npm_execpath works without forwarding npm configuration or running a shell shim',()=>{
 const f=fixture();try{const expected=f.npm(join(f.root,'custom/npm'));assert.equal(resolveNpmCli({execPath:join(f.root,'missing/node'),environment:{npm_execpath:expected,npm_config_userconfig:'PUBLIC-poison',AUTH_SECRET:'PUBLIC-poison'}}),expected);assert.throws(()=>resolveNpmCli({execPath:join(f.root,'missing/node'),environment:{npm_execpath:'node -e shell-injection'}}),/NPM_CLI_PATH_REQUIRED/);}finally{f.close();}
});
test('resolver rejects arbitrary scripts, impostor packages and relative PATH lookup',()=>{
 const f=fixture();try{const cli=f.npm(join(f.root,'fake/npm'));writeFileSync(join(f.root,'fake/npm/package.json'),JSON.stringify({name:'impostor',bin:{npm:'bin/npm-cli.js'}}));assert.throws(()=>resolveNpmCli({execPath:join(f.root,'missing/node'),environment:{npm_execpath:cli,PATH:'.'}}),/NPM_CLI_PATH_REQUIRED/);writeFileSync(join(f.root,'npm.cmd'),'echo PUBLIC should-not-run');assert.throws(()=>resolveNpmCli({execPath:join(f.root,'missing/node'),environment:{npm_execpath:join(f.root,'npm.cmd')}}),/NPM_CLI_PATH_REQUIRED/);}finally{f.close();}
});
test('POSIX PATH symlink supports distro npm without executing the shim',{skip:process.platform==='win32'},()=>{
 const f=fixture();try{const expected=f.npm(join(f.root,'share/nodejs/npm'));mkdirSync(join(f.root,'bin'));symlinkSync(expected,join(f.root,'bin/npm'));assert.equal(resolveNpmCli({execPath:join(f.root,'missing/node'),environment:{PATH:join(f.root,'bin')},platform:'linux'}),expected);}finally{f.close();}
});
test('the real artifact builder launches npm with no inherited credential or injection settings',()=>{
 const f=fixture();try{
  const cli=f.npm(join(f.root,'test-toolchain/npm'));
  writeFileSync(cli,"const forbidden=Object.keys(process.env).filter(k=>/^(?:AUTH_|DATABASE_|MIGRATION_|PG|NODE_OPTIONS|npm_config_)/i.test(k));console.log(JSON.stringify({forbidden}));process.exit(42);");
  const output=join(f.root,'new-output'),poison='PUBLIC-build-isolation-poison';
  const child=spawnSync(process.execPath,[resolve('scripts/build-runtime-artifact.mjs'),output],{encoding:'utf8',timeout:30000,env:{...process.env,NODE_ENV:'test',npm_execpath:cli,AUTH_SECRET:poison,DATABASE_URL:poison,MIGRATION_DATABASE_URL:poison,PGPASSWORD:poison,npm_config_userconfig:poison}});
  assert.equal(child.status,1);assert.ok(child.stderr.includes('ISOLATED_BUILD_FAILED'));
  assert.deepEqual(JSON.parse(readFileSync(join(output,'build-failure.log'),'utf8')),{forbidden:[]});
  for(const name of ['.env','.env.local','.git','.private'])assert.equal(existsSync(join(output,'build',name)),false);
  assert.ok(!(child.stdout+child.stderr).includes(poison));
 }finally{f.close();}
});
