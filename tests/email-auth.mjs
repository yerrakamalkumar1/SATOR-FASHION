import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url),{build}=await import(require.resolve('esbuild',{paths:[dirname(require.resolve('drizzle-kit'))]}));
const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
class Statement{
 constructor(query,params=[]){this.query=query;this.params=params;}
 bind(...params){return new Statement(this.query,params);}
 async raw(){const q=sqlite.prepare(this.query);q.setReturnArrays(true);return q.all(...this.params);}
 async first(){return sqlite.prepare(this.query).get(...this.params)||null;}
 async all(){return {success:true,results:sqlite.prepare(this.query).all(...this.params),meta:{}};}
 async run(){const q=sqlite.prepare(this.query);if(q.columns().length)return {success:true,results:q.all(...this.params),meta:{}};const r=q.run(...this.params);return {success:true,results:[],meta:{changes:r.changes}};}
}
globalThis.__testEnv={DB:{prepare:q=>new Statement(q),batch:async rows=>{sqlite.exec('BEGIN');try{const results=[];for(const row of rows)results.push(await row.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
globalThis.__testHeaders=new Headers();
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:{auth:'app/api/auth/route.ts',session:'app/api/session/route.ts',store:'app/api/store/route.ts',journey:'app/api/journey/route.ts',portal:'app/api/portal/route.ts'},outdir:'.sites-runtime/email-auth-tests',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',plugins:[{name:'request-and-storage',setup(b){
 b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'mock'}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='headers'?'export async function headers(){return globalThis.__testHeaders;}':a.path==='navigation'?'export function redirect(){throw new Error("Unexpected redirect");}':'export const env=globalThis.__testEnv;',loader:'js'}));
}}],logLevel:'error'});
const apis={};for(const name of ['auth','session','store','journey','portal'])apis[name]=await import(resolve('.sites-runtime/email-auth-tests/'+name+'.mjs'));
const A={action:'signup',name:'Test Buyer',email:'buyer@example.test',phone:'+91 90000 00001',password:'Sample linen studio 2026!'};
const B={...A,name:'Test Designer',email:'designer@example.test',phone:'',password:'Sample midnight atelier 2026!'};
const cookieOf=response=>response.headers.get('set-cookie')?.split(';')[0]||'';
async function post(api,data,cookie='',headers={}){
 const h=new Headers({origin:'https://sator.test','Content-Type':'application/json','cf-connecting-ip':'192.0.2.5',cookie,...headers});
 globalThis.__testHeaders=h;
 const response=await apis[api].POST(new Request('https://sator.test/api/'+api,{method:'POST',headers:h,body:typeof data==='string'?data:JSON.stringify(data)}));
 return {response,status:response.status,data:await response.json(),cookie:cookieOf(response)};
}
async function get(api,cookie='',headers={}){globalThis.__testHeaders=new Headers({cookie,...headers});const response=await apis[api].GET(new Request('https://sator.test/api/'+api,{headers:globalThis.__testHeaders}));return {status:response.status,data:await response.json()};}
let passed=0;const pass=label=>{passed++;console.log('PASS '+label);};
const originalCount=()=>sqlite.prepare('SELECT count(*) AS n FROM email_accounts').get().n;
assert.equal((await post('auth',A,'',{origin:'https://other.test'})).status,403);
assert.equal((await post('auth',A,'',{origin:''})).status,403);
assert.equal((await post('auth',A,'',{'content-type':'text/plain'})).status,415);
assert.equal(originalCount(),0);pass('Cross-origin, missing-Origin and simple-content signup are rejected');
assert.equal((await post('auth',{...A,password:'short'})).status,400);
assert.equal((await post('auth',{...A,password:'password1234'})).status,400);
assert.equal((await post('auth',{...A,phone:'invalid-number'})).status,400);
assert.equal((await post('auth','x'.repeat(5000))).status,400);
assert.equal(originalCount(),0);pass('Invalid fields, common passwords and oversized bodies create no account');
const signup=await post('auth',{...A,email:'  Buyer@Example.Test ',userId:'forged-owner'});
assert.equal(signup.status,201);assert.match(signup.data.recoveryKey,/^[a-f0-9]{64}$/);
assert.match(signup.response.headers.get('set-cookie'),/^__Host-sator_session=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600$/);
assert.match(signup.response.headers.get('cache-control'),/no-store/);
const a=sqlite.prepare('SELECT * FROM email_accounts WHERE email=?').get(A.email);
assert.match(a.id,/^email_/);assert.notEqual(a.id,'forged-owner');assert.match(a.password_hash,/^scrypt-v1\$/);assert.ok(!a.password_hash.includes(A.password));assert.notEqual(a.recovery_hash,signup.data.recoveryKey);assert.equal(a.phone,A.phone);
const storedSession=sqlite.prepare('SELECT * FROM email_sessions WHERE account_id=?').get(a.id);assert.ok(!signup.cookie.includes(storedSession.token_hash));
assert.equal((await get('session',signup.cookie)).data.user.id,a.id);pass('Signup stores salted hashes and private phone, issues an opaque protected cookie, and authenticates immediately');
const duplicate=await post('auth',{...A,email:'BUYER@example.test'});assert.equal(duplicate.status,409);assert.equal(originalCount(),1);pass('Email normalization and database uniqueness prevent duplicate accounts');
assert.equal((await get('store')).status,401);assert.equal((await get('journey')).status,401);assert.equal((await get('session','__Host-sator_session='+'a'.repeat(64))).data.user,null);pass('Anonymous and forged sessions cannot access private app data');
const legacy={'oai-authenticated-user-id':'legacy-provider','oai-authenticated-user-email':A.email};
assert.equal((await get('session','',legacy)).data.user.id,'legacy-provider');
assert.equal((await get('session',signup.cookie,legacy)).data.user.id,a.id);
assert.equal((await get('session','__Host-sator_session=invalid',legacy)).data.user,null);
pass('Existing provider identity remains available, with no email-based account linking or invalid-cookie fallback');
const profile={action:'styleProfile',mode:'buy',name:A.name,city:'Hyderabad',bio:'Buyer style',portfolio:'',sellReadyMade:false,brandName:'',weights:{'old-money':70,streetwear:30}};
assert.equal((await post('journey',profile,signup.cookie)).status,200);
assert.equal((await post('journey',{action:'measurements',details:{unit:'cm',chest:96,waist:80,hips:95,shoulder:44,sleeve:60,inseam:78,height:178,notes:'Private buyer fit'}},signup.cookie)).status,200);
const bSignup=await post('auth',B);assert.equal(bSignup.status,201);
const bId=(await get('session',bSignup.cookie)).data.user.id;
assert.notEqual(a.id,bId);assert.equal((await get('journey',bSignup.cookie)).data.measurements,null);
assert.ok(!JSON.stringify((await get('store',bSignup.cookie)).data).includes(A.phone));
assert.ok(!JSON.stringify((await get('session',signup.cookie)).data).includes('password_hash'));
pass('New email members reach style onboarding while measurements and credentials remain isolated');
const wrong=await post('auth',{action:'signin',email:A.email,password:'wrong-password'});
const unknown=await post('auth',{action:'signin',email:'unknown@example.test',password:'wrong-password'});
assert.equal(wrong.status,401);assert.deepEqual(wrong.data,unknown.data);
const login=await post('auth',{action:'signin',email:A.email,password:A.password});assert.equal(login.status,200);assert.notEqual(login.cookie,signup.cookie);
assert.equal((await get('session',login.cookie)).data.user.id,a.id);assert.equal((await get('journey',login.cookie)).data.profiles.length,1);pass('Password verification restores the same account and rotates the session token');
const logout=await post('auth',{action:'logout'},login.cookie);assert.equal(logout.status,200);assert.match(logout.response.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await get('session',login.cookie)).data.user,null);assert.equal((await get('store',login.cookie)).status,401);pass('Sign-out revokes the server session and rejects replay');
sqlite.prepare('UPDATE email_sessions SET expires_at=0 WHERE account_id=?').run(bId);
assert.equal((await get('session',bSignup.cookie)).data.user,null);pass('Expired sessions fail closed');
const badRecovery=await post('auth',{action:'recover',email:A.email,password:'Replacement linen passphrase!',recoveryKey:'a'.repeat(64)});assert.equal(badRecovery.status,401);
const reset=await post('auth',{action:'recover',email:A.email,password:'Replacement linen passphrase!',recoveryKey:signup.data.recoveryKey});assert.equal(reset.status,200);assert.notEqual(reset.data.recoveryKey,signup.data.recoveryKey);
assert.equal((await get('session',signup.cookie)).data.user,null);
assert.equal((await post('auth',{action:'recover',email:A.email,password:'Another valid passphrase!',recoveryKey:signup.data.recoveryKey})).status,401);
assert.equal((await post('auth',{action:'signin',email:A.email,password:A.password})).status,401);
assert.equal((await post('auth',{action:'signin',email:A.email,password:'Replacement linen passphrase!'})).status,200);
pass('Recovery keys are one-use, rotate on reset, and invalidate all prior sessions and passwords');
for(let i=0;i<12;i++)assert.equal((await post('auth',{action:'signin',email:'throttle@example.test',password:'not-correct'})).status,401);
assert.equal((await post('auth',{action:'signin',email:'throttle@example.test',password:'not-correct'})).status,429);pass('Persistent account and network throttles bound repeated credential attempts');
console.log(`${passed} email authentication scenarios passed with real hashing, real identity resolution, real route logic and all SQLite migrations.`);
sqlite.close();
