import {getAppUser} from '../../auth';
import {dbRaw,noStore} from '../../lib/community';
import {publicItem} from '../../lib/security';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to view comments.'},401);
 const p=new URL(request.url).searchParams,id=p.get('item')||'',page=Math.max(0,Math.min(10000,Math.floor(Number(p.get('page'))||0)));
 if(!id||id.length>80||!await publicItem(id))return noStore({error:'This published piece is no longer available.'},404);
 const db=dbRaw();const [rows,count]=await Promise.all([
 db.prepare("SELECT c.id,c.user_id AS userId,coalesce(p.name,'ŚATOR member') AS name,coalesce(m.avatar,'') avatar,c.body,c.created_at AS createdAt FROM comments c LEFT JOIN profiles p ON p.user_id=c.user_id LEFT JOIN member_preferences m ON m.user_id=c.user_id WHERE c.product_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 31 OFFSET ?").bind(id,page*30).all(),
 db.prepare('SELECT count(*) AS count FROM comments WHERE product_id=?').bind(id).first<{count:number}>(),
 ]);return noStore({items:rows.results.slice(0,30),total:count?.count||0,hasMore:rows.results.length>30,page});
 }catch{return noStore({error:'Comments could not load. Please retry.'},503);}}
