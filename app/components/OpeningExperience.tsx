'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,RotateCcw,Volume2,VolumeX} from 'lucide-react';

const AUTH_RETURN_KEY='sator-opening-auth-return';
const SOUND_KEY='sator-opening-sound';
const OpeningContext=createContext({sound:true,blocked:false,replay:()=>{},toggleSound:()=>{}});

export function rememberOpeningForSignIn(){
 try{sessionStorage.setItem(AUTH_RETURN_KEY,String(Date.now()));}catch{}
}

export function OpeningControls(){
 const {sound,blocked,replay,toggleSound}=useContext(OpeningContext);
 return <div className="opening-controls"><button type="button" onClick={replay} title="Replay opening intro"><RotateCcw size={15}/><span>Replay intro</span></button><button type="button" onClick={toggleSound} aria-label={blocked&&sound?'Play welcome bell':sound?'Mute welcome bell':'Enable welcome bell'} title={blocked&&sound?'Play welcome bell':sound?'Mute welcome bell':'Enable welcome bell'}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}<span>{blocked&&sound?'Play bell':sound?'Sound on':'Sound off'}</span></button></div>;
}

export default function OpeningExperience({children}:{children:ReactNode}){
 const [phase,setPhase]=useState<'intro'|'opening'|'done'>('intro');
 const [sound,setSound]=useState(true),[blocked,setBlocked]=useState(false);
 const [reducedMotion,setReducedMotion]=useState(false);
 const soundRef=useRef(true),chimeOnExit=useRef(true),audioRef=useRef<AudioContext|null>(null);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const contentRef=useRef<HTMLDivElement>(null),restoreFocus=useRef<HTMLElement|null>(null);

 function stopAudio(){
  if(closeTimer.current)clearTimeout(closeTimer.current);
  closeTimer.current=null;
  const audio=audioRef.current;audioRef.current=null;
  if(audio&&audio.state!=='closed')void audio.close().catch(()=>{});
 }
 function prepareAudio(){
  try{
   if(!audioRef.current||audioRef.current.state==='closed'){
    const Audio=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Audio)return null;
    audioRef.current=new Audio();
   }
   // Called directly inside the sound button gesture to unlock browser audio.
   if(audioRef.current.state==='suspended')void audioRef.current.resume().catch(()=>{});
   return audioRef.current;
  }catch{return null;}
 }
 function playBell(){
  if(!soundRef.current)return;
  const audio=audioRef.current||prepareAudio();
  if(!audio||audio.state!=='running'){setBlocked(true);stopAudio();return;}
  setBlocked(false);
  if(closeTimer.current)clearTimeout(closeTimer.current);
  const start=audio.currentTime+.015;
  const master=audio.createGain();master.gain.value=.48;master.connect(audio.destination);
  // Inharmonic partials give one restrained, rounded brass-bell strike.
  [[523.25,.17,2.8],[1047.8,.07,2.2],[1412.8,.035,1.6],[2166.3,.012,.85]].forEach(([frequency,level,decay])=>{
   const oscillator=audio.createOscillator(),envelope=audio.createGain();
   oscillator.type='sine';oscillator.frequency.value=frequency;
   envelope.gain.setValueAtTime(.0001,start);
   envelope.gain.exponentialRampToValueAtTime(level,start+.006);
   envelope.gain.exponentialRampToValueAtTime(.0001,start+decay);
   oscillator.connect(envelope);envelope.connect(master);
   oscillator.start(start);oscillator.stop(start+decay+.03);
   oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
  });
  closeTimer.current=setTimeout(()=>{master.disconnect();stopAudio();},3100);
 }
 function changeSound(enabled:boolean){
  soundRef.current=enabled;setSound(enabled);
  try{localStorage.setItem(SOUND_KEY,enabled?'on':'off');}catch{}
  if(!enabled){setBlocked(false);stopAudio();}
 }
 function toggleSound(){
  if(blocked&&soundRef.current){
   const audio=prepareAudio();
   if(audio)void audio.resume().then(playBell).catch(()=>setBlocked(true));
   return;
  }
  const enabled=!soundRef.current;changeSound(enabled);
  if(enabled){const audio=prepareAudio();if(phase==='done'&&audio)void audio.resume().then(playBell).catch(()=>setBlocked(true));}
 }
 function replay(){
  restoreFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  stopAudio();setBlocked(false);chimeOnExit.current=true;
  if(soundRef.current)prepareAudio();
  setPhase('intro');
 }
 function enter(){
  chimeOnExit.current=true;
  if(soundRef.current)prepareAudio();
  setPhase('opening');
 }
 function skip(){chimeOnExit.current=false;stopAudio();setPhase('done');}

 useEffect(()=>{
  try{const enabled=localStorage.getItem(SOUND_KEY)!=='off';soundRef.current=enabled;setSound(enabled);}catch{}
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateMotion=()=>setReducedMotion(media.matches);updateMotion();
  media.addEventListener('change',updateMotion);
  try{
   const returning=Number(sessionStorage.getItem(AUTH_RETURN_KEY));sessionStorage.removeItem(AUTH_RETURN_KEY);
   if(returning>0&&Date.now()-returning<10*60*1000)setPhase('done');
  }catch{}
  return()=>{media.removeEventListener('change',updateMotion);stopAudio();};
 },[]);

 useEffect(()=>{
  if(phase==='done')return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')skip();};
  document.addEventListener('keydown',onKey);
  const timer=setTimeout(()=>{
   if(phase==='intro')setPhase('opening');
   else{setPhase('done');if(chimeOnExit.current)playBell();}
  },phase==='intro'?(reducedMotion?1200:2500):(reducedMotion?160:850));
  return()=>{clearTimeout(timer);document.body.style.overflow=previous;document.removeEventListener('keydown',onKey);};
 },[phase,reducedMotion]);

 useEffect(()=>{
  if(phase!=='done')return;
  if(restoreFocus.current?.isConnected){restoreFocus.current.focus({preventScroll:true});restoreFocus.current=null;}
  else contentRef.current?.focus({preventScroll:true});
 },[phase]);

 return <OpeningContext.Provider value={{sound,blocked,replay,toggleSound}}>
  <div ref={contentRef} className="opening-content" tabIndex={-1} hidden={phase==='intro'} inert={phase!=='done'} aria-hidden={phase!=='done'}>{children}</div>
  {phase!=='done'&&<div className={'opening-stage '+(phase==='opening'?'is-opening':'')} role="dialog" aria-modal="true" aria-label="Welcome to ŚATOR">
   <div className="opening-glow" aria-hidden="true"/>
   <header className="opening-top"><span>INDEPENDENT BY DESIGN</span><button type="button" onClick={toggleSound} aria-label={sound?'Mute welcome bell':'Enable welcome bell'}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}<span>{sound?'Sound on':'Sound off'}</span></button></header>
   <div className="opening-signature"><h1>ŚATOR</h1><div className="opening-rule" aria-hidden="true"/><p>WEAR YOUR IMAGINATION</p></div>
   <footer className="opening-bottom"><button type="button" className="opening-enter" onClick={enter}>{sound?'Enter with sound':'Enter ŚATOR'}<ArrowRight size={15}/></button><span>{sound?'A quiet beginning. A world of possibility.':'DISCOVER. CREATE. BELONG.'}</span><button type="button" className="opening-skip" onClick={skip}>Skip intro</button></footer>
   <div className="opening-wash" aria-hidden="true"/>
  </div>}
 </OpeningContext.Provider>;
}
