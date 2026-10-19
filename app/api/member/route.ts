import {z} from 'zod';
import {getAppUser} from '../../auth';
import {dbRaw,noStore,publicContentSQL} from '../../lib/community';
import {allowWrite,originOK,ownAsset} from '../../lib/security';
import {defaultPreferences} from '../../member-model';
import {catalog} from '../../model';
export const dynamic='force-dynamic';
const columns={discoverable:'discoverable',showSales:'show_sales',notifyLikes:'notify_likes',notifyComments:'notify_comments',notifyFollows:'notify_follows',notifyMessages:'notify_messages',notifyOrders:'notify_orders'} as const;
const appearanceColumns={theme:'theme',textSize:'text_size',density:'density',motion:'motion'} as const;
const sampleSQL=`SELECT json_extract(value,'$.id') id,'' userId,json_extract(value,'$.title') title,json_extract(value,'$.description') body,json_extract(value,'$.category') category,'' createdAt,'design' type,'' media,'image' mediaType,json_extract(value,'$.config') config,NULL price,0 stock,'[]' sizes,0 shipping,json_extract(value,'$.creator') creator FROM json_each(?)`;
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to open your settings.'},401);const db=dbRaw(),uid=user.userId,p=new URL(request.url).searchParams;
 if(p.get('section')==='activity'){
  const kind=p.get('kind')||'saved';if(!['saved','likes','comments'].includes(kind))return noStore({error:'Invalid activity filter.'},400);
  const page=Math.max(0,Math.min(10000,Math.floor(Number(p.get('page'))||0))),board=(p.get('board')||'').slice(0,40);
  const table=kind==='saved'?'bookmarks':kind==='likes'?'likes':'comments',fields=kind==='comments'?"a.id AS activityId,a.body AS note,'' AS board":kind==='saved'?"a.product_id AS activityId,'' AS note,a.board":"a.product_id AS activityId,'' AS note,'' AS board";
  const rows=await db.prepare(`WITH content AS (${publicContentSQL} UNION ALL ${sampleSQL}) SELECT c.*,${fields},a.created_at AS activityAt FROM ${table} a JOIN content c ON c.id=a.product_id WHERE a.user_id=? ${kind==='saved'?"AND (?='' OR a.board=?)":''} ORDER BY a.created_at DESC,activityId DESC LIMIT 25 OFFSET ?`).bind(JSON.stringify(catalog),uid,...(kind==='saved'?[board,board]:[]),page*24).all();
  const boards=await db.prepare('SELECT DISTINCT board FROM bookmarks WHERE user_id=? ORDER BY board COLLATE NOCASE').bind(uid).all<{board:string}>();
  return noStore({items:rows.results.slice(0,24),hasMore:rows.results.length>24,page,boards:boards.results.map(b=>b.board)});
 }
 const [row,blocked,counts]=await Promise.all([
  db.prepare('SELECT * FROM member_preferences WHERE user_id=?').bind(uid).first<Record<string,string|number>>(),
  db.prepare("SELECT b.target_id AS userId,coalesce(p.name,'ŚATOR member') AS name FROM member_blocks b LEFT JOIN profiles p ON p.user_id=b.target_id WHERE b.user_id=? ORDER BY b.created_at DESC").bind(uid).all(),
  db.prepare('SELECT (SELECT count(*) FROM bookmarks WHERE user_id=?) saved,(SELECT count(*) FROM likes WHERE user_id=?) likes,(SELECT count(*) FROM comments WHERE user_id=?) comments').bind(uid,uid,uid).first(),
 ]);
 const preferences={...defaultPreferences,avatar:String(row?.avatar||'')};for(const [key,col] of Object.entries(columns))preferences[key as keyof typeof columns]=row?row[col]===1:true;
 for(const [key,col] of Object.entries(appearanceColumns))Object.assign(preferences,{[key]:String(row?.[col]||defaultPreferences[key as keyof typeof appearanceColumns])});
 return noStore({preferences,blocked:blocked.results,counts});
 }catch{return noStore({error:'Your account settings could not load. Please retry.'},503);}}
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('preferences'),values:z.object({avatar:z.string().max(150).optional(),discoverable:z.boolean().optional(),showSales:z.boolean().optional(),notifyLikes:z.boolean().optional(),notifyComments:z.boolean().optional(),notifyFollows:z.boolean().optional(),notifyMessages:z.boolean().optional(),notifyOrders:z.boolean().optional(),theme:z.enum(['system','light','dark']).optional(),textSize:z.enum(['standard','large','extra-large']).optional(),density:z.enum(['comfortable','compact']).optional(),motion:z.enum(['system','reduced']).optional()}).strict()}),
 z.object({action:z.literal('block'),targetId:z.string().min(1).max(150),blocked:z.boolean()}),
 z.object({action:z.literal('moveBookmark'),id:z.string().min(1).max(80),board:z.string().trim().min(1).max(40)}),
 z.object({action:z.literal('deleteComment'),id:z.string().uuid()}),
]);
export async function POST(request:Request){try{
 if(!originOK(request))return noStore({error:'Invalid origin.'},403);const user=await getAppUser();if(!user)return noStore({error:'Sign in to make changes.'},401);
 const raw=await request.text();if(raw.length>2500)return noStore({error:'Request too large.'},413);const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return noStore({error:'Check the setting and try again.'},400);
 const uid=user.userId,db=dbRaw(),a=parsed.data,now=new Date().toISOString();if(!await allowWrite(uid,'member',60))return noStore({error:'Please wait a minute and retry.'},429);
 if(a.action==='preferences'){
  if(a.values.avatar&&!await ownAsset(a.values.avatar,uid))return noStore({error:'Upload your own profile photo first.'},400);
  const entries=Object.entries(a.values);if(!entries.length)return noStore({ok:true});
  const names=entries.map(([k])=>k==='avatar'?'avatar':appearanceColumns[k as keyof typeof appearanceColumns]||columns[k as keyof typeof columns]),values=entries.map(([,v])=>typeof v==='boolean'?(v?1:0):v);
  await db.prepare(`INSERT INTO member_preferences(user_id,updated_at,${names.join(',')}) VALUES(?,?,${names.map(()=>'?').join(',')}) ON CONFLICT(user_id) DO UPDATE SET updated_at=excluded.updated_at,${names.map(n=>`${n}=excluded.${n}`).join(',')}`).bind(uid,now,...values).run();
 }else if(a.action==='block'){
  if(a.targetId===uid)return noStore({error:'You cannot block yourself.'},400);if(!await db.prepare('SELECT 1 FROM profiles WHERE user_id=?').bind(a.targetId).first())return noStore({error:'Member not found.'},404);
  if(a.blocked)await db.prepare('INSERT OR IGNORE INTO member_blocks(user_id,target_id,created_at) VALUES(?,?,?)').bind(uid,a.targetId,now).run();else await db.prepare('DELETE FROM member_blocks WHERE user_id=? AND target_id=?').bind(uid,a.targetId).run();
 }else if(a.action==='moveBookmark'){
  const r=await db.prepare('UPDATE bookmarks SET board=? WHERE user_id=? AND product_id=?').bind(a.board,uid,a.id).run();if(!r.meta.changes)return noStore({error:'Saved item not found.'},404);
 }else{
  const r=await db.prepare('DELETE FROM comments WHERE id=? AND user_id=?').bind(a.id,uid).run();if(!r.meta.changes)return noStore({error:'Comment not found.'},404);
 }
 return noStore({ok:true});
 }catch(e){return noStore({error:e instanceof SyntaxError?'Invalid request.':'Your change could not be saved. Please retry.'},e instanceof SyntaxError?400:503);}}
