import {z} from 'zod';
import {getAppUser} from '../../auth';
import {originOK,allowWrite} from '../../lib/security';
import {dbRaw,noStore,publicContentSQL,publicPerson} from '../../lib/community';
export const dynamic='force-dynamic';
export async function GET(){try{
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to see analytics.'},401);const db=dbRaw(),uid=user.userId;
 const [performance,followers,views,sales,interests]=await Promise.all([
 db.prepare(`SELECT c.id,c.title,c.type,
 (SELECT count(*) FROM likes x WHERE x.product_id=c.id) AS likes,
 (SELECT count(*) FROM bookmarks x WHERE x.product_id=c.id) AS saves,
 (SELECT count(*) FROM comments x WHERE x.product_id=c.id) AS comments,
 (SELECT count(*) FROM shares x WHERE x.product_id=c.id) AS shares,
 (SELECT count(*) FROM content_views x WHERE x.item_id=c.id AND x.kind='content') AS views
 FROM (${publicContentSQL}) c WHERE c.userId=? ORDER BY views DESC,c.createdAt DESC`).bind(uid).all(),
 db.prepare('SELECT count(*) AS count FROM follows WHERE target_id=?').bind(uid).first<{count:number}>(),
 db.prepare(`SELECT day,kind,count(*) AS count FROM content_views WHERE owner_id=? AND day>=date('now','-6 days') GROUP BY day,kind ORDER BY day`).bind(uid).all(),
 db.prepare(`SELECT coalesce(sum(CASE WHEN mode='live' AND payment_status IN ('paid','refunded') THEN amount-refunded ELSE 0 END),0) AS netCollected,coalesce(sum(CASE WHEN mode='live' AND payment_status='paid' AND refunded=0 THEN quantity ELSE 0 END),0) AS unitsSold,coalesce(sum(CASE WHEN mode='live' AND payment_status='paid' AND refunded=0 THEN 1 ELSE 0 END),0) AS paidOrders,coalesce(sum(CASE WHEN payment_status IN ('unpaid','pending') THEN 1 ELSE 0 END),0) AS requests FROM purchases WHERE seller_id=?`).bind(uid).first(),
 db.prepare(`SELECT count(*) AS count FROM drop_pledges p JOIN preorder_drops d ON d.id=p.drop_id WHERE d.designer_id=?`).bind(uid).first<{count:number}>()
 ]);
 return noStore({performance:performance.results,followers:followers?.count||0,views:views.results,sales,dropInterest:interests?.count||0,updatedAt:new Date().toISOString()});
 }catch{return noStore({error:'Analytics could not load.'},503);}}
export async function POST(request:Request){try{
 if(!originOK(request))return noStore({error:'Invalid origin.'},403);const user=await getAppUser();if(!user)return noStore({error:'Sign in required.'},401);
 const raw=await request.text();if(raw.length>5000)return noStore({error:'Request too large.'},413);const a=z.object({id:z.string().min(1).max(150),kind:z.enum(['content','profile'])}).parse(JSON.parse(raw));
 if(!await allowWrite(user.userId,'views',120))return noStore({error:'Please wait.'},429);
 const db=dbRaw(),owner=a.kind==='profile'?(await publicPerson(a.id))?.userId:(await db.prepare(`SELECT userId FROM (${publicContentSQL}) WHERE id=?`).bind(a.id).first<{userId:string}>())?.userId;
 if(!owner)return noStore({error:'Published content not found.'},404);if(owner===user.userId)return noStore({ok:true,counted:false});
 const now=new Date().toISOString();await db.prepare('INSERT OR IGNORE INTO content_views(viewer_id,item_id,owner_id,kind,day,created_at) VALUES(?,?,?,?,?,?)').bind(user.userId,a.id,owner,a.kind,now.slice(0,10),now).run();return noStore({ok:true});
 }catch{return noStore({error:'Invalid activity request.'},400);}}
