import {z} from 'zod';
import {getAppUser} from '../../auth';
import {dbRaw,noStore,publicContentSQL} from '../../lib/community';
import {allowWrite,originOK} from '../../lib/security';
import type {ActivityNotification} from '../../notification-model';
export const dynamic='force-dynamic';
// Keep deleted/unpublished content and blocked members out of both the list and its badge.
const visible=`coalesce((SELECT CASE
 WHEN n.kind='like' THEN m.notify_likes WHEN n.kind='comment' THEN m.notify_comments
 WHEN n.kind='follow' THEN m.notify_follows WHEN n.kind IN ('message','connection') THEN m.notify_messages
 ELSE m.notify_orders END FROM member_preferences m WHERE m.user_id=n.recipient_id),1)=1 AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE
 (b.user_id=n.recipient_id AND b.target_id=n.actor_id) OR (b.user_id=n.actor_id AND b.target_id=n.recipient_id)) AND
 CASE n.target_kind
 WHEN 'content' THEN EXISTS(SELECT 1 FROM (${publicContentSQL}) c WHERE c.id=n.target_id AND c.userId=n.recipient_id)
 WHEN 'profile' THEN EXISTS(SELECT 1 FROM profiles p WHERE p.user_id=n.actor_id)
 WHEN 'conversation' THEN EXISTS(SELECT 1 FROM conversations c WHERE c.id=n.target_id AND n.recipient_id IN (c.buyer_id,c.designer_id))
 WHEN 'request' THEN EXISTS(SELECT 1 FROM design_requests r WHERE r.id=n.target_id AND r.buyer_id=n.recipient_id)
 WHEN 'commission' THEN EXISTS(SELECT 1 FROM commissions c WHERE c.id=n.target_id AND n.recipient_id IN (c.buyer_id,c.designer_id))
 ELSE 0 END`;
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to view notifications.'},401);
 const params=new URL(request.url).searchParams,before=params.get('before'),onlyUnread=params.get('unread')==='1';
 if(before&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))))return noStore({error:'Invalid notification cursor.'},400);
 const db=dbRaw(),uid=user.userId;
 const [rows,stats]=await Promise.all([
  db.prepare(`SELECT n.id,n.actor_id AS actorId,coalesce(p.name,'ŚATOR member') AS actorName,n.kind,n.target_kind AS targetKind,n.target_id AS targetId,n.title,n.created_at AS createdAt,n.read_at AS readAt
   FROM notifications n LEFT JOIN profiles p ON p.user_id=n.actor_id WHERE n.recipient_id=? AND ${visible} AND (?=0 OR n.id<?) AND (?=0 OR n.read_at IS NULL) ORDER BY n.id DESC LIMIT 31`).bind(uid,Number(before)||0,Number(before)||0,onlyUnread?1:0).all<ActivityNotification>(),
  db.prepare(`SELECT coalesce(sum(n.read_at IS NULL),0) AS unread,coalesce(max(n.id),0) AS latestId FROM notifications n WHERE n.recipient_id=? AND ${visible}`).bind(uid).first<{unread:number;latestId:number}>(),
 ]);
 const items=rows.results.slice(0,30);return noStore({items,unread:stats?.unread||0,latestId:stats?.latestId||0,hasMore:rows.results.length>30,nextBefore:items.at(-1)?.id||null});
 }catch{return noStore({error:'Notifications could not load. Please retry.'},503);}}
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('read'),id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}),
 z.object({action:z.literal('readAll'),through:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}),
]);
export async function POST(request:Request){try{
 if(!originOK(request))return noStore({error:'Invalid origin.'},403);
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to update notifications.'},401);
 const raw=await request.text();if(raw.length>1000)return noStore({error:'Request too large.'},413);
 const parsed=action.safeParse(JSON.parse(raw));if(!parsed.success)return noStore({error:'Invalid notification action.'},400);
 if(!await allowWrite(user.userId,'notifications',120))return noStore({error:'Please wait a moment and retry.'},429);
 const a=parsed.data,db=dbRaw(),now=new Date().toISOString();
 if(a.action==='read'){
  const found=await db.prepare(`SELECT n.id FROM notifications n WHERE n.id=? AND n.recipient_id=? AND ${visible}`).bind(a.id,user.userId).first();
  if(!found)return noStore({error:'Notification not found.'},404);
  await db.prepare('UPDATE notifications SET read_at=coalesce(read_at,?) WHERE id=? AND recipient_id=?').bind(now,a.id,user.userId).run();
 }else await db.prepare(`UPDATE notifications SET read_at=? WHERE recipient_id=? AND id<=? AND read_at IS NULL AND id IN (SELECT n.id FROM notifications n WHERE n.recipient_id=? AND ${visible})`).bind(now,user.userId,a.through,user.userId).run();
 return noStore({ok:true});
 }catch(e){return noStore({error:e instanceof SyntaxError?'Invalid request.':'Could not update notifications. Please retry.'},e instanceof SyntaxError?400:503);}}
