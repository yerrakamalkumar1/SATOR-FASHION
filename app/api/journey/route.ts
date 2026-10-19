import {recommendationScores} from '../../lib/recommendations';
import {z} from 'zod';
import {publicPerson,blocked} from '../../lib/community';
import {eq,and,or,desc,sql,inArray} from 'drizzle-orm';
import {getAppUser} from '../../auth';
import {getDb} from '../../../db';
import * as s from '../../../db/schema';
import {allowWrite,originOK,ownAsset,publicItem} from '../../lib/security';
import {styleOptions,normalizeWeights,type StyleWeights} from '../../style-model';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
const style=z.enum(styleOptions.map(s=>s.id) as [string,...string[]]);
const tags=z.array(style).min(1).max(8).transform(v=>[...new Set(v)]);
const weights=z.record(style,z.number().finite().min(0).max(100)).refine(v=>Object.values(v).some(n=>n>0),'Choose at least one style.');
const text=(max:number)=>z.string().trim().max(max);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>!Number.isNaN(Date.parse(d))&&d>=new Date().toISOString().slice(0,10),'Choose today or a future date.');
const link=z.string().max(250).refine(v=>!v||/^https?:\/\//i.test(v),'Use an http or https link.');
const asset=z.string().regex(/^\/api\/assets\/[a-f0-9-]{36}$/);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('styleProfile'),mode:z.enum(['buy','design']),weights,name:text(60).min(2),city:text(80).min(2),bio:text(300),portfolio:link,sellReadyMade:z.boolean(),brandName:text(80)}),
 z.object({action:z.literal('measurements'),details:z.object({unit:z.literal('cm'),chest:z.number().min(30).max(250).optional(),waist:z.number().min(30).max(250).optional(),hips:z.number().min(30).max(250).optional(),inseam:z.number().min(20).max(130).optional(),shoulder:z.number().min(15).max(90).optional(),sleeve:z.number().min(10).max(120).optional(),height:z.number().min(80).max(250).optional(),notes:text(500)})}),
 z.object({action:z.literal('deleteMeasurements')}),
 z.object({action:z.literal('lookbook'),id:z.string().uuid().optional(),name:text(60).min(2),items:z.array(z.string().max(80)).max(30)}),
 z.object({action:z.literal('deleteLookbook'),id:z.string().uuid()}),
 z.object({action:z.literal('request'),title:text(100).min(3),brief:text(2000).min(10),budget:z.number().int().min(10000).max(100000000),styles:tags,deadline:date}),
 z.object({action:z.literal('closeRequest'),id:z.string().uuid()}),
 z.object({action:z.literal('bid'),requestId:z.string().uuid(),quote:z.number().int().min(10000).max(100000000),days:z.number().int().min(1).max(365),message:text(1500).min(10),sketch:z.union([asset,z.literal('')])}),
 z.object({action:z.literal('acceptBid'),bidId:z.string().uuid()}),
 z.object({action:z.literal('conversation'),designerId:z.string().min(1).max(150),context:text(200).min(2),itemId:text(80)}),
 z.object({action:z.literal('message'),conversationId:z.string().uuid(),body:text(3000).min(1)}),
 z.object({action:z.literal('spec'),itemId:z.string().max(80),styles:tags,fabric:text(300),gsm:z.number().int().min(10).max(1500).nullable(),stitch:text(500),care:text(500),textureMedia:z.union([asset,z.literal('')]),certificate:z.union([asset,z.literal('')])}),
 z.object({action:z.literal('drop'),itemId:z.string().max(80),title:text(100).min(3),target:z.number().int().min(2).max(10000),price:z.number().int().min(10000).max(100000000),deadline:date,note:text(1000)}),
 z.object({action:z.literal('pledge'),dropId:z.string().uuid(),join:z.boolean()}),
 z.object({action:z.literal('evidence'),commissionId:z.string().uuid(),stage:z.enum(['materials','dispatch']),asset,note:text(1000).min(3)}),
 z.object({action:z.literal('review'),id:z.string().uuid(),review:z.enum(['approved','changes_requested']),feedback:text(1000)}),
]);
async function isDesigner(uid:string){return !!(await getDb().select().from(s.styleProfiles).where(and(eq(s.styleProfiles.userId,uid),eq(s.styleProfiles.mode,'design'))).limit(1)).length;}
async function ownedItem(uid:string,id:string){const db=getDb();return !!((await db.select({id:s.designs.id}).from(s.designs).where(and(eq(s.designs.userId,uid),eq(s.designs.id,id))).limit(1)).length||(await db.select({id:s.posts.id}).from(s.posts).where(and(eq(s.posts.userId,uid),eq(s.posts.id,id))).limit(1)).length||(await db.select({id:s.listings.id}).from(s.listings).where(and(eq(s.listings.userId,uid),eq(s.listings.id,id))).limit(1)).length);}
export async function GET(){
 try{
  const user=await getAppUser();if(!user)return json({error:'Sign in to continue.'},401);
  const uid=user.userId,db=getDb();
  const [profiles,vault,lookbooks,designers,requests,bids,conversations,specs,drops,pledges,commissions]=await Promise.all([
   db.select().from(s.styleProfiles).where(eq(s.styleProfiles.userId,uid)),
   db.select().from(s.measurementVault).where(eq(s.measurementVault.userId,uid)).limit(1),
   db.select().from(s.lookbooks).where(eq(s.lookbooks.userId,uid)).orderBy(desc(s.lookbooks.createdAt)),
   db.select().from(s.styleProfiles).where(eq(s.styleProfiles.mode,'design')).limit(200),
   db.select({id:s.designRequests.id,buyerId:s.designRequests.buyerId,buyerName:s.profiles.name,title:s.designRequests.title,brief:s.designRequests.brief,budget:s.designRequests.budget,styles:s.designRequests.styles,deadline:s.designRequests.deadline,status:s.designRequests.status,createdAt:s.designRequests.createdAt}).from(s.designRequests).leftJoin(s.profiles,eq(s.profiles.userId,s.designRequests.buyerId)).where(or(eq(s.designRequests.status,'open'),eq(s.designRequests.buyerId,uid),inArray(s.designRequests.id,db.select({id:s.designBids.requestId}).from(s.designBids).where(eq(s.designBids.designerId,uid))))).orderBy(desc(s.designRequests.createdAt)).limit(100),
   db.select({id:s.designBids.id,requestId:s.designBids.requestId,designerId:s.designBids.designerId,designerName:s.profiles.name,quote:s.designBids.quote,days:s.designBids.days,message:s.designBids.message,sketch:s.designBids.sketch,createdAt:s.designBids.createdAt}).from(s.designBids).innerJoin(s.designRequests,eq(s.designRequests.id,s.designBids.requestId)).leftJoin(s.profiles,eq(s.profiles.userId,s.designBids.designerId)).where(or(eq(s.designBids.designerId,uid),eq(s.designRequests.buyerId,uid))),
   db.select().from(s.conversations).where(or(eq(s.conversations.buyerId,uid),eq(s.conversations.designerId,uid))).orderBy(desc(s.conversations.updatedAt)).limit(100),
   db.select().from(s.itemSpecs).limit(300),db.select().from(s.preorderDrops).orderBy(desc(s.preorderDrops.createdAt)).limit(100),
   db.select({dropId:s.dropPledges.dropId,count:sql<number>`count(*)`,joined:sql<number>`max(case when ${s.dropPledges.userId}=${uid} then 1 else 0 end)`}).from(s.dropPledges).groupBy(s.dropPledges.dropId),
   db.select().from(s.commissions).where(or(eq(s.commissions.buyerId,uid),eq(s.commissions.designerId,uid))).orderBy(desc(s.commissions.createdAt)),
  ]);
  const conversationIds=conversations.map(c=>c.id),commissionIds=commissions.map(c=>c.id);
  const [messages,evidence,names,creationRows,publicDesigns,publicListings,publicPosts]=await Promise.all([
   conversationIds.length?db.select().from(s.chatMessages).where(inArray(s.chatMessages.conversationId,conversationIds)).orderBy(desc(s.chatMessages.createdAt)).limit(500):[],
   commissionIds.length?db.select().from(s.qualityEvidence).where(inArray(s.qualityEvidence.commissionId,commissionIds)).orderBy(desc(s.qualityEvidence.createdAt)):[],
   db.select({id:s.profiles.userId,name:s.profiles.name}).from(s.profiles).limit(1000),
   db.select({userId:s.designs.userId,count:sql<number>`count(*)`}).from(s.designs).where(eq(s.designs.published,1)).groupBy(s.designs.userId),
   db.select({id:s.designs.id}).from(s.designs).where(eq(s.designs.published,1)),db.select({id:s.listings.id}).from(s.listings).where(eq(s.listings.published,1)),db.select({id:s.posts.id}).from(s.posts),
  ]);
  const name=(id:string)=>names.find(n=>n.id===id)?.name||'ŚATOR member';
  // A private draft's metadata is never exposed through the discovery response.
  const publishedIds=new Set([...publicDesigns,...publicListings,...publicPosts].map(p=>p.id));
  const visibleSpecs=[];for(const spec of specs)if(spec.userId===uid||publishedIds.has(spec.itemId))visibleSpecs.push({...spec,styles:JSON.parse(spec.styles)});
  const visibleDrops=[];for(const d of drops)if(publishedIds.has(d.itemId)){const p=pledges.find(p=>p.dropId===d.id);visibleDrops.push({...d,designerName:name(d.designerId),pledges:Number(p?.count||0),joined:!!p?.joined});}
  const recommendations=await recommendationScores(uid,JSON.parse(profiles.find(p=>p.mode==='buy')?.weights||'{}'),designers,specs).catch(()=>undefined);
  return json({recommendations,profiles:profiles.map(p=>({...p,weights:JSON.parse(p.weights),sellReadyMade:!!p.sellReadyMade})),measurements:vault[0]?{...JSON.parse(vault[0].details),updatedAt:vault[0].updatedAt}:null,lookbooks:lookbooks.map(l=>({...l,items:JSON.parse(l.items)})),designers:designers.map(d=>({userId:d.userId,name:d.name,bio:d.bio,city:d.city,portfolio:d.portfolio,weights:JSON.parse(d.weights),creationCount:Number(creationRows.find(r=>r.userId===d.userId)?.count||0)})),requests:requests.map(r=>({...r,styles:JSON.parse(r.styles)})),bids,conversations:conversations.map(c=>({...c,buyerName:name(c.buyerId),designerName:name(c.designerId)})),messages:messages.reverse(),specs:visibleSpecs,drops:visibleDrops,commissions,evidence});
 }catch(e){console.error('Journey read failed',e instanceof Error?e.message:'unknown');return json({error:'Your workspace could not load. Please retry.'},503);}
}
export async function POST(request:Request){
 try{
  if(!originOK(request))return json({error:'Invalid origin.'},403);
  const user=await getAppUser();if(!user)return json({error:'Sign in to continue.'},401);
  const raw=await request.text();if(raw.length>15000)return json({error:'Request too large.'},413);
  let value:unknown;try{value=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  const parsed=schema.safeParse(value);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check your details.'},400);
  const a=parsed.data,uid=user.userId,db=getDb(),now=new Date().toISOString();
  if(!await allowWrite(uid,'journey',90))return json({error:'Please wait a moment before making more changes.'},429);
  if(a.action==='styleProfile'){
   if(a.mode==='design'&&a.sellReadyMade&&a.brandName.length<2)return json({error:'Enter your label name.'},400);
   const values={weights:JSON.stringify(normalizeWeights(a.weights as StyleWeights)),name:a.name,bio:a.bio,city:a.city,portfolio:a.portfolio,sellReadyMade:a.mode==='design'&&a.sellReadyMade?1:0,updatedAt:now};
   const role=a.mode==='buy'?'customer':'creator',details=JSON.stringify({name:a.name,email:user.email,city:a.city,bio:a.bio,brandName:a.brandName,website:a.portfolio,specialty:Object.keys(a.weights).filter(k=>a.weights[k]>0).join(', '),interests:Object.keys(a.weights).filter(k=>a.weights[k]>0).join(', ')});
   const writes=[db.insert(s.styleProfiles).values({userId:uid,mode:a.mode,...values}).onConflictDoUpdate({target:[s.styleProfiles.userId,s.styleProfiles.mode],set:values}),db.insert(s.profiles).values({userId:uid,name:a.name,bio:a.bio,role,createdAt:now}).onConflictDoUpdate({target:s.profiles.userId,set:{name:a.name,bio:a.bio}}),db.insert(s.portalAccounts).values({userId:uid,role,details,createdAt:now}).onConflictDoUpdate({target:[s.portalAccounts.userId,s.portalAccounts.role],set:{details}})];
   if(a.mode==='design'&&a.sellReadyMade)writes.push(db.insert(s.portalAccounts).values({userId:uid,role:'brand',details,createdAt:now}).onConflictDoUpdate({target:[s.portalAccounts.userId,s.portalAccounts.role],set:{details}}));
   await db.batch(writes as [typeof writes[number],...typeof writes]);return json({ok:true});
  }
  const onboarded=await db.select().from(s.styleProfiles).where(eq(s.styleProfiles.userId,uid)).limit(1);if(!onboarded.length&&!['conversation','message'].includes(a.action))return json({error:'Complete Buy or Design onboarding first.'},403);
  if(a.action==='measurements'){await db.insert(s.measurementVault).values({userId:uid,details:JSON.stringify(a.details),updatedAt:now}).onConflictDoUpdate({target:s.measurementVault.userId,set:{details:JSON.stringify(a.details),updatedAt:now}});return json({ok:true});}
  if(a.action==='deleteMeasurements'){await db.delete(s.measurementVault).where(eq(s.measurementVault.userId,uid));return json({ok:true});}
  if(a.action==='lookbook'){
   const items=[...new Set(a.items)];for(const id of items)if(!await publicItem(id))return json({error:'A selected piece is no longer available.'},400);
   if(a.id){const existing=await db.select().from(s.lookbooks).where(and(eq(s.lookbooks.id,a.id),eq(s.lookbooks.userId,uid))).limit(1);if(!existing.length)return json({error:'Lookbook not found.'},404);await db.update(s.lookbooks).set({name:a.name,items:JSON.stringify(items)}).where(and(eq(s.lookbooks.id,a.id),eq(s.lookbooks.userId,uid)));return json({ok:true,id:a.id});}
   const id=crypto.randomUUID();await db.insert(s.lookbooks).values({id,userId:uid,name:a.name,items:JSON.stringify(items),createdAt:now});return json({ok:true,id});
  }
  if(a.action==='deleteLookbook'){await db.delete(s.lookbooks).where(and(eq(s.lookbooks.id,a.id),eq(s.lookbooks.userId,uid)));return json({ok:true});}
  if(a.action==='request'){const id=crypto.randomUUID();await db.insert(s.designRequests).values({id,buyerId:uid,title:a.title,brief:a.brief,budget:a.budget,styles:JSON.stringify(a.styles),deadline:a.deadline,createdAt:now});return json({ok:true,id});}
  if(a.action==='closeRequest'){const changed=await db.update(s.designRequests).set({status:'closed'}).where(and(eq(s.designRequests.id,a.id),eq(s.designRequests.buyerId,uid),eq(s.designRequests.status,'open'))).returning();return changed.length?json({ok:true}):json({error:'Open request not found.'},404);}
  if(a.action==='bid'){
   if(!await isDesigner(uid))return json({error:'Complete Design onboarding to send a proposal.'},403);
   const r=(await db.select().from(s.designRequests).where(eq(s.designRequests.id,a.requestId)).limit(1))[0];if(!r||r.status!=='open'||r.deadline<now.slice(0,10))return json({error:'This request is no longer open.'},409);if(r.buyerId===uid)return json({error:'You cannot quote on your own request.'},400);
   if(a.sketch&&!await ownAsset(a.sketch,uid))return json({error:'Upload your own sketch image.'},400);
   if((await db.select().from(s.designBids).where(and(eq(s.designBids.requestId,a.requestId),eq(s.designBids.designerId,uid))).limit(1)).length)return json({error:'You already proposed for this request. Discuss changes in chat.'},409);
   const id=crypto.randomUUID();await db.insert(s.designBids).values({id,requestId:a.requestId,designerId:uid,quote:a.quote,days:a.days,message:a.message,sketch:a.sketch,createdAt:now});return json({ok:true,id});
  }
  if(a.action==='acceptBid'){
   const bid=(await db.select().from(s.designBids).where(eq(s.designBids.id,a.bidId)).limit(1))[0];if(!bid)return json({error:'Proposal not found.'},404);
   const r=(await db.select().from(s.designRequests).where(and(eq(s.designRequests.id,bid.requestId),eq(s.designRequests.buyerId,uid))).limit(1))[0];if(!r)return json({error:'Request not found.'},404);
   const existing=(await db.select().from(s.commissions).where(eq(s.commissions.requestId,r.id)).limit(1))[0];if(existing)return existing.bidId===a.bidId?json({ok:true,id:existing.id}):json({error:'Another proposal was already selected.'},409);
   if(r.status!=='open'||r.deadline<now.slice(0,10))return json({error:'Request is no longer open.'},409);
   const id=crypto.randomUUID();await db.batch([db.insert(s.commissions).values({id,requestId:r.id,buyerId:uid,designerId:bid.designerId,bidId:bid.id,title:r.title,amount:bid.quote,createdAt:now}),db.update(s.designRequests).set({status:'matched'}).where(and(eq(s.designRequests.id,r.id),eq(s.designRequests.status,'open')))]);return json({ok:true,id});
  }
  if(a.action==='conversation'){
   if(a.designerId===uid)return json({error:'Choose another designer to start a conversation.'},400);if(!await publicPerson(a.designerId))return json({error:'Creator or startup not found.'},404);if(await blocked(uid,a.designerId))return json({error:'Messaging is unavailable for this account.'},403);
   if(a.itemId&&(!await ownedItem(a.designerId,a.itemId)||!await publicItem(a.itemId)))return json({error:'This piece is unavailable.'},404);
   const existing=(await db.select().from(s.conversations).where(and(eq(s.conversations.buyerId,uid),eq(s.conversations.designerId,a.designerId),eq(s.conversations.itemId,a.itemId))).limit(1))[0];if(existing)return json({ok:true,id:existing.id});
   const reverse=(await db.select().from(s.conversations).where(and(eq(s.conversations.buyerId,a.designerId),eq(s.conversations.designerId,uid),eq(s.conversations.itemId,a.itemId))).limit(1))[0];if(reverse)return json({ok:true,id:reverse.id});
   const id=crypto.randomUUID();await db.insert(s.conversations).values({id,buyerId:uid,designerId:a.designerId,itemId:a.itemId,context:a.context,updatedAt:now}).onConflictDoNothing();const saved=(await db.select().from(s.conversations).where(and(eq(s.conversations.buyerId,uid),eq(s.conversations.designerId,a.designerId),eq(s.conversations.itemId,a.itemId))).limit(1))[0];return json({ok:true,id:saved?.id||id});
  }
  if(a.action==='message'){
   const c=(await db.select().from(s.conversations).where(and(eq(s.conversations.id,a.conversationId),or(eq(s.conversations.buyerId,uid),eq(s.conversations.designerId,uid)))).limit(1))[0];if(!c)return json({error:'Conversation not found.'},404);
   if(await blocked(c.buyerId,c.designerId))return json({error:'Messaging is unavailable for this conversation.'},403);
   await db.batch([db.insert(s.chatMessages).values({id:crypto.randomUUID(),conversationId:c.id,senderId:uid,body:a.body,createdAt:now}),db.update(s.conversations).set({updatedAt:now}).where(eq(s.conversations.id,c.id))]);return json({ok:true});
  }
  if(a.action==='spec'){
   if(!await isDesigner(uid)||!await ownedItem(uid,a.itemId))return json({error:'You can edit only your own portfolio pieces.'},403);
   if(a.textureMedia&&!await ownAsset(a.textureMedia,uid)&&!await ownAsset(a.textureMedia,uid,true))return json({error:'Upload your own fabric photo or video.'},400);
   if(a.certificate&&!await ownAsset(a.certificate,uid))return json({error:'Upload your own certificate image.'},400);
   const values={userId:uid,styles:JSON.stringify(a.styles),fabric:a.fabric,gsm:a.gsm,stitch:a.stitch,care:a.care,textureMedia:a.textureMedia,certificate:a.certificate,updatedAt:now};await db.insert(s.itemSpecs).values({itemId:a.itemId,...values}).onConflictDoUpdate({target:s.itemSpecs.itemId,set:values});return json({ok:true});
  }
  if(a.action==='drop'){
   if(!await isDesigner(uid)||!await ownedItem(uid,a.itemId)||!await publicItem(a.itemId))return json({error:'Choose one of your published pieces.'},403);
   const id=crypto.randomUUID();await db.insert(s.preorderDrops).values({id,designerId:uid,itemId:a.itemId,title:a.title,target:a.target,price:a.price,deadline:a.deadline,note:a.note,createdAt:now});return json({ok:true,id});
  }
  if(a.action==='pledge'){
   const d=(await db.select().from(s.preorderDrops).where(eq(s.preorderDrops.id,a.dropId)).limit(1))[0];if(!d||d.deadline<now.slice(0,10)||!await publicItem(d.itemId))return json({error:'This drop is no longer open.'},409);if(d.designerId===uid)return json({error:'You cannot register buyer interest in your own drop.'},400);
   if(a.join)await db.insert(s.dropPledges).values({dropId:d.id,userId:uid,createdAt:now}).onConflictDoNothing();else await db.delete(s.dropPledges).where(and(eq(s.dropPledges.dropId,d.id),eq(s.dropPledges.userId,uid)));return json({ok:true});
  }
  if(a.action==='evidence'){
   const c=(await db.select().from(s.commissions).where(and(eq(s.commissions.id,a.commissionId),eq(s.commissions.designerId,uid))).limit(1))[0];if(!c)return json({error:'Commission not found.'},404);
   if(!await ownAsset(a.asset,uid))return json({error:'Upload your own production image.'},400);
   if(a.stage==='dispatch'&&(await db.select().from(s.qualityEvidence).where(and(eq(s.qualityEvidence.commissionId,c.id),eq(s.qualityEvidence.stage,'materials'))).orderBy(desc(s.qualityEvidence.createdAt)).limit(1))[0]?.review!=='approved')return json({error:'Have the materials milestone approved first.'},409);
   await db.insert(s.qualityEvidence).values({id:crypto.randomUUID(),commissionId:c.id,designerId:uid,stage:a.stage,asset:a.asset,note:a.note,createdAt:now});return json({ok:true});
  }
  if(a.action==='review'){
   const rows=await db.select({e:s.qualityEvidence,c:s.commissions}).from(s.qualityEvidence).innerJoin(s.commissions,eq(s.commissions.id,s.qualityEvidence.commissionId)).where(and(eq(s.qualityEvidence.id,a.id),eq(s.commissions.buyerId,uid))).limit(1);
   if(!rows.length)return json({error:'Evidence not found.'},404);if(a.review==='changes_requested'&&a.feedback.length<3)return json({error:'Tell the designer what needs changing.'},400);
   await db.update(s.qualityEvidence).set({review:a.review,feedback:a.feedback}).where(eq(s.qualityEvidence.id,a.id));return json({ok:true});
  }
  return json({error:'Unknown action.'},400);
 }catch(e){if(e instanceof Error&&/unique constraint/i.test(e.message))return json({error:'This action was already recorded. Refresh to see the latest state.'},409);console.error('Journey write failed',e instanceof Error?e.message:'unknown');return json({error:'Your change could not be saved. Refresh and try again.'},500);}
}
