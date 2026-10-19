'use client';
import {useLayoutEffect,useRef} from 'react';

export function animateSection(element:HTMLElement,preference:MediaQueryList){
 if(preference.matches||document.documentElement.dataset.motion==='reduced'||typeof element.animate!=='function')return ()=>{};
 const animation=element.animate([
  {opacity:0.25,transform:'translateY(12px)'},
  {opacity:1,transform:'translateY(0)'}
 ],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
 const stop=()=>animation.cancel();
 preference.addEventListener('change',stop);
 window.addEventListener('sator:motion-change',stop);
 return ()=>{stop();preference.removeEventListener('change',stop);window.removeEventListener('sator:motion-change',stop);};
}
// Animate existing DOM instead of remounting forms or delaying navigation.
export function useSectionMotion<T extends HTMLElement>(key:string){
 const ref=useRef<T>(null);
 useLayoutEffect(()=>{if(ref.current)return animateSection(ref.current,window.matchMedia('(prefers-reduced-motion: reduce)'));},[key]);
 return ref;
}
