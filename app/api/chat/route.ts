import {z} from 'zod';
import {getAppUser} from '../../auth';
import {allowWrite,originOK} from '../../lib/security';
import {dbRaw,blocked,noStore} from '../../lib/community';
export const dynamic='force-dynamic';
type Thread={id:string;buyerId:string;designerId:string;context:string;otherId:string;name:string;updatedAt:string;unread:number;lastMessage:string;blocked:number};
async function threadFor(uid:string,id:string){return dbRaw().prepare('SELECT id,buyer_id AS buyerId,designer_id AS designerId FROM conversations WHERE id=? AND (buyer_id=? OR designer_id=?)').bind(id,uid,uid).first<{id:string;buyerId:string;designerId:string}>();}
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to read messages.'},401);const uid=user.userId,db=dbRaw(),params=new URL(request.url).searchParams,id=params.get('id');
 if(!id){const threads=await db.prepare(`SELECT c.id,c.buyer_id AS buyerId,c.designer_id AS designerId,c.context,c.updated_at AS updatedAt,CASE WHEN c.buyer_id=? THEN c.designer_id ELSE c.buyer_id END AS otherId,coalesce(p.name,'ŚATOR member') AS name,
 (SELECT body FROM chat_messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) AS lastMessage,
 (SELECT count(*) FROM chat_messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.created_at>coalesce(r.last_read_at,'')) AS unread,
 EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=c.buyer_id AND b.target_id=c.designer_id) OR (b.user_id=c.designer_id AND b.target_id=c.buyer_id)) AS blocked
 FROM conversations c LEFT JOIN profiles p ON p.user_id=CASE WHEN c.buyer_id=? THEN c.designer_id ELSE c.buyer_id END LEFT JOIN conversation_reads r ON r.conversation_id=c.id AND r.user_id=? WHERE c.buyer_id=? OR c.designer_id=? ORDER BY CASE WHEN c.id=? THEN 0 ELSE 1 END,c.updated_at DESC,c.id DESC LIMIT 200`).bind(uid,uid,uid,uid,uid,uid,params.get('thread')||'').all<Thread>();
 const unread=await db.prepare(`SELECT count(*) AS n FROM chat_messages m JOIN conversations c ON c.id=m.conversation_id LEFT JOIN conversation_reads r ON r.conversation_id=c.id AND r.user_id=? WHERE (c.buyer_id=? OR c.designer_id=?) AND m.sender_id<>? AND m.created_at>coalesce(r.last_read_at,'')`).bind(uid,uid,uid,uid).first<{n:number}>();return noStore({threads:threads.results,unread:unread?.n||0});}
 const c=await threadFor(uid,id);if(!c)return noStore({error:'Conversation not found.'},404);
 const before=params.get('before')||'',cursor=params.get('cursor')||'';
 const messages=await db.prepare(`SELECT id,conversation_id AS conversationId,sender_id AS senderId,body,created_at AS createdAt FROM chat_messages WHERE conversation_id=? AND (?='' OR created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 51`).bind(id,before,before,before,cursor).all();
 const other=c.buyerId===uid?c.designerId:c.buyerId,read=await db.prepare('SELECT last_read_at AS at FROM conversation_reads WHERE conversation_id=? AND user_id=?').bind(id,other).first<{at:string}>();
 const ownBlock=await db.prepare('SELECT 1 FROM member_blocks WHERE user_id=? AND target_id=?').bind(uid,other).first();
 return noStore({messages:messages.results.slice(0,50).reverse(),hasMore:messages.results.length>50,otherReadAt:read?.at||'',blocked:await blocked(uid,other),blockedByMe:!!ownBlock,otherId:other});
 }catch{return noStore({error:'Messages could not be loaded. Please retry.'},503);}}
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('send'),conversationId:z.string().uuid(),id:z.string().uuid(),body:z.string().trim().min(1).max(3000)}),
 z.object({action:z.literal('read'),conversationId:z.string().uuid(),messageId:z.string().uuid()}),
 z.object({action:z.literal('block'),conversationId:z.string().uuid(),blocked:z.boolean()})
]);
export async function POST(request:Request){try{
 if(!originOK(request))return noStore({error:'Invalid origin.'},403);const user=await getAppUser();if(!user)return noStore({error:'Sign in to send messages.'},401);
 const raw=await request.text();if(raw.length>14000)return noStore({error:'Message too large.'},413);const parsed=action.safeParse(JSON.parse(raw));if(!parsed.success)return noStore({error:'Check your message.'},400);
 const a=parsed.data,uid=user.userId,db=dbRaw(),c=await threadFor(uid,a.conversationId);if(!c)return noStore({error:'Conversation not found.'},404);
 if(!await allowWrite(uid,'chat',120))return noStore({error:'Too many requests. Please wait a minute.'},429);
 const other=c.buyerId===uid?c.designerId:c.buyerId,now=new Date().toISOString();
 if(a.action==='block'){if(a.blocked)await db.prepare('INSERT OR IGNORE INTO member_blocks(user_id,target_id,created_at) VALUES(?,?,?)').bind(uid,other,now).run();else await db.prepare('DELETE FROM member_blocks WHERE user_id=? AND target_id=?').bind(uid,other).run();return noStore({ok:true});}
 if(a.action==='read'){const msg=await db.prepare('SELECT created_at AS at FROM chat_messages WHERE id=? AND conversation_id=?').bind(a.messageId,c.id).first<{at:string}>();if(!msg)return noStore({error:'Message not found.'},404);await db.prepare(`INSERT INTO conversation_reads(conversation_id,user_id,last_read_at) VALUES(?,?,?) ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_read_at=max(last_read_at,excluded.last_read_at)`).bind(c.id,uid,msg.at).run();return noStore({ok:true});}
 if(await blocked(uid,other))return noStore({error:'Messaging is unavailable for this conversation.'},403);
 const previous=await db.prepare('SELECT id,sender_id AS senderId,conversation_id AS conversationId,body FROM chat_messages WHERE id=?').bind(a.id).first<{id:string;senderId:string;conversationId:string;body:string}>();
 if(previous)return previous.senderId===uid&&previous.conversationId===c.id&&previous.body===a.body?noStore({ok:true,id:a.id}):noStore({error:'Message retry does not match.'},409);
 await db.batch([db.prepare('INSERT INTO chat_messages(id,conversation_id,sender_id,body,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(a.id,c.id,uid,a.body,now),db.prepare('UPDATE conversations SET updated_at=max(updated_at,?) WHERE id=?').bind(now,c.id)]);return noStore({ok:true,id:a.id});
 }catch(e){return noStore({error:e instanceof SyntaxError?'Invalid request.':'Message was not confirmed. Retry without changing the message to avoid duplicates.'},e instanceof SyntaxError?400:503);}}
