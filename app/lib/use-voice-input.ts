'use client';
import {useEffect,useRef,useState} from 'react';

export function encodeWav(chunks:Float32Array[],sampleRate:number){
 const length=chunks.reduce((n,c)=>n+c.length,0),input=new Float32Array(length);let offset=0;
 for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}
 const count=Math.min(480000,Math.floor(length*16000/sampleRate)),bytes=new ArrayBuffer(44+count*2),view=new DataView(bytes);
 const word=(i:number,value:string)=>{for(let j=0;j<value.length;j++)view.setUint8(i+j,value.charCodeAt(j));};
 word(0,'RIFF');view.setUint32(4,36+count*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){const begin=Math.floor(i*sampleRate/16000),end=Math.max(begin+1,Math.floor((i+1)*sampleRate/16000));let sum=0;for(let j=begin;j<end&&j<length;j++)sum+=input[j];const value=Math.max(-1,Math.min(1,sum/(end-begin)));view.setInt16(44+i*2,value*(value<0?32768:32767),true);}
 return new Blob([bytes],{type:'audio/wav'});
}
export function useVoiceInput(onText:(text:string)=>void,onError:(message:string)=>void){
 const [listening,setListening]=useState(false),[transcribing,setTranscribing]=useState(false),[supported,setSupported]=useState(false);
 const callback=useRef({onText,onError});callback.current={onText,onError};
 const state=useRef<{stream:MediaStream;context:AudioContext;node:AudioWorkletNode;source:MediaStreamAudioSourceNode;chunks:Float32Array[];size:number;language:string;timer:ReturnType<typeof setTimeout>}|null>(null);
 const generation=useRef(0),pending=useRef(false),request=useRef<AbortController|null>(null),alive=useRef(true);
 function cancel(){generation.current++;pending.current=false;request.current?.abort();const s=state.current;state.current=null;if(s){clearTimeout(s.timer);s.node.port.onmessage=null;s.stream.getTracks().forEach(t=>t.stop());s.source.disconnect();s.node.disconnect();void s.context.close();}if(alive.current){setListening(false);setTranscribing(false);}}
 async function stop(){const s=state.current;if(!s)return;state.current=null;clearTimeout(s.timer);s.node.port.onmessage=null;s.stream.getTracks().forEach(t=>t.stop());s.source.disconnect();s.node.disconnect();void s.context.close();setListening(false);setTranscribing(true);const id=generation.current,c=new AbortController();request.current=c;
  try{const audio=encodeWav(s.chunks,s.context.sampleRate);const response=await fetch('/api/transcribe?language='+encodeURIComponent(s.language),{method:'POST',headers:{'Content-Type':'audio/wav','X-Sator-Speech-Consent':'true'},body:audio,signal:AbortSignal.any([c.signal,AbortSignal.timeout(50000)])});const data=await response.json() as {text?:string;error?:string};if(!response.ok)throw new Error(data.error||'Transcription failed.');if(alive.current&&id===generation.current){if(data.text)callback.current.onText(data.text);else callback.current.onError('No speech was detected. Please try again.');}}
  catch(e){if(alive.current&&id===generation.current&&!c.signal.aborted)callback.current.onError(e instanceof Error?e.message:'Unable to transcribe.');}finally{if(alive.current&&id===generation.current)setTranscribing(false);}
 }
 async function start(language:string){if(pending.current||state.current||transcribing)return;pending.current=true;const id=++generation.current;let stream:MediaStream|null=null,context:AudioContext|null=null;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});if(id!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}context=new AudioContext();await context.audioWorklet.addModule('/audio/pcm-capture.js');await context.resume();if(id!==generation.current){stream.getTracks().forEach(t=>t.stop());await context.close();return;}const source=context.createMediaStreamSource(stream),node=new AudioWorkletNode(context,'sator-pcm-capture');const s={stream,context,node,source,chunks:[] as Float32Array[],size:0,language,timer:setTimeout(()=>void stop(),30000)};state.current=s;node.port.onmessage=e=>{if(state.current!==s)return;const chunk=e.data as Float32Array;if(s.size+chunk.length<=s.context.sampleRate*30){s.chunks.push(chunk);s.size+=chunk.length;}};source.connect(node);node.connect(context.destination);setListening(true);}
  catch{stream?.getTracks().forEach(t=>t.stop());if(context&&context.state!=='closed')void context.close();if(alive.current&&id===generation.current)callback.current.onError('Microphone access failed. Use HTTPS and allow microphone access, or type your words.');}finally{if(id===generation.current)pending.current=false;}
 }
 useEffect(()=>{alive.current=true;setSupported(!!navigator.mediaDevices?.getUserMedia&&typeof AudioWorkletNode!=='undefined');const hide=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hide);return()=>{alive.current=false;cancel();document.removeEventListener('visibilitychange',hide);};},[]);
 return {listening,transcribing,supported,start,stop,cancel};
}
