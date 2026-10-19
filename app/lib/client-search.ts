import type {SearchLanguage} from '../search-languages';
export type TranslationResult={translatedText:string;searchQuery:string;mode:'on-device'|'ai'|'original'};
type TranslatorInstance={translate:(text:string,options?:{signal:AbortSignal})=>Promise<string>;destroy:()=>void};
type TranslatorAPI={availability:(options:{sourceLanguage:string;targetLanguage:string})=>Promise<string>;create:(options:{sourceLanguage:string;targetLanguage:string;signal:AbortSignal;monitor?:(monitor:{addEventListener:(event:string,cb:(event:{loaded:number})=>void)=>void})=>void})=>Promise<TranslatorInstance>};

export async function translateOnDevice(text:string,source:SearchLanguage,target:SearchLanguage,signal:AbortSignal,onProgress:(text:string)=>void):Promise<TranslationResult|null>{
 const api=(globalThis as typeof globalThis&{Translator?:TranslatorAPI}).Translator;
 if(source===target&&source==='en')return {translatedText:text,searchQuery:text,mode:'original'};
 if(!api)return null;
 const targets=[...new Set([target,'en'])].filter(t=>t!==source),instances=new Map<string,TranslatorInstance>();
 try{
  const availability=await Promise.all(targets.map(targetLanguage=>api.availability({sourceLanguage:source,targetLanguage})));
  signal.throwIfAborted();if(availability.some(a=>a==='unavailable'))return null;
  // Create all needed translators together while this explicit click has user activation.
  const created=await Promise.allSettled(targets.map(async(targetLanguage,i)=>{
   if(availability[i]!=='available')onProgress('Downloading the browser’s language model…');
   const instance=await api.create({sourceLanguage:source,targetLanguage,signal,monitor:m=>m.addEventListener('downloadprogress',e=>onProgress('Preparing translation · '+Math.round(e.loaded*100)+'%'))});
   if(signal.aborted){instance.destroy();signal.throwIfAborted();}instances.set(targetLanguage,instance);
  }));
  const failed=created.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  const translatedText=target===source?text:await instances.get(target)!.translate(text,{signal});
  const searchQuery=source==='en'?text:target==='en'?translatedText:await instances.get('en')!.translate(text,{signal});
  signal.throwIfAborted();if(!translatedText.trim()||!searchQuery.trim()||translatedText.length>3000||searchQuery.length>1500)return null;
  return {translatedText,searchQuery,mode:'on-device'};
 }finally{for(const instance of instances.values())instance.destroy();}
}
export async function prepareSearchImage(file:File):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12000000)throw new Error('Choose a JPEG, PNG or WebP photo under 12 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('This browser could not prepare the photo.');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('This photo could not be prepared.')),'image/jpeg',0.86));
  if(blob.size>5000000)throw new Error('Choose a smaller photo.');
  // Re-encoding strips original metadata and bounds upload dimensions.
  return new File([blob],'search-photo.jpg',{type:'image/jpeg'});
 }finally{bitmap.close();}
}
