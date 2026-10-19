import {getAppUser} from '../../auth';
import {allowWrite,originOK} from '../../lib/security';
import {noStore} from '../../lib/community';
import {speechConfiguration,transcribeWav} from '../../lib/speech-provider';
import {reserveAI} from '../../lib/ai-provider';
import {searchLanguages} from '../../search-languages';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  if(!originOK(request))return noStore({error:'Invalid origin.'},403);
  const user=await getAppUser();if(!user)return noStore({error:'Sign in required.'},401);
  if(request.headers.get('X-Sator-Speech-Consent')!=='true')return noStore({error:'Allow speech processing before recording.'},400);
  const language=new URL(request.url).searchParams.get('language')||'en';
  if(!searchLanguages.some(l=>l.code===language)||request.headers.get('content-type')!=='audio/wav')return noStore({error:'Use a supported language and WAV recording.'},400);
  if(!speechConfiguration())return noStore({error:'Voice transcription is not connected yet.',code:'SPEECH_NOT_CONFIGURED'},503);
  if(!await allowWrite(user.userId,'speech',3))return noStore({error:'Please wait before another recording.'},429);
  const reader=request.body?.getReader();if(!reader)return noStore({error:'Empty audio.'},400);
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>960044){await reader.cancel();return noStore({error:'Record up to 30 seconds.'},413);}chunks.push(part.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const view=new DataView(bytes.buffer),str=(start:number,length:number)=>new TextDecoder().decode(bytes.slice(start,start+length));
  // Our recorder sends a canonical, mono, PCM16, 16 kHz WAV. Reject arbitrary
  // containers rather than handing unbounded/untrusted formats to a decoder.
  if(total<3244||str(0,4)!=='RIFF'||str(8,4)!=='WAVE'||str(12,4)!=='fmt '||str(36,4)!=='data'||view.getUint32(4,true)!==total-8||view.getUint32(16,true)!==16||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||view.getUint32(24,true)!==16000||view.getUint32(28,true)!==32000||view.getUint16(32,true)!==2||view.getUint16(34,true)!==16||view.getUint32(40,true)!==total-44||(total-44)%2)return noStore({error:'Invalid or too-short recording.'},400);
  await reserveAI(user.userId);
  const text=await transcribeWav(bytes,language,request.signal);
  return noStore({text,language,provider:'whisper.cpp',audioStored:false});
 }catch{return noStore({error:'Transcription could not finish. Please retry or type your words.',code:'SPEECH_UNAVAILABLE'},503);}
}
