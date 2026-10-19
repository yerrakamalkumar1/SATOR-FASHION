import {env} from 'cloudflare:workers';
import {dbRaw} from './community';
import {serviceURL} from './service-url';

type Settings={AI_PROVIDER?:string;AI_BASE_URL?:string;AI_API_KEY?:string;AI_MODEL?:string;AI_VISION_MODEL?:string;OPENAI_API_KEY?:string;OPENAI_MODEL?:string;OPENAI_VISION_MODEL?:string;AI_DAILY_USER_LIMIT?:string;AI_DAILY_SITE_LIMIT?:string;AI_DISABLED?:string};
type Message={role:'user'|'assistant'|'developer';content:string};
export class AIUnavailable extends Error{}
function configuration(vision=false){
 const cfg=env as typeof env&Settings;if(cfg.AI_DISABLED==='true')return null;
 if(cfg.AI_PROVIDER==='compatible'){
  const model=vision?cfg.AI_VISION_MODEL:cfg.AI_MODEL;
  const service=serviceURL(cfg.AI_BASE_URL);
  if(!service||!model||(!service.privateAllowed&&!cfg.AI_API_KEY))return null;
  return {provider:'compatible' as const,url:service.url+'/chat/completions',key:cfg.AI_API_KEY||'',model};
 }
 if(cfg.AI_PROVIDER&&cfg.AI_PROVIDER!=='openai')return null;
 const model=vision?cfg.OPENAI_VISION_MODEL:cfg.OPENAI_MODEL;
 return cfg.OPENAI_API_KEY&&model?{provider:'openai' as const,url:'https://api.openai.com/v1/responses',key:cfg.OPENAI_API_KEY,model}:null;
}
export const aiReady=(vision=false)=>!!configuration(vision);
export const aiFingerprint=(vision=false)=>{const c=configuration(vision);return c?[c.provider,c.url,c.model].join('|'):'';};
const bounded=(value:string|undefined,fallback:number,max:number)=>{const n=Number(value);return Number.isInteger(n)&&n>0?Math.min(n,max):fallback;};
export async function reserveAI(uid:string){
 const cfg=env as typeof env&Settings,db=dbRaw(),day=new Date().toISOString().slice(0,10);
 for(const [scope,limit] of [[uid,bounded(cfg.AI_DAILY_USER_LIMIT,30,1000)],['@site',bounded(cfg.AI_DAILY_SITE_LIMIT,500,10000)]] as const){
  const result=await db.prepare('INSERT INTO ai_usage(scope,day,count) VALUES(?,?,1) ON CONFLICT(scope,day) DO UPDATE SET count=count+1 RETURNING count').bind(scope,day).first<{count:number}>();
  if(!result||result.count>limit)throw new AIUnavailable('AI request allowance reached');
 }
 // Only counters and output caches are stored. No image/chat/request-body logging.
 await db.prepare("DELETE FROM ai_usage WHERE day < date('now','-7 days')").run();
}
async function limitedJSON(response:Response){
 if(!response.ok||!response.body)throw new AIUnavailable('Model unavailable');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128000){await reader.cancel();throw new AIUnavailable('Model response too large');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function modelText(input:{instructions:string;messages:Message[];image?:string;schema?:Record<string,unknown>;schemaName?:string}){
 const cfg=configuration(!!input.image);if(!cfg)throw new AIUnavailable('Model not configured');
 const last=input.messages.at(-1),content=input.image?[{type:'input_text',text:last?.content||'Describe visible clothing.'},{type:'input_image',image_url:input.image,detail:'low'}]:null;
 const format=input.schema?{type:'json_schema',name:input.schemaName||'result',strict:true,schema:input.schema}:undefined;
 const body=cfg.provider==='openai'?{
  model:cfg.model,store:false,max_output_tokens:700,instructions:input.instructions,
  input:content?[...input.messages.slice(0,-1),{role:'user',content}]:input.messages,
  ...(format?{text:{format}}:{})
 }:{
  model:cfg.model,max_tokens:700,temperature:0.1,
  messages:[{role:'system',content:input.instructions},...input.messages.map((m,i)=>({role:m.role==='developer'?'system':m.role,content:input.image&&i===input.messages.length-1?[{type:'text',text:m.content},{type:'image_url',image_url:{url:input.image,detail:'low'}}]:m.content}))],
  ...(format?{response_format:{type:'json_schema',json_schema:{name:format.name,strict:true,schema:input.schema}}}:{})
 };
 const response=await fetch(cfg.url,{method:'POST',redirect:'error',headers:{...(cfg.key?{Authorization:'Bearer '+cfg.key}:{}),'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify(body)});
 const data=await limitedJSON(response);
 if(cfg.provider==='openai'&&data.status&&data.status!=='completed')throw new AIUnavailable('Incomplete model response');
 if(cfg.provider==='compatible'&&data.choices?.[0]?.finish_reason!=='stop')throw new AIUnavailable('Incomplete model response');
 const text=cfg.provider==='openai'?data.output?.flatMap((o:{content?:{type:string;text?:string}[]})=>o.content||[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text?:string})=>c.text||'').join('\n'):data.choices?.[0]?.message?.content;
 if(typeof text!=='string'||!text.trim()||text.length>6000)throw new AIUnavailable('Invalid model response');
 return text.trim();
}
