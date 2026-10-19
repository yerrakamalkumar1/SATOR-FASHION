'use client';
import {useEffect} from 'react';
import {defaultPreferences,type MemberPreferences} from '../member-model';
export type Appearance=Pick<MemberPreferences,'theme'|'textSize'|'density'|'motion'>;
export const appearanceDefaults:Appearance={theme:'system',textSize:'standard',density:'comfortable',motion:'system'};
export function appearanceOf(value:Partial<MemberPreferences>):Appearance{return {
 theme:['light','dark','system'].includes(value.theme||'')?value.theme!:appearanceDefaults.theme,
 textSize:['standard','large','extra-large'].includes(value.textSize||'')?value.textSize!:appearanceDefaults.textSize,
 density:value.density==='compact'?'compact':'comfortable',motion:value.motion==='reduced'?'reduced':'system'
};}
export function applyAppearance(value:Appearance){
 const root=document.documentElement;root.dataset.theme=value.theme==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value.theme;
 root.dataset.textSize=value.textSize;root.dataset.density=value.density;root.dataset.motion=value.motion;
 root.style.setProperty('--ui-text-scale',value.textSize==='extra-large'?'1.24':value.textSize==='large'?'1.12':'1');
 window.dispatchEvent(new Event('sator:motion-change'));
}
export function rememberAppearance(uid:string,value:Partial<MemberPreferences>){const preferences=appearanceOf(value);try{localStorage.setItem('sator:appearance:'+uid,JSON.stringify(preferences));}catch{}applyAppearance(preferences);window.dispatchEvent(new CustomEvent('sator:appearance',{detail:{uid,preferences}}));}
export function useAppearance(uid:string|null){useEffect(()=>{
 let current=appearanceDefaults,active=true,changed=false;const controller=new AbortController(),system=window.matchMedia('(prefers-color-scheme: dark)');
 if(uid){try{const saved=localStorage.getItem('sator:appearance:'+uid);if(saved)current=appearanceOf(JSON.parse(saved));}catch{}}
 applyAppearance(current);
 const onSystem=()=>{if(current.theme==='system')applyAppearance(current);};
 const onUpdated=(event:Event)=>{const e=event as CustomEvent<{uid:string;preferences:Appearance}>;if(e.detail.uid===uid){changed=true;current=e.detail.preferences;applyAppearance(current);}};
 const onStorage=(event:StorageEvent)=>{if(uid&&event.key==='sator:appearance:'+uid){try{current=appearanceOf(event.newValue?JSON.parse(event.newValue):defaultPreferences);changed=true;applyAppearance(current);}catch{}}};
 system.addEventListener('change',onSystem);window.addEventListener('sator:appearance',onUpdated);window.addEventListener('storage',onStorage);
 if(uid)fetch('/api/member',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)return;const data=await r.json() as {preferences:MemberPreferences};if(active&&!changed){current=appearanceOf(data.preferences);rememberAppearance(uid,current);}}).catch(()=>{});
 return()=>{active=false;controller.abort();system.removeEventListener('change',onSystem);window.removeEventListener('sator:appearance',onUpdated);window.removeEventListener('storage',onStorage);};
 },[uid]);}
