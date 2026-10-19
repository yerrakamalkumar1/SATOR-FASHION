import {headers} from 'next/headers';
import {getChatGPTUser,type ChatGPTUser} from './chatgpt-auth';
import {findEmailSession,readSessionToken} from './lib/email-auth';

// An opaque, database-validated cookie or the platform's trusted identity only.
// Never link identities by an unverified email address.
export async function getAppUser():Promise<ChatGPTUser|null>{
 const h=await headers();
 if(readSessionToken(h)!==null){
  const account=await findEmailSession(h);
  return account?{userId:account.id,email:account.email,displayName:account.name,fullName:account.name}:null;
 }
 return getChatGPTUser();
}
