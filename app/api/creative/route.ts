import {z} from 'zod';
import {artworkPaths} from '../../lib/studio-access';
import {getAppUser} from '../../auth';
import {dbRaw,noStore,blocked} from '../../lib/community';
import {allowWrite,originOK,ownAsset} from '../../lib/security';
import {creativeImage,creativeProject} from '../../lib/creative-access';
import {configSchema} from '../../validation';
import {occasions,wardrobeCategories} from '../../creative-model';
export const dynamic='force-dynamic';
const text=(max:number)=>z.string().trim().max(max),uuid=z.string().uuid(),asset=z.union([z.literal(''),z.string().regex(/^\/api\/assets\/[a-f0-9-]{36}$/)]);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('wardrobe'),id:uuid,title:text(80).min(2),category:z.enum(wardrobeCategories),color:z.string().regex(/^#[a-f0-9]{6}$/i),image:asset,occasions:z.array(z.enum(occasions)).max(4),season:z.enum(['all','summer','winter']),notes:text(600)}),
 z.object({action:z.literal('deleteWardrobe'),id:uuid}),
 z.object({action:z.literal('outfit'),id:uuid,name:text(80).min(2),occasion:z.enum(occasions),items:z.array(uuid).min(1).max(12)}),
 z.object({action:z.literal('deleteOutfit'),id:uuid}),
 z.object({action:z.literal('pin'),id:uuid,lookbookId:uuid,title:text(80).min(2),note:text(1000),image:asset}),
 z.object({action:z.literal('deletePin'),id:uuid}),
 z.object({action:z.literal('project'),id:uuid,title:text(80).min(2),brief:text(2000),reference:asset,config:configSchema,commissionId:uuid.optional()}),
 z.object({action:z.literal('shareProject'),id:uuid,commissionId:uuid,version:z.number().int().positive()}),
 z.object({action:z.literal('revision'),id:uuid,projectId:uuid,version:z.number().int().positive(),config:configSchema,note:text(1000).min(3)}),
 z.object({action:z.literal('feedback'),id:uuid,projectId:uuid,body:text(1500).min(1)}),
 z.object({action:z.literal('review'),id:uuid,projectId:uuid,version:z.number().int().positive(),decision:z.enum(['approved','changes_requested']),body:text(1000).min(3)}),
 z.object({action:z.literal('archive'),id:uuid,version:z.number().int().positive()}),
]);
const projectSelect=`SELECT p.*, CASE WHEN p.owner_id=? THEN co.name ELSE ow.name END AS collaborator_name FROM design_projects p LEFT JOIN profiles ow ON ow.user_id=p.owner_id LEFT JOIN profiles co ON co.user_id=p.collaborator_id`;
function projectRow(p:Record<string,unknown>){return {id:p.id,ownerId:p.owner_id,collaboratorId:p.collaborator_id,reviewerId:p.reviewer_id,collaboratorName:p.collaborator_name||null,commissionId:p.commission_id,title:p.title,brief:p.brief,reference:p.reference,config:JSON.parse(String(p.config)),status:p.status,version:p.version,updatedAt:p.updated_at};}
export async function GET(request:Request){
 try{
  const user=await getAppUser();if(!user)return noStore({error:'Sign in required.'},401);const uid=user.userId,db=dbRaw(),id=new URL(request.url).searchParams.get('project');
  if(id){
   const p=await creativeProject(id,uid);if(!p)return noStore({error:'Project not found.'},404);
   const [revisions,events]=await Promise.all([
    db.prepare('SELECT r.*,p.name AS author_name FROM project_revisions r LEFT JOIN profiles p ON p.user_id=r.author_id WHERE project_id=? ORDER BY version DESC').bind(id).all<Record<string,unknown>>(),
    db.prepare('SELECT e.*,p.name AS author_name FROM project_events e LEFT JOIN profiles p ON p.user_id=e.author_id WHERE project_id=? ORDER BY created_at DESC,id DESC').bind(id).all<Record<string,unknown>>(),
   ]);
   const row=await db.prepare(projectSelect+' WHERE p.id=?').bind(uid,id).first<Record<string,unknown>>();
   return noStore({project:projectRow(row!),revisions:revisions.results.map(r=>({id:r.id,authorId:r.author_id,authorName:r.author_name||'Member',version:r.version,config:JSON.parse(String(r.config)),note:r.note,createdAt:r.created_at})),events:events.results.map(e=>({id:e.id,authorId:e.author_id,authorName:e.author_name||'Member',kind:e.kind,body:e.body,version:e.version,createdAt:e.created_at}))});
  }
  const [wardrobe,outfits,pins,projects]=await Promise.all([
   db.prepare('SELECT * FROM wardrobe_items WHERE user_id=? ORDER BY updated_at DESC,id').bind(uid).all<Record<string,unknown>>(),
   db.prepare('SELECT * FROM wardrobe_outfits WHERE user_id=? ORDER BY created_at DESC,id').bind(uid).all<Record<string,unknown>>(),
   db.prepare('SELECT p.* FROM inspiration_pins p JOIN lookbooks l ON l.id=p.lookbook_id AND l.user_id=p.user_id WHERE p.user_id=? ORDER BY p.created_at DESC,p.id').bind(uid).all<Record<string,unknown>>(),
   db.prepare(projectSelect+' WHERE (p.owner_id=? OR p.collaborator_id=?) AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=p.owner_id AND b.target_id=p.collaborator_id) OR (b.user_id=p.collaborator_id AND b.target_id=p.owner_id)) ORDER BY p.updated_at DESC,p.id').bind(uid,uid,uid).all<Record<string,unknown>>(),
  ]);
  return noStore({wardrobe:wardrobe.results.map(w=>({id:w.id,title:w.title,category:w.category,color:w.color,image:w.image,occasions:JSON.parse(String(w.occasions)),season:w.season,notes:w.notes,createdAt:w.created_at})),outfits:outfits.results.map(o=>({id:o.id,name:o.name,occasion:o.occasion,items:JSON.parse(String(o.items)),createdAt:o.created_at})),pins:pins.results.map(p=>({id:p.id,lookbookId:p.lookbook_id,title:p.title,note:p.note,image:p.image,createdAt:p.created_at})),projects:projects.results.map(projectRow)});
 }catch{return noStore({error:'Your creative workspace could not load. Retry.'},503);}
}
export async function POST(request:Request){
 try{
  if(!originOK(request))return noStore({error:'Invalid origin.'},403);
  const user=await getAppUser();if(!user)return noStore({error:'Sign in required.'},401);
  const raw=await request.text();if(raw.length>220000)return noStore({error:'Request too large.'},413);
  let value:unknown;try{value=JSON.parse(raw);}catch{return noStore({error:'Invalid JSON.'},400);}
  const parsed=schema.safeParse(value);if(!parsed.success)return noStore({error:parsed.error.issues[0]?.message||'Check your details.'},400);
  const a=parsed.data,uid=user.userId,db=dbRaw(),now=new Date().toISOString();
  if(!await allowWrite(uid,'creative',60))return noStore({error:'Please wait before making more changes.'},429);
  const count=async(table:string,column:string)=>Number((await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${column}=?`).bind(uid).first<{n:number}>())?.n||0);
  if(a.action==='wardrobe'){
   if(a.image&&!await ownAsset(a.image,uid))return noStore({error:'Use your own uploaded garment photo.'},400);
   const previous=await db.prepare('SELECT user_id FROM wardrobe_items WHERE id=?').bind(a.id).first<{user_id:string}>();if(previous&&previous.user_id!==uid)return noStore({error:'Item not found.'},404);
   if(!previous&&await count('wardrobe_items','user_id')>=300)return noStore({error:'Your wardrobe holds 300 items. Remove an item before adding another.'},409);
   await db.prepare('INSERT INTO wardrobe_items(id,user_id,title,category,color,image,occasions,season,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,color=excluded.color,image=excluded.image,occasions=excluded.occasions,season=excluded.season,notes=excluded.notes,updated_at=excluded.updated_at WHERE wardrobe_items.user_id=excluded.user_id').bind(a.id,uid,a.title,a.category,a.color,a.image,JSON.stringify([...new Set(a.occasions)]),a.season,a.notes,now,now).run();return noStore({ok:true,id:a.id});
  }
  if(a.action==='deleteWardrobe'||a.action==='deleteOutfit'||a.action==='deletePin'){
   const table={deleteWardrobe:'wardrobe_items',deleteOutfit:'wardrobe_outfits',deletePin:'inspiration_pins'}[a.action];await db.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(a.id,uid).run();return noStore({ok:true});
  }
  if(a.action==='outfit'){
   const ids=[...new Set(a.items)];for(const id of ids)if(!await db.prepare('SELECT id FROM wardrobe_items WHERE id=? AND user_id=?').bind(id,uid).first())return noStore({error:'Choose pieces from your own wardrobe.'},400);
   if(await count('wardrobe_outfits','user_id')>=100)return noStore({error:'Remove an outfit before adding another (100 maximum).'},409);
   const result=await db.prepare('INSERT INTO wardrobe_outfits(id,user_id,name,occasion,items,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(a.id,uid,a.name,a.occasion,JSON.stringify(ids),now).run();if(!result.meta.changes&&!await db.prepare('SELECT id FROM wardrobe_outfits WHERE id=? AND user_id=?').bind(a.id,uid).first())return noStore({error:'Choose a new outfit.'},409);return noStore({ok:true,id:a.id});
  }
  if(a.action==='pin'){
   if(!await db.prepare('SELECT id FROM lookbooks WHERE id=? AND user_id=?').bind(a.lookbookId,uid).first())return noStore({error:'Lookbook not found.'},404);
   if(!a.note&&!a.image)return noStore({error:'Add a photo or an inspiration note.'},400);
   if(a.image&&!await ownAsset(a.image,uid))return noStore({error:'Use your own uploaded inspiration photo.'},400);
   if(await count('inspiration_pins','user_id')>=300)return noStore({error:'Remove a pin before adding another (300 maximum).'},409);
   const r=await db.prepare('INSERT INTO inspiration_pins(id,user_id,lookbook_id,title,note,image,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(a.id,uid,a.lookbookId,a.title,a.note,a.image,now).run();if(!r.meta.changes&&!await db.prepare('SELECT id FROM inspiration_pins WHERE id=? AND user_id=?').bind(a.id,uid).first())return noStore({error:'Choose a new pin.'},409);return noStore({ok:true,id:a.id});
  }
  async function commission(id:string){const c=await db.prepare('SELECT * FROM commissions WHERE id=? AND (buyer_id=? OR designer_id=?)').bind(id,uid,uid).first<{id:string;buyer_id:string;designer_id:string}>();return c&&!await blocked(c.buyer_id,c.designer_id)?c:null;}
  if(a.action==='project'){
   if(a.reference&&!await ownAsset(a.reference,uid))return noStore({error:'Use your own reference photo.'},400);
   if(!(await Promise.all(artworkPaths(a.config).map(path=>creativeImage(path,uid)))).every(Boolean))return noStore({error:'Choose your own artwork or published artwork.'},400);
   const c=a.commissionId?await commission(a.commissionId):null;if(a.commissionId&&!c)return noStore({error:'Accepted commission not found.'},404);
   const existing=await creativeProject(a.id,uid);if(existing)return existing.owner_id===uid&&existing.title===a.title&&existing.brief===a.brief&&existing.reference===a.reference&&existing.config===JSON.stringify(a.config)&&existing.commission_id===(a.commissionId||null)?noStore({ok:true,id:a.id}):noStore({error:'This project was already created. Open it before making further changes.'},409);
   if(await count('design_projects','owner_id')>=100)return noStore({error:'You have reached the 100-project limit.'},409);
   const revision=crypto.randomUUID(),config=JSON.stringify(a.config),other=c?(c.buyer_id===uid?c.designer_id:c.buyer_id):null;
   await db.batch([
    db.prepare('INSERT INTO design_projects(id,owner_id,collaborator_id,reviewer_id,commission_id,title,brief,reference,config,status,version,last_revision_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,\'active\',1,?,?,?)').bind(a.id,uid,other,c?.buyer_id||uid,c?.id||null,a.title,a.brief,a.reference,config,revision,now,now),
    db.prepare('INSERT INTO project_revisions(id,project_id,author_id,version,config,note,created_at) VALUES(?,?,?,1,?,?,?)').bind(revision,a.id,uid,config,'First concept',now),
   ]);return noStore({ok:true,id:a.id});
  }
  const id='projectId' in a?a.projectId:a.id,p=await creativeProject(id,uid);if(!p)return noStore({error:'Project not found.'},404);
  if(p.status==='archived')return noStore({error:'This project is archived.'},409);
  if(a.action==='shareProject'){
   if(p.owner_id!==uid||p.collaborator_id)return noStore({error:'Only the owner can share a private project.'},403);
   const c=await commission(a.commissionId);if(!c)return noStore({error:'Accepted commission not found.'},404);
   const r=await db.prepare('UPDATE design_projects SET collaborator_id=?,reviewer_id=?,commission_id=?,updated_at=? WHERE id=? AND owner_id=? AND collaborator_id IS NULL AND version=? AND status<>\'archived\'').bind(c.buyer_id===uid?c.designer_id:c.buyer_id,c.buyer_id,c.id,now,id,uid,a.version).run();return r.meta.changes?noStore({ok:true}):noStore({error:'Project changed. Refresh before sharing.'},409);
  }
  if(a.action==='revision'){
   const existing=await db.prepare('SELECT author_id,config,note FROM project_revisions WHERE id=? AND project_id=?').bind(a.id,id).first<{author_id:string;config:string;note:string}>();if(existing)return existing.author_id===uid&&existing.config===JSON.stringify(a.config)&&existing.note===a.note?noStore({ok:true,id:a.id}):noStore({error:'This revision identifier is already used.'},409);
   if(!(await Promise.all(artworkPaths(a.config).map(path=>creativeImage(path,uid,id)))).every(Boolean))return noStore({error:'Use artwork you can access in this project.'},400);
   if(Number(p.version)>=100)return noStore({error:'This project has reached 100 revisions. Start another project.'},409);
   const config=JSON.stringify(a.config);
   const r=await db.batch([
    db.prepare('UPDATE design_projects SET config=?,version=version+1,last_revision_id=?,status=\'active\',updated_at=? WHERE id=? AND version=? AND status<>\'archived\'').bind(config,a.id,now,id,a.version),
    db.prepare('INSERT INTO project_revisions(id,project_id,author_id,version,config,note,created_at) SELECT ?,id,?,version,?,?,? FROM design_projects WHERE id=? AND last_revision_id=?').bind(a.id,uid,config,a.note,now,id,a.id),
   ]);return r[0].meta.changes?noStore({ok:true,id:a.id}):noStore({error:'A newer revision exists. Reload it before saving your changes.',code:'VERSION_CONFLICT'},409);
  }
  if(a.action==='feedback'){
   const previous=await db.prepare('SELECT * FROM project_events WHERE id=?').bind(a.id).first<Record<string,unknown>>();if(previous)return previous.project_id===id&&previous.author_id===uid&&previous.kind==='feedback'&&previous.body===a.body?noStore({ok:true}):noStore({error:'This message identifier is already used. Start a new message.'},409);
   if(Number((await db.prepare('SELECT count(*) AS n FROM project_events WHERE project_id=?').bind(id).first<{n:number}>())?.n||0)>=500)return noStore({error:'This discussion is full. Start a new project to continue.'},409);
   const r=await db.prepare('INSERT INTO project_events(id,project_id,author_id,kind,body,version,created_at) SELECT ?,id,?,\'feedback\',?,version,? FROM design_projects WHERE id=? AND status<>\'archived\'').bind(a.id,uid,a.body,now,id).run();return r.meta.changes?noStore({ok:true}):noStore({error:'This project is archived.'},409);
  }
  if(a.action==='review'){
   if(p.reviewer_id!==uid)return noStore({error:'Only the buyer can review a shared project.'},403);
   const prior=await db.prepare('SELECT id FROM project_events WHERE id=? AND project_id=? AND author_id=? AND kind=? AND version=? AND body=?').bind(a.id,id,uid,a.decision,a.version,a.body).first();if(prior)return noStore({ok:true});
   const r=await db.batch([
    db.prepare('UPDATE design_projects SET status=?,updated_at=? WHERE id=? AND version=? AND status<>\'archived\'').bind(a.decision,now,id,a.version),
    db.prepare('INSERT INTO project_events(id,project_id,author_id,kind,body,version,created_at) SELECT ?,id,?,?,?,version,? FROM design_projects WHERE id=? AND version=? AND status=?').bind(a.id,uid,a.decision,a.body,now,id,a.version,a.decision),
   ]);return r[0].meta.changes?noStore({ok:true}):noStore({error:'Review the newest revision before approving.',code:'VERSION_CONFLICT'},409);
  }
  if(a.action==='archive'){
   if(p.owner_id!==uid)return noStore({error:'Only the project owner can archive it.'},403);
   const r=await db.prepare('UPDATE design_projects SET status=\'archived\',updated_at=? WHERE id=? AND version=?').bind(now,id,a.version).run();return r.meta.changes?noStore({ok:true}):noStore({error:'Project changed. Refresh first.'},409);
  }
  return noStore({error:'Unknown action.'},400);
 }catch(e){return noStore({error:e instanceof Error&&/unique constraint/i.test(e.message)?'This change conflicts with a saved record. Refresh and retry.':'Your changes could not be saved. Please retry.'},409);}
}
