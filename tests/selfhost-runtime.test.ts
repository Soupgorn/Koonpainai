import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeUrl,validateManifest} from '../runtime/secrets.mjs';
import {resolve} from 'node:path';
test('self-hosted runtime requires an explicit exact endpoint and the dedicated role',()=>{
 const endpoint={kind:'self-hosted',host:'postgres',port:5432,database:'koonpinai'};
 const url='postgresql://koonpinai_runtime:PUBLIC-fixture@postgres:5432/koonpinai?sslmode=verify-full';
 assert.doesNotThrow(()=>validateRuntimeUrl(url,{endpoint}));
 assert.throws(()=>validateRuntimeUrl(url));
 for(const u of [url.replace('postgres:5432','other:5432'),url.replace(':5432',':6543'),url.replace('koonpinai_runtime','postgres'),url.replace('/koonpinai','/other'),url.replace('verify-full','require')])assert.throws(()=>validateRuntimeUrl(u,{endpoint}));
 assert.throws(()=>validateRuntimeUrl('postgresql://koonpinai_runtime.project:PUBLIC-fixture@fixture.pooler.supabase.com:5432/koonpinai',{endpoint}));
});
test('self-hosted manifest rejects provider endpoints, owner routes and mixed hosted credential formats',()=>{
 const file=resolve('PUBLIC-fixture-unused');
 const m={version:1,artifactSha256:'a'.repeat(64),authUrl:'https://app.example/',clientId:'PUBLIC-fixture',database:{file,format:'text'},authSecret:{file,format:'text'},clientSecret:{file,format:'text'},caFile:file,port:3330,healthPort:3331,host:'127.0.0.1',shutdownMs:30000,databaseEndpoint:{kind:'self-hosted',host:'postgres',port:5432,database:'koonpinai'}};
 assert.doesNotThrow(()=>validateManifest(m));
 for(const host of ['example.pooler.supabase.com','db.example.supabase.co','supabase.com'])assert.throws(()=>validateManifest({...m,databaseEndpoint:{...m.databaseEndpoint,host}}));
 assert.throws(()=>validateManifest({...m,databaseEndpoint:{...m.databaseEndpoint,port:0}}));
 assert.throws(()=>validateManifest({...m,databaseEndpoint:{...m.databaseEndpoint,user:'postgres'}}));
 assert.throws(()=>validateManifest({...m,database:{file,format:'dpapi-runtime-v1'},databaseTarget:{host:'example.pooler.supabase.com',user:'koonpinai_runtime.example',database:'postgres'}}));
});
