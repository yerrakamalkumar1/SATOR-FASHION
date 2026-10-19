import {env} from 'cloudflare:workers';
export const publicPeopleSQL=`SELECT p.user_id AS userId,p.name,p.bio,p.created_at AS createdAt,
 coalesce((SELECT json_extract(a.details,'$.brandName') FROM portal_accounts a WHERE a.user_id=p.user_id AND a.role='brand'),'') AS brandName,
 coalesce((SELECT city FROM style_profiles sp WHERE sp.user_id=p.user_id AND sp.mode='design'),'') AS city,
 coalesce((SELECT weights FROM style_profiles sp WHERE sp.user_id=p.user_id AND sp.mode='design'),'{}') AS weights,
 (SELECT group_concat(a.role) FROM portal_accounts a WHERE a.user_id=p.user_id) AS roles,
 (SELECT count(*) FROM designs d WHERE d.user_id=p.user_id AND d.published=1) AS designCount,
 (SELECT count(*) FROM posts po WHERE po.user_id=p.user_id) AS postCount,
 (SELECT count(*) FROM listings l WHERE l.user_id=p.user_id AND l.published=1) AS productCount,
 (SELECT count(*) FROM follows f WHERE f.target_id=p.user_id) AS followers
 ,coalesce((SELECT avatar FROM member_preferences m WHERE m.user_id=p.user_id),'') AS avatar,
 coalesce((SELECT discoverable FROM member_preferences m WHERE m.user_id=p.user_id),1) AS discoverable,
 (SELECT count(*) FROM posts po WHERE po.user_id=p.user_id AND po.media_type='video') AS reelCount,
 (SELECT count(*) FROM follows f WHERE f.follower_id=p.user_id) AS following,
 CASE WHEN coalesce((SELECT show_sales FROM member_preferences m WHERE m.user_id=p.user_id),1)=1 THEN
 (SELECT coalesce(sum(quantity),0) FROM purchases pu WHERE pu.seller_id=p.user_id AND pu.mode='live' AND pu.payment_status='paid' AND pu.refunded=0) ELSE NULL END AS unitsSold
 FROM profiles p`;
export const publicContentSQL=`SELECT d.id,d.user_id AS userId,d.title,d.description AS body,d.category,d.created_at AS createdAt,'design' AS type,'' AS media,'image' AS mediaType,d.config,NULL AS price,0 AS stock,'[]' AS sizes,0 AS shipping,coalesce(p.name,'Independent creator') AS creator FROM designs d LEFT JOIN profiles p ON p.user_id=d.user_id WHERE d.published=1
 UNION ALL SELECT po.id,po.user_id,po.title,po.caption,po.category,po.created_at,'post',po.media_url,po.media_type,NULL,NULL,0,'[]',0,coalesce(p.name,'Independent creator') FROM posts po LEFT JOIN profiles p ON p.user_id=po.user_id
 UNION ALL SELECT l.id,l.user_id,l.title,l.description,l.category,l.created_at,'listing',l.image,'image',NULL,l.price,l.stock,l.sizes,l.shipping,coalesce(nullif((SELECT json_extract(a.details,'$.brandName') FROM portal_accounts a WHERE a.user_id=l.user_id AND a.role='brand'),''),p.name,'Independent label') FROM listings l LEFT JOIN profiles p ON p.user_id=l.user_id WHERE l.published=1`;
export type PublicPerson={userId:string;name:string;bio:string;brandName:string;city:string;weights:string;roles:string|null;designCount:number;postCount:number;productCount:number;followers:number;avatar:string;discoverable:number;reelCount:number;following:number;unitsSold:number|null};
export type PublicContent={id:string;userId:string;title:string;body:string;category:string;createdAt:string;type:'design'|'post'|'listing';media:string;mediaType:string;config:string|null;price:number|null;stock:number;sizes:string;shipping:number;creator:string};
export const dbRaw=()=>{if(!env.DB)throw new Error('Storage unavailable');return env.DB;};
export async function blocked(a:string,b:string){return !!await dbRaw().prepare('SELECT 1 FROM member_blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?) LIMIT 1').bind(a,b,b,a).first();}
export async function publicPerson(id:string){return dbRaw().prepare(`SELECT * FROM (${publicPeopleSQL}) WHERE userId=?`).bind(id).first<PublicPerson>();}
export const noStore=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
