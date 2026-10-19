import {env} from 'cloudflare:workers';
import {Buffer} from 'node:buffer';
import {scrypt,timingSafeEqual,randomBytes,createHash} from 'node:crypto';

export const SESSION_COOKIE='__Host-sator_session';
export const SESSION_SECONDS=14*24*60*60;
export type EmailAccount={id:string;email:string;name:string;phone:string;password_hash:string;recovery_hash:string;auth_version:number;created_at:string};
const SCRYPT={N:32768,r:8,p:3,maxmem:48*1024*1024};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const tokenHash=digest;
export const newToken=()=>randomBytes(32).toString('hex');
export function authDb(){if(!env.DB)throw new Error('Authentication storage unavailable');return env.DB;}
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>{
 scrypt(password,salt,32,SCRYPT,(error,key)=>error?reject(error):resolve(key));
});
export async function hashPassword(password:string){
 const salt=randomBytes(16).toString('hex');
 return 'scrypt-v1$'+salt+'$'+(await derive(password,salt)).toString('hex');
}
export async function verifyPassword(password:string,stored:string){
 const parts=stored.split('$');
 if(parts.length!==3||parts[0]!=='scrypt-v1'||!/^([a-f0-9]{32})$/.test(parts[1])||!/^([a-f0-9]{64})$/.test(parts[2]))return false;
 const actual=await derive(password,parts[1]);
 return timingSafeEqual(actual,Buffer.from(parts[2],'hex'));
}
// Nonexistent accounts still perform the same expensive password derivation.
export const DUMMY_HASH='scrypt-v1$00000000000000000000000000000000$'+'0'.repeat(64);
export function readSessionToken(headers:Headers){
 const value=headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 return value===undefined?null:value;
}
export function sessionCookie(token:string,clear=false){return `${SESSION_COOKIE}=${clear?'':token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear?0:SESSION_SECONDS}`;}
export async function findEmailSession(headers:Headers){
 const token=readSessionToken(headers);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 return authDb().prepare(`SELECT a.id,a.email,a.name,a.phone,a.auth_version FROM email_sessions s JOIN email_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.auth_version=a.auth_version`).bind(digest(token),Date.now()).first<Pick<EmailAccount,'id'|'email'|'name'|'phone'|'auth_version'>>();
}
export function sessionInsert(accountId:string,version:number,token:string){
 const now=Date.now();return authDb().prepare('INSERT INTO email_sessions (token_hash,account_id,auth_version,expires_at,created_at) VALUES (?,?,?,?,?)').bind(digest(token),accountId,version,now+SESSION_SECONDS*1000,now);
}
export async function revokeSession(headers:Headers){
 const token=readSessionToken(headers);if(token&&/^[a-f0-9]{64}$/.test(token))await authDb().prepare('DELETE FROM email_sessions WHERE token_hash=?').bind(digest(token)).run();
}
export async function allowAuthAttempt(email:string,ip:string,action:string){
 const db=authDb(),now=Date.now(),windowMs=15*60*1000,bucket=Math.floor(now/windowMs),expiry=(bucket+1)*windowMs;
 const limits:[string,number][]=[['email:'+email,action==='signup'?8:12],['ip:'+ip,action==='signup'?25:80],['global',1200]];
 const results=await db.batch(limits.map(([key])=>db.prepare('INSERT INTO auth_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(action+':'+digest(key)+':'+bucket,expiry)));
 await db.batch([db.prepare('DELETE FROM auth_attempts WHERE key IN (SELECT key FROM auth_attempts WHERE expires_at<? LIMIT 200)').bind(now),db.prepare('DELETE FROM email_sessions WHERE token_hash IN (SELECT token_hash FROM email_sessions WHERE expires_at<? LIMIT 200)').bind(now)]);
 return results.every((result,index)=>Number((result.results[0] as {count:number})?.count)<=limits[index][1]);
}
