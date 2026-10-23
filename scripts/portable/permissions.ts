import {existsSync,mkdirSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {osEnvironment} from '../../runtime/secrets.mjs';
export function assertPrivatePath(path:string){
 const s=lstatSync(path);if(s.isSymbolicLink())throw Error('PRIVATE_PATH_SYMLINK_FORBIDDEN');
 if(process.platform!=='win32'){if(![0,process.getuid!()].includes(s.uid)||(s.mode&0o077)!==0)throw Error('PRIVATE_PATH_PERMISSIONS_INVALID');return;}
 const ps='$ErrorActionPreference="Stop";$p=[Console]::In.ReadToEnd();$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;foreach($r in (Get-Acl -LiteralPath $p).Access){if($r.AccessControlType -ne "Allow" -or $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($sid,"S-1-5-18")){throw "ACL"}};[Console]::Out.Write("PASS")';
 if(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{input:resolve(path),encoding:'utf8',windowsHide:true,env:{...osEnvironment(),NODE_ENV:'production'},stdio:['pipe','pipe','ignore'],timeout:10000})!=='PASS')throw Error('PRIVATE_PATH_PERMISSIONS_INVALID');
}
export function secureDirectory(path:string){
 if(!existsSync(path)){
  mkdirSync(path,{recursive:true,mode:0o700});
  if(process.platform==='win32'){
   const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true,env:{...osEnvironment(),NODE_ENV:'production'},stdio:['ignore','pipe','ignore']}).trim();
   if(!/^S-1-5-/.test(sid))throw Error('PRIVATE_DIRECTORY_IDENTITY_INVALID');
   execFileSync('icacls.exe',[resolve(path),'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{windowsHide:true,env:{...osEnvironment(),NODE_ENV:'production'},stdio:'ignore'});
  }
 }
 assertPrivatePath(path);
}
