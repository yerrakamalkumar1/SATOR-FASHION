import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readMigrationFiles} from 'drizzle-orm/migrator';
const require=createRequire(import.meta.url);
const {build}=await import(require.resolve('esbuild',{paths:[dirname(require.resolve('drizzle-kit'))]}));
const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
assert.deepEqual(journal.entries.map(entry=>entry.tag+'.sql').sort(),readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort(),'Every migration must be registered for hosted deployment');
const migrations=readMigrationFiles({migrationsFolder:'drizzle'});
const sqlite=new DatabaseSync(':memory:');
// Exercise the deployment journal, not a directory scan that can hide an
// unregistered migration from the hosted runtime.
for(const migration of migrations){
 for(const statement of migration.sql)sqlite.exec(statement);
}
class Statement{constructor(query,params=[]){this.query=query;this.params=params;}bind(...params){return new Statement(this.query,params);}async raw(){const st=sqlite.prepare(this.query);st.setReturnArrays(true);return st.all(...this.params);}async all(){return {success:true,results:sqlite.prepare(this.query).all(...this.params),meta:{}};}async first(){return sqlite.prepare(this.query).get(...this.params)||null;}async run(){const r=sqlite.prepare(this.query).run(...this.params);return {success:true,results:[],meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}}
globalThis.__testEnv={DB:{prepare:q=>new Statement(q),batch:async statements=>{sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
globalThis.__testUser=null;
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:{store:'app/api/store/route.ts',studio:'app/api/studio/route.ts',model:'app/studio-model.ts',inspiration:'app/studio-inspiration.ts',validation:'app/studio-validation.ts',graphics:'app/studio-graphics.ts'},outdir:'.sites-runtime/studio-tests',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',plugins:[{name:'test-isolation',setup(b){b.onResolve({filter:/[\/]auth$/},()=>({path:'auth',namespace:'mock'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='auth'?'export async function getAppUser(){return globalThis.__testUser;}':'export const env=globalThis.__testEnv;',loader:'js'}));}}],logLevel:'error'});
const {GET,POST}=await import(resolve('.sites-runtime/studio-tests/store.mjs'));
const A={userId:'alice',fullName:'Alice Maker',displayName:'Alice',email:'alice@example.test'},B={userId:'bob',fullName:'Bob',displayName:'Bob',email:'bob@example.test'};
const config={garment:'tee',color:'#e7e3d8',ink:'#292c28',text:'MY IDEA',subtext:'MADE BY ME',graphic:'orbit',font:'sans',x:0,y:0,scale:1,rotation:0,backText:'',image:''};
async function post(data,origin='https://sator.test'){const r=await POST(new Request('https://sator.test/api/store',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(data)}));return {status:r.status,...await r.json()};}
async function get(){const r=await GET();assert.equal(r.status,200);return r.json();}

const model=await import(resolve('.sites-runtime/studio-tests/model.mjs'));
const api=await import(resolve('.sites-runtime/studio-tests/studio.mjs'));
const studioPost=async(body,origin='https://sator.test')=>{const r=await api.POST(new Request('https://sator.test/api/studio',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,...await r.json()};};
let passed=0;const pass=s=>{passed++;console.log('PASS '+s);};
const upgrade=new DatabaseSync(':memory:');
for(const migration of migrations.slice(0,-1))for(const statement of migration.sql)upgrade.exec(statement);
upgrade.exec(`INSERT INTO profiles(user_id,name,bio,role,created_at) VALUES ('retained-owner','Existing member','','customer','2026-10-01');
 INSERT INTO designs(id,user_id,title,description,config,category,kind,published,created_at,updated_at) VALUES ('retained-draft','retained-owner','Private work','','{}','Graphic','creator',0,'2026-10-01','2026-10-01');
 INSERT INTO orders(id,user_id,request_key,items,amount,name,contact,note,status,created_at) VALUES ('retained-order','retained-owner','existing-request','[]',0,'Existing member','','','quote_requested','2026-10-01');
 INSERT INTO follows(follower_id,target_id,created_at) VALUES ('retained-owner','existing-creator','2026-10-01');`);
const retained=()=>['profiles','designs','orders','follows'].map(table=>upgrade.prepare('SELECT * FROM '+table).all());
const beforeUpgrade=retained();
for(const statement of migrations.at(-1).sql)upgrade.exec(statement);
assert.deepEqual(retained(),beforeUpgrade);
upgrade.prepare('INSERT INTO studio_preferences VALUES (?,?,?)').run('retained-owner','Womenswear','2026-10-26');
// A self-hosted install may already have applied this exact SQL file.
for(const statement of migrations.at(-1).sql)upgrade.exec(statement);
assert.equal(upgrade.prepare('SELECT audience FROM studio_preferences WHERE user_id=?').get('retained-owner').audience,'Womenswear');
assert.throws(()=>upgrade.prepare('INSERT INTO studio_preferences VALUES (?,?,?)').run('bad-value','Unknown','2026-10-26'),/CHECK/);
upgrade.close();
pass('Deployment journal includes every migration; studio upgrade preserves identities, private drafts, orders, follows and existing preferences');
assert.ok(model.templates.length>=170);assert.ok(model.fonts.length>=100);assert.ok(model.slogans.length>=300);assert.equal(new Set(model.templates.map(t=>t.id)).size,model.templates.length);assert.ok(['Menswear','Womenswear','Unisex'].every(a=>model.templates.some(t=>t.audience===a)));pass('Broad garment catalogue, unique template IDs, 100+ fonts and 300 slogans');
const d=model.blankStudio(model.templates.find(t=>t.name==='Saree'));d.views.front.push(model.newLayer('text','నా దారి నాదే'));
for(let i=0;i<300;i++){const next=model.randomDesign(d,{color:true,pattern:true,text:true,garment:true});assert.equal(next.color,d.color);assert.equal(next.templateId,d.templateId);assert.deepEqual(next.views.front,d.views.front);assert.equal(next.pattern,d.pattern);}
pass('Randomization preserves locked components');
globalThis.__testUser=null;assert.equal((await api.GET(new Request('https://sator.test/api/studio'))).status,401);assert.equal((await studioPost({action:'preference',audience:'Womenswear'})).status,401);globalThis.__testUser=A;assert.equal((await studioPost({action:'preference',audience:'Womenswear'},'https://evil.test')).status,403);assert.equal((await studioPost({action:'preference',audience:'Womenswear'})).status,200);let prefs=await(await api.GET(new Request('https://sator.test/api/studio?audience=Womenswear'))).json();assert.equal(prefs.preference.audience,'Womenswear');assert.ok(prefs.templates.every(t=>t.audience==='Womenswear'));globalThis.__testUser=B;prefs=await(await api.GET(new Request('https://sator.test/api/studio'))).json();assert.equal(prefs.preference,null);pass('Catalogue requires authentication and preference is isolated by owner');
globalThis.__testUser=A;const madeConfig={...config,studio:d};const create={action:'design',createId:crypto.randomUUID(),title:'My saree',description:'#ethnic',category:'Graphic',kind:'creator',published:false,config:madeConfig};const made=await post(create);assert.equal(made.status,200);assert.equal((await post(create)).id,made.id);assert.equal((await get()).designs.filter(x=>x.id===made.id).length,1);assert.deepEqual((await get()).designs.find(x=>x.id===made.id).config.studio,d);pass('Editable canvas and Unicode text round-trip; repeated creation does not duplicate');
globalThis.__testUser=B;assert.equal((await get()).products.some(x=>x.id===made.id),false);assert.equal((await post({...create,id:made.id})).status,404);assert.equal((await post(create)).status,409);pass('Another account cannot access or update a private draft, including create retry IDs');
globalThis.__testUser=A;assert.equal((await post({...create,id:made.id,published:true})).status,200);globalThis.__testUser=B;let original=(await get()).products.find(x=>x.id===made.id);assert.equal(original.config.studio.templateId,d.templateId);const remix={...model.fromLegacy(original.config),remixedFrom:made.id};const remixed=await post({...create,createId:crypto.randomUUID(),title:'My remix',config:{...config,studio:remix}});assert.equal(remixed.status,200);assert.equal((await get()).designs.find(x=>x.id===remixed.id).config.studio.remixedFrom,made.id);pass('Published designs reach other accounts and editable remixes retain attribution');
const image=model.newLayer('image','/api/assets/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');const privateImage={...d,views:{...d.views,front:[image]}};assert.equal((await post({...create,createId:crypto.randomUUID(),config:{...config,studio:privateImage}})).status,400);pass('Nested layers cannot reference another creator’s private uploads');
globalThis.__testUser=A;assert.equal((await post({...create,createId:crypto.randomUUID(),published:true,config:{...config,subtext:image.value}})).status,200);globalThis.__testUser=B;assert.equal((await post({...create,createId:crypto.randomUUID(),config:{...config,studio:privateImage}})).status,400);pass('Mentioning an asset URL as text never grants access to its image bytes');
for(const invalid of [{...d,templateId:'unknown'},{...d,color:'url(javascript:x)'},{...d,audience:'Menswear'},{...d,views:{...d.views,front:[{...model.newLayer('image','https://evil.test/private')}] }},{...d,views:{...d.views,front:[{...model.newLayer('path','<script>bad</script>')}] }},{...d,views:{...d.views,front:Array.from({length:61},()=>model.newLayer('text','test'))}}])assert.equal((await post({...create,createId:crypto.randomUUID(),config:{...config,studio:invalid}})).status,400);
assert.equal((await studioPost({action:'random',design:d,locks:{color:true}})).design.color,d.color);pass('Unsafe URLs, paths, sizes and invalid template metadata fail validation; random API works');
const {studioConcepts,conceptProduct}=await import(resolve('.sites-runtime/studio-tests/inspiration.mjs'));
const {studioSchema}=await import(resolve('.sites-runtime/studio-tests/validation.mjs'));
assert.equal(studioConcepts.length,48);assert.equal(new Set(studioConcepts.map(c=>c.id)).size,48);
for(const audience of ['Menswear','Womenswear'])for(const style of ['old-money','streetwear','formals','casuals','vintage','tailoring','minimal','experimental']){
 const samples=studioConcepts.filter(c=>c.audience===audience&&c.style===style);assert.equal(samples.length,3);
 for(const sample of samples){assert.ok(studioSchema.safeParse(sample.document).success,sample.title);const product=conceptProduct(sample);product.config.studio.color='#ffffff';assert.notEqual(sample.document.color,'#ffffff');}
}
assert.equal(model.shapeFor('Jumpsuit'),'jumpsuit');assert.equal(model.shapeFor('Corset top'),'crop');assert.equal(model.blankStudio(model.templates.find(t=>t.name==='T-shirt')).neck,'round');
const saree=studioConcepts.find(c=>c.title==='Saree');globalThis.__testUser=A;
const conceptSave=await post({...create,createId:crypto.randomUUID(),title:'My tailored saree',config:conceptProduct(saree).config});assert.equal(conceptSave.status,200);
assert.equal((await get()).designs.find(p=>p.id===conceptSave.id).config.studio.templateId,saree.document.templateId);
pass('All 48 style samples are valid, independently editable and save as real garment documents; jumpsuits, corsets and T-shirt necks use correct families');
const trousers=model.blankStudio(model.templates.find(t=>t.name==='Pleated trousers'));
assert.deepEqual(model.studioWorkspaces(trousers).map(w=>w.view),['front','back']);assert.equal(model.garmentControls(trousers).neck,false);assert.equal(model.garmentControls(trousers).sleeves,false);
const hoodie=model.blankStudio(model.templates.find(t=>t.name==='Hoodie'));assert.equal(model.studioWorkspaces(hoodie).length,4);
const legacyDetail=model.newLayer('text','Keep this artwork');trousers.views['left sleeve'].push(legacyDetail);
const detail=model.studioWorkspaces(trousers).find(w=>w.view==='left sleeve');assert.equal(detail.label,'Artwork detail 1');assert.equal(trousers.views['left sleeve'][0].id,legacyDetail.id);
const {garmentPath}=await import(resolve('.sites-runtime/studio-tests/graphics.mjs'));
assert.notEqual(garmentPath({...trousers,fit:'slim'}),garmentPath({...trousers,fit:'oversized'}));assert.notEqual(garmentPath({...trousers,length:'short'}),garmentPath({...trousers,length:'long'}));
const tee=model.blankStudio(model.templates.find(t=>t.name==='T-shirt'));tee.sleeves='sleeveless';assert.equal(model.studioWorkspaces(tee).length,2);assert.equal(model.garmentControls(tee).sleeves,true);
pass('Garment controls and detail workspaces match the silhouette while legacy artwork stays editable; trouser fit and length change the geometry');
console.log(passed+' advanced studio scenarios passed using real route logic and SQLite.');sqlite.close();
