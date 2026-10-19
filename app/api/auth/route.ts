import {z} from 'zod';
import {getChatGPTUser} from '../../chatgpt-auth';
import {authDb,hashPassword,verifyPassword,DUMMY_HASH,newToken,tokenHash,sessionInsert,sessionCookie,revokeSession,allowAuthAttempt,type EmailAccount} from '../../lib/email-auth';
export const dynamic='force-dynamic';
const email=z.string().trim().toLowerCase().email().max(254);
const password=z.string().min(12,'Use at least 12 characters.').max(128,'Use no more than 128 characters.').refine(v=>v.trim().length>=12,'Use at least 12 non-padding characters.');
const commonPasswords=new Set(['password1234','password12345','password123456','123456789012','qwertyuiop12','qwertyuiop123','abcdefghijkl','111111111111']);
const newPassword=password.refine(v=>!commonPasswords.has(v.toLowerCase()),'Choose a less common password.');
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('signup'),name:z.string().trim().min(2).max(60),email,password:newPassword,phone:z.string().trim().max(25).refine(v=>!v||/^\+?[\d ()-]{7,25}$/.test(v)&&v.replace(/\D/g,'').length>=7&&v.replace(/\D/g,'').length<=15,'Enter a valid phone number.').default('')}),
 z.object({action:z.literal('signin'),email,password:z.string().min(1).max(128)}),
 z.object({action:z.literal('recover'),email,recoveryKey:z.string().trim().regex(/^[a-f0-9]{64}$/i),password:newPassword}),
 z.object({action:z.literal('logout')}),
]);
const json=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
async function readBody(request:Request){
 if(Number(request.headers.get('content-length')||0)>4096)throw new Error('large');
 const reader=request.body?.getReader();if(!reader)throw new Error('empty');
 const decoder=new TextDecoder();let body='',size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Error('large');}body+=decoder.decode(value,{stream:true});}return JSON.parse(body+decoder.decode());}finally{reader.releaseLock();}
}
export async function POST(request:Request){
 // JSON + a same-origin Origin header prevents login and logout CSRF.
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Please submit this form from ŚATOR.'},403);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'Use the account form to continue.'},415);
 let data;try{data=await readBody(request);}catch{return json({error:'Check the form and try again.'},400);}
 const parsed=schema.safeParse(data);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Check the form fields.'},400);
 const a=parsed.data;
 try{
  if(a.action==='logout'){
   await revokeSession(request.headers);
   const provider=await getChatGPTUser();
   return json({ok:true,providerSignOut:!!provider},200,sessionCookie('',true));
  }
  // Only CF's trusted connection header is used; forwarded headers are ignored.
  if(!await allowAuthAttempt(a.email,request.headers.get('cf-connecting-ip')||'unavailable',a.action))return json({error:'Too many attempts. Please wait 15 minutes and try again.'},429);
  const db=authDb();
  const account=await db.prepare('SELECT * FROM email_accounts WHERE email=?').bind(a.email).first<EmailAccount>();
  if(a.action==='signup'){
   const passwordHash=await hashPassword(a.password);
   if(account)return json({error:'Unable to create this account. Try signing in or use another email.'},409);
   const id='email_'+crypto.randomUUID(),token=newToken(),recoveryKey=newToken(),now=new Date().toISOString();
   try{
    await db.batch([
     db.prepare('INSERT INTO email_accounts (id,email,name,phone,password_hash,recovery_hash,auth_version,created_at) VALUES (?,?,?,?,?,?,1,?)').bind(id,a.email,a.name,a.phone,passwordHash,tokenHash(recoveryKey),now),
     db.prepare('INSERT INTO profiles (user_id,name,bio,role,created_at) VALUES (?,?,?, ?,?)').bind(id,a.name,'','customer',now),
     sessionInsert(id,1,token),
    ]);
   }catch(error){if(String(error).includes('UNIQUE'))return json({error:'Unable to create this account. Try signing in or use another email.'},409);throw error;}
   await revokeSession(request.headers);
   return json({ok:true,recoveryKey},201,sessionCookie(token));
  }
  if(a.action==='signin'){
   const matches=await verifyPassword(a.password,account?.password_hash||DUMMY_HASH);
   if(!account||!matches)return json({error:'The email or password is incorrect.'},401);
   const token=newToken();
   await db.batch([db.prepare('DELETE FROM email_sessions WHERE token_hash IN (SELECT token_hash FROM email_sessions WHERE account_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 9)').bind(account.id),sessionInsert(account.id,account.auth_version,token)]);
   await revokeSession(request.headers);
   return json({ok:true},200,sessionCookie(token));
  }
  if(a.action==='recover'){
   const recoveryHash=tokenHash(a.recoveryKey.toLowerCase());
   if(!account||account.recovery_hash!==recoveryHash)return json({error:'The email and recovery key do not match.'},401);
   const passwordHash=await hashPassword(a.password),recoveryKey=newToken();
   const updated=await db.prepare('UPDATE email_accounts SET password_hash=?,recovery_hash=?,auth_version=auth_version+1 WHERE id=? AND recovery_hash=? RETURNING auth_version').bind(passwordHash,tokenHash(recoveryKey),account.id,recoveryHash).first<{auth_version:number}>();
   if(!updated)return json({error:'This recovery key has already been used. Try your latest key.'},401);
   const token=newToken();
   await db.batch([db.prepare('DELETE FROM email_sessions WHERE account_id=?').bind(account.id),sessionInsert(account.id,updated.auth_version,token)]);
   await revokeSession(request.headers);
   return json({ok:true,recoveryKey},200,sessionCookie(token));
  }
 }catch{
  // Never log request bodies, passwords, cookies or recovery keys.
  console.error('Account operation failed');
  return json({error:'Account access is temporarily unavailable. Please try again.'},503);
 }
}
