import {createCipheriv,createDecipheriv,createHash,createHmac,hkdfSync,randomBytes,timingSafeEqual} from 'node:crypto';
import {createReadStream,createWriteStream,readFileSync,writeFileSync,statSync,openSync,closeSync,readSync,unlinkSync,fsyncSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {assertPrivatePath} from './permissions';

export const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export function outside(child:string,parent:string){const r=relative(resolve(parent),resolve(child));return r!==''&&(isAbsolute(r)||r==='..'||r.startsWith('..\\')||r.startsWith('../'));}
export function generateBackupKey(file:string){writeFileSync(file,JSON.stringify({format:1,key:randomBytes(32).toString('base64')}),{flag:'wx',mode:0o600});}
export function readKey(file:string){assertPrivatePath(file);const doc=JSON.parse(readFileSync(file,'utf8'));const key=Buffer.from(doc.key??'','base64');if(doc.format!==1||key.length!==32)throw Error('BACKUP_KEY_INVALID');return key;}
export async function fileHash(file:string){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
export const keyId=(key:Buffer)=>hash(key).slice(0,24);
const derive=(key:Buffer,purpose:string)=>Buffer.from(hkdfSync('sha256',key,Buffer.alloc(0),'koonpinai-backup-v1/'+purpose,32));
export function signManifest(value:unknown,key:Buffer){const signing=derive(key,'manifest');try{return createHmac('sha256',signing).update('koonpinai-manifest-v1\n').update(JSON.stringify(value)).digest('hex');}finally{signing.fill(0);}}
export function verifyManifest(value:unknown,signature:string,key:Buffer){const expected=Buffer.from(signManifest(value,key),'hex'),actual=Buffer.from(signature??'','hex');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('BACKUP_MANIFEST_AUTHENTICATION_FAILED');}
export async function encryptFile(source:string,destination:string,key:Buffer){
 const iv=randomBytes(12),header=Buffer.from(JSON.stringify({format:1,cipher:'aes-256-gcm',iv:iv.toString('base64'),keyId:keyId(key)})+'\n');
 const encryption=derive(key,'archive'),cipher=createCipheriv('aes-256-gcm',encryption,iv);encryption.fill(0);cipher.setAAD(header);
 const stream=createWriteStream(destination,{fd:openSync(destination,'wx',0o600),autoClose:true});stream.write(header);
 try{await pipeline(createReadStream(source),cipher,stream);const fd=openSync(destination,'a');try{writeFileSync(fd,cipher.getAuthTag());fsyncSync(fd);}finally{closeSync(fd);}}catch{try{unlinkSync(destination);}catch{}throw Error('BACKUP_ENCRYPTION_FAILED');}
 return fileHash(destination);
}
export async function decryptFile(source:string,destination:string,key:Buffer){
 const size=statSync(source).size,fd=openSync(source,'r'),prefix=Buffer.alloc(Math.min(1024,size));let header:Buffer,tag:Buffer;
 try{readSync(fd,prefix,0,prefix.length,0);const n=prefix.indexOf(10);if(n<0||size<n+18)throw Error('BACKUP_HEADER_INVALID');header=prefix.subarray(0,n+1);tag=Buffer.alloc(16);readSync(fd,tag,0,16,size-16);}finally{closeSync(fd);}
 const meta=JSON.parse(header.toString('utf8'));if(meta.format!==1||meta.cipher!=='aes-256-gcm'||meta.keyId!==keyId(key))throw Error('BACKUP_KEY_OR_FORMAT_MISMATCH');
 const iv=Buffer.from(meta.iv,'base64');if(iv.length!==12)throw Error('BACKUP_HEADER_INVALID');
 const encryption=derive(key,'archive'),decipher=createDecipheriv('aes-256-gcm',encryption,iv);encryption.fill(0);decipher.setAAD(header);decipher.setAuthTag(tag);
 const output=createWriteStream(destination,{fd:openSync(destination,'wx',0o600),autoClose:true});
 try{await pipeline(createReadStream(source,{start:header.length,end:size-17}),decipher,output);}catch{try{unlinkSync(destination);}catch{}throw Error('BACKUP_AUTHENTICATION_FAILED');}
 return fileHash(destination);
}
export function assertSeparatedKey(keyFile:string,archiveRoot:string,repoRoot:string){if(!outside(keyFile,archiveRoot)||!outside(keyFile,repoRoot)||!outside(archiveRoot,repoRoot)||resolve(dirname(keyFile))===resolve(archiveRoot))throw Error('BACKUP_KEYS_AND_ARCHIVES_MUST_BE_SEPARATE_AND_EXTERNAL');}
