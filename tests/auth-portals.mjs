import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {build}=await import(require.resolve('esbuild',{paths:[dirname(require.resolve('drizzle-kit'))]}));
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
class Statement{
 constructor(query,params=[]){this.query=query;this.params=params;}
 bind(...params){return new Statement(this.query,params);}
 async raw(){const statement=sqlite.prepare(this.query);statement.setReturnArrays(true);return statement.all(...this.params);}
 async all(){return {success:true,results:sqlite.prepare(this.query).all(...this.params),meta:{}};}
 async first(){return sqlite.prepare(this.query).get(...this.params)||null;}
 async run(){const r=sqlite.prepare(this.query).run(...this.params);return {success:true,results:[],meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
}
globalThis.__testEnv={DB:{prepare:q=>new Statement(q),batch:async statements=>{sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
globalThis.__testUser=null;
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:{'portal-api':'app/api/portal/route.ts','session-api':'app/api/session/route.ts','payment-api':'app/api/payments/start/route.ts'},outdir:'.sites-runtime/auth-tests',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',plugins:[{name:'test-identity',setup(b){
 b.onResolve({filter:/[\/]auth$/},()=>({path:'auth',namespace:'mock'}));
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='auth'?'export async function getAppUser(){return globalThis.__testUser;}':'export const env=globalThis.__testEnv;',loader:'js'}));
}}],logLevel:'error'});
const portal=await import(resolve('.sites-runtime/auth-tests/portal-api.mjs'));
const session=await import(resolve('.sites-runtime/auth-tests/session-api.mjs'));
const payments=await import(resolve('.sites-runtime/auth-tests/payment-api.mjs'));
const A={userId:'account-a',displayName:'A Maker',fullName:'A Maker',email:'a@example.test'},B={userId:'account-b',displayName:'B Buyer',fullName:'B Buyer',email:'b@example.test'};
const fields={action:'onboard',role:'customer',name:'A Maker',email:'private@example.test',city:'Hyderabad',bio:'Original designs',interests:'Streetwear',brandName:'',website:'',specialty:''};
const request=(data,origin='https://sator.test')=>new Request('https://sator.test/api/portal',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:typeof data==='string'?data:JSON.stringify(data)});
async function post(data,origin){const r=await portal.POST(request(data,origin));return {status:r.status,...await r.json()};}
async function get(){const r=await portal.GET();assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);return r.json();}
let passed=0;function pass(s){console.log('PASS '+s);passed++;}
assert.equal((await post(fields)).status,401);assert.equal((await portal.GET()).status,401);assert.equal((await session.GET()).headers.get('cache-control'),'private, no-store, max-age=0');assert.deepEqual(await(await session.GET()).json(),{user:null});pass('Anonymous sessions cannot create accounts or read private profiles');
globalThis.__testUser=A;
assert.equal((await post(fields,'https://other.test')).status,403);pass('Cross-origin signup is rejected');
assert.equal((await post('{invalid')).status,400);assert.equal((await post({...fields,role:'admin'})).status,400);assert.equal((await post({...fields,email:'invalid'})).status,400);assert.equal((await get()).accounts.length,0);pass('Malformed signup, invalid email, and unknown roles create no records');
assert.equal((await post({...fields,userId:B.userId})).status,200);let a=await get();assert.equal(a.accounts.length,1);assert.equal(a.accounts[0].userId,A.userId);assert.equal(a.accounts[0].details.city,'Hyderabad');assert.equal(a.accounts[0].details.email,'private@example.test');pass('Signup persists details under trusted identity and ignores browser-supplied user IDs');
const created=a.accounts[0].createdAt;
assert.equal((await post({...fields,city:'Bengaluru',name:'A Updated'})).status,200);a=await get();assert.equal(a.accounts.length,1);assert.equal(a.accounts[0].details.city,'Bengaluru');assert.equal(a.accounts[0].createdAt,created);pass('Profile changes persist without duplicating accounts');
assert.equal((await post({...fields,role:'creator'})).status,400);assert.equal((await post({...fields,role:'brand'})).status,400);pass('Creator specialty and startup brand name are required on the server');
assert.equal((await post({...fields,role:'creator',specialty:'Illustration'})).status,200);assert.equal((await post({...fields,role:'brand',brandName:'Independent Label'})).status,200);a=await get();assert.deepEqual(a.accounts.map(x=>x.role).sort(),['brand','creator','customer']);pass('A signed-in account can persist all three separate portal profiles');
assert.deepEqual(await(await session.GET()).json(),{user:{id:A.userId,name:A.displayName,email:A.email}});pass('Session status comes from the authenticated server identity');
globalThis.__testUser=B;
assert.equal((await get()).accounts.length,0);assert.equal((await get()).sales.length,0);assert.equal((await get()).purchases.length,0);assert.ok(!JSON.stringify(await get()).includes('private@example.test'));pass('Another account cannot read private profiles or contact details');
assert.equal((await post({...fields,name:'B Buyer',email:B.email})).status,200);assert.equal((await post({action:'listing',title:'New product',description:'A valid product description',image:'/api/assets/'+crypto.randomUUID(),category:'T-shirts',price:10000,shipping:0,stock:1,sizes:['M'],published:true})).status,403);pass('Customer signup does not grant startup listing permissions');
assert.equal((await post({action:'monetize',interest:'Both',portfolio:''})).status,403);pass('Creator-only actions require a saved creator profile');
assert.equal((await payments.POST(request({id:crypto.randomUUID()}))).status,503);assert.equal((await get()).paymentsReady,false);pass('Checkout remains disabled without configured payment credentials');
globalThis.__testUser=null;
assert.deepEqual(await(await session.GET()).json(),{user:null});assert.equal((await portal.GET()).status,401);assert.equal((await post(fields)).status,401);pass('Ended sessions lose private data access and all write access');
globalThis.__testUser=A;assert.equal((await get()).accounts.length,3);pass('Signing back in restores the same durable portal profiles');
console.log(`${passed} authentication and portal scenarios passed against real route logic and SQLite migrations. Provider sign-in redirects, browser audio and devices require live-browser verification.`);
sqlite.close();
