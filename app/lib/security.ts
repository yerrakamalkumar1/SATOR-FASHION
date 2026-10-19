import {env} from 'cloudflare:workers';
import {getDb} from '../../db';
import {portalAccounts,rateLimits,designs,posts,listings} from '../../db/schema';
import {and,eq,sql} from 'drizzle-orm';
import {catalog} from '../model';
export async function hasRole(userId:string,role:string){return !!(await getDb().select().from(portalAccounts).where(and(eq(portalAccounts.userId,userId),eq(portalAccounts.role,role))).limit(1)).length;}
export async function publicItem(id:string){if(catalog.some(p=>p.id===id))return true;const db=getDb();return !!((await db.select({id:designs.id}).from(designs).where(and(eq(designs.id,id),eq(designs.published,1))).limit(1)).length||(await db.select({id:posts.id}).from(posts).where(eq(posts.id,id)).limit(1)).length||(await db.select({id:listings.id}).from(listings).where(and(eq(listings.id,id),eq(listings.published,1))).limit(1)).length);}
export async function ownAsset(path:string,uid:string,video=false){if(!/^\/api\/assets\/[a-f0-9-]{36}$/.test(path)||!env.BUCKET)return false;const obj=await env.BUCKET.head(path.split('/').pop()!);return !!obj&&obj.customMetadata?.owner===uid&&(video?obj.httpMetadata?.contentType==='video/mp4':obj.httpMetadata?.contentType?.startsWith('image/'));}
export async function allowWrite(uid:string,bucket='general',limit=90){const id=uid+':'+bucket+':'+Math.floor(Date.now()/60000),db=getDb();const row=await db.insert(rateLimits).values({id,count:1}).onConflictDoUpdate({target:rateLimits.id,set:{count:sql`${rateLimits.count}+1`}}).returning();return row[0].count<=limit;}
export const originOK=(r:Request)=>!r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin;
