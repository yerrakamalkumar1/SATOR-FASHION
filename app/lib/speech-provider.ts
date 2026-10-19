import {env} from 'cloudflare:workers';
import {serviceURL} from './service-url';
export function speechConfiguration(){
 const cfg=env as typeof env&{SPEECH_BASE_URL?:string;SPEECH_API_KEY?:string;AI_DISABLED?:string};
 if(cfg.AI_DISABLED==='true')return null;
 const service=serviceURL(cfg.SPEECH_BASE_URL);
 if(!service||(!service.privateAllowed&&!cfg.SPEECH_API_KEY))return null;
 return {...service,key:cfg.SPEECH_API_KEY};
}
export async function transcribeWav(bytes:Uint8Array,language:string,signal:AbortSignal){
 const cfg=speechConfiguration();if(!cfg)throw new Error('Speech not configured');
 const form=new FormData();form.append('file',new Blob([new Uint8Array(bytes)],{type:'audio/wav'}),'speech.wav');
 form.append('language',language);form.append('response_format','json');form.append('temperature','0');
 const response=await fetch(cfg.url+'/inference',{method:'POST',redirect:'error',headers:cfg.key?{Authorization:'Bearer '+cfg.key}:{},body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(45000)])});
 if(!response.ok||!response.body)throw new Error('Speech service unavailable');
 const reader=response.body.getReader();let text='';const decoder=new TextDecoder();let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16000){await reader.cancel();throw new Error('Speech response too large');}text+=decoder.decode(part.value,{stream:true});}}finally{reader.releaseLock();}
 text+=decoder.decode();const data=JSON.parse(text) as {text?:unknown};
 if(typeof data.text!=='string'||data.text.length>4000)throw new Error('Invalid speech response');
 return data.text.trim().slice(0,1500);
}
