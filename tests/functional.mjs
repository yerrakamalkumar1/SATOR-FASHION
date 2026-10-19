import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {build}=await import(require.resolve('esbuild',{paths:[dirname(require.resolve('drizzle-kit'))]}));
const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
class Statement{constructor(query,params=[]){this.query=query;this.params=params;}bind(...params){return new Statement(this.query,params);}async raw(){const st=sqlite.prepare(this.query);st.setReturnArrays(true);return st.all(...this.params);}async all(){return {success:true,results:sqlite.prepare(this.query).all(...this.params),meta:{}};}async first(){return sqlite.prepare(this.query).get(...this.params)||null;}async run(){const r=sqlite.prepare(this.query).run(...this.params);return {success:true,results:[],meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}}
globalThis.__testEnv={DB:{prepare:q=>new Statement(q),batch:async statements=>{sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
globalThis.__testUser=null;
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:['app/api/store/route.ts'],outfile:'.sites-runtime/test-api.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-isolation',setup(b){b.onResolve({filter:/[\/]auth$/},()=>({path:'auth',namespace:'mock'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='auth'?'export async function getAppUser(){return globalThis.__testUser;}':'export const env=globalThis.__testEnv;',loader:'js'}));}}],logLevel:'error'});
const {GET,POST}=await import(resolve('.sites-runtime/test-api.mjs'));
const A={userId:'alice',fullName:'Alice Maker',displayName:'Alice',email:'alice@example.test'},B={userId:'bob',fullName:'Bob',displayName:'Bob',email:'bob@example.test'};
const config={garment:'tee',color:'#e7e3d8',ink:'#292c28',text:'MY IDEA',subtext:'MADE BY ME',graphic:'orbit',font:'sans',x:0,y:0,scale:1,rotation:0,backText:'',image:''};
async function post(data,origin='https://sator.test'){const r=await POST(new Request('https://sator.test/api/store',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(data)}));return {status:r.status,...await r.json()};}
async function get(){const r=await GET();assert.equal(r.status,200);return r.json();}
let passed=0;function pass(name){passed++;console.log('PASS '+name);}
assert.equal((await GET()).status,401);assert.equal((await post({action:'addCart',title:'Test',config,size:'M',quantity:1})).status,401);pass('Anonymous users cannot browse protected data or write');
globalThis.__testUser=A;
assert.equal((await post({action:'profile',name:'Alice Maker',bio:'Independent artist',role:'creator'},'https://untrusted.test')).status,403);pass('Cross-origin writes are rejected');
const create={action:'design',title:'First idea',description:'My design',category:'Graphic',kind:'creator',published:false,config};
const made=await post(create);assert.equal(made.status,200);assert.equal((await get()).designs.length,1);
globalThis.__testUser=B;assert.equal((await get()).designs.length,0);assert.equal((await post({...create,id:made.id,title:'Stolen edit'})).status,404);assert.equal((await get()).products.some(p=>p.id===made.id),false);pass('Drafts and edit operations are scoped to their owner');
globalThis.__testUser=A;assert.equal((await post({...create,id:made.id,published:true})).status,200);globalThis.__testUser=B;assert.equal((await get()).products.find(p=>p.id===made.id).creator,'Alice Maker');pass('Publishing exposes the design with the creator profile');
assert.equal((await post({...create,config:{...config,image:'https://evil.test/attack.svg'}})).status,400);assert.equal((await post({...create,config:{...config,color:'url(javascript:bad)'}})).status,400);pass('Untrusted artwork URLs and invalid configurations are rejected');
assert.equal((await post({action:'bookmark',productId:made.id,board:'My inspiration'})).active,true);assert.equal((await get()).bookmarks.length,1);assert.equal((await post({action:'bookmark',productId:made.id,board:'My inspiration'})).active,false);assert.equal((await post({action:'like',productId:made.id})).active,true);assert.equal((await post({action:'comment',productId:made.id,body:'Love this design'})).status,200);assert.equal((await get()).comments[0].body,'Love this design');pass('Boards, likes, and comments persist through read requests');
assert.equal((await post({action:'addCart',title:'Custom tee',config,size:'M',quantity:2,amount:1})).status,200);assert.equal((await get()).cart[0].amount,99900);assert.equal((await post({action:'addCart',title:'Invalid quantity',config,size:'M',quantity:-1})).status,400);pass('Prices are computed server-side and quantities are validated');
const quote={action:'quote',requestKey:crypto.randomUUID(),name:'Bob',contact:'bob@example.test',note:'Test quote'};const saved=await post(quote);assert.equal(saved.status,200);assert.equal((await get()).orders[0].amount,199800);assert.equal((await get()).orders[0].status,'quote_requested');assert.equal((await get()).cart.length,0);assert.equal((await post(quote)).id,saved.id);assert.equal((await get()).orders.length,1);pass('Quote submission snapshots the bag, clears it, and deduplicates retries');
globalThis.__testUser=A;assert.equal((await get()).orders.length,0);assert.equal((await post(quote)).status,409);pass('Other users cannot read or replay someone else’s quote');
assert.equal((await post({action:'inquiry',recipient:'bob',subject:'Collaboration',body:'Would you like to collaborate?'})).status,200);globalThis.__testUser=B;assert.equal((await get()).inquiries.length,1);assert.equal((await post({action:'inquiry',recipient:'unknown',subject:'Hello',body:'A missing person'})).status,404);pass('Contact requests reach only the selected valid recipient');
globalThis.__testUser=A;await post({action:'deleteDesign',id:made.id});assert.equal((await get()).products.some(p=>p.id===made.id),false);pass('Owner deletion removes a published design');
console.log(`${passed} functional scenarios passed using the real route logic, migrations and SQLite with a D1-compatible test adapter. Hosted authentication and browser camera hardware are not simulated.`);
sqlite.close();
