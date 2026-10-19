'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,ArrowLeft,ShoppingBag,Palette,Store,Volume2,VolumeX,LoaderCircle,Check,ShieldCheck,ArrowUpRight,RotateCcw,X,LogOut} from 'lucide-react';
import type {PortalData,PortalRole} from '../portal-model';

const roles=[
 {id:'customer' as const,name:'Customer',icon:ShoppingBag,tag:'DISCOVER YOUR DIFFERENT',title:'Find it. Make it. Wear it.',description:'Discover independent fashion, save what inspires you, and make a look your own.'},
 {id:'creator' as const,name:'Creator',icon:Palette,tag:'MADE OF ORIGINAL IDEAS',title:'Your imagination belongs here.',description:'A canvas for your designs. A community for your ideas. A place to make your mark.'},
 {id:'brand' as const,name:'Startup',icon:Store,tag:'INDEPENDENT LOOKS GOOD ON YOU',title:'Build a label. Find your people.',description:'Share your collection, reach the right customers, and give your brand a home.'},
];
type Props={loading:boolean;error:string;user:{id:string;name:string;email?:string}|null;portal:PortalData;onEnter:(r:PortalRole,guest?:boolean)=>void;onSave:(a:Record<string,unknown>)=>Promise<unknown>;onRetry:()=>void;skipIntro?:boolean};
type Stage='intro'|'welcome'|'auth';

export default function PortalGate({loading,error,user,portal,onEnter,onSave,onRetry,skipIntro=false}:Props){
 const [stage,setStage]=useState<Stage>(skipIntro?'welcome':'intro');
 const [sound,setSound]=useState(true),[selected,setSelected]=useState<PortalRole>('customer');
 const [mode,setMode]=useState<'login'|'signup'>('signup'),[busy,setBusy]=useState(false),[localError,setLocalError]=useState('');
 const played=useRef(false),audio=useRef<AudioContext|null>(null),heading=useRef<HTMLHeadingElement>(null),initialized=useRef(false);
 const role=roles.find(r=>r.id===selected)!,account=portal.accounts.find(a=>a.role===selected);

 useEffect(()=>{
  try{setSound(localStorage.getItem('sator-launch-sound')!=='off');}catch{}
  const query=new URLSearchParams(window.location.search),p=query.get('portal');
  if(roles.some(r=>r.id===p)){
   setSelected(p as PortalRole);setMode(query.get('mode')==='login'?'login':'signup');setStage('auth');
  }
  initialized.current=true;
  return()=>{void audio.current?.close().catch(()=>{});};
 },[]);
 useEffect(()=>{
  if(stage!=='intro')return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timer=window.setTimeout(()=>setStage('welcome'),reduced?500:2900);
  return()=>window.clearTimeout(timer);
 },[stage]);
 useEffect(()=>{if(initialized.current&&stage==='auth')heading.current?.focus();},[stage]);

 function bell(force=false){
  if(!sound||played.current&&!force)return;
  try{
   const AudioCtx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
   const ctx=audio.current?.state!=='closed'&&audio.current?audio.current:new AudioCtx();audio.current=ctx;
   const ring=()=>{
    const t=ctx.currentTime;
    // A single struck bell with inharmonic partials and a naturally decaying tail.
    [[523.25,.12,2.5],[1049.1,.065,2],[1433.7,.026,1.2],[2130,.012,.8]].forEach(([frequency,level,decay])=>{
     const oscillator=ctx.createOscillator(),gain=ctx.createGain();
     oscillator.type='sine';oscillator.frequency.value=frequency;
     gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+.009);
     gain.gain.exponentialRampToValueAtTime(.0001,t+decay);
     oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(t+decay+.03);
    });
    played.current=true;
   };
   if(ctx.state==='suspended')void ctx.resume().then(ring).catch(()=>{});else ring();
  }catch{}
 }
 function toggleSound(){
  const next=!sound;setSound(next);
  try{localStorage.setItem('sator-launch-sound',next?'on':'off');}catch{}
  if(!next&&audio.current){void audio.current.close().catch(()=>{});audio.current=null;}
 }
 function openAuth(next:'login'|'signup'){bell();setMode(next);setLocalError('');setStage('auth');}
 function enter(){bell();onEnter(selected);}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setLocalError('');
  const f=new FormData(e.currentTarget);
  try{
   const result=await onSave({action:'onboard',role:selected,name:f.get('name'),email:f.get('email'),city:f.get('city'),bio:f.get('bio')||'',brandName:f.get('brandName')||'',website:f.get('website')||'',specialty:f.get('specialty')||'',interests:f.get('interests')||''});
   if(result)onEnter(selected);else setLocalError('We couldn’t save your profile. Check your connection and details, then try again.');
  }catch{setLocalError('We couldn’t save your profile. Please try again.');}finally{setBusy(false);}
 }
 const soundControl=<button className="entry-sound" onClick={toggleSound} aria-pressed={sound} aria-label={sound?'Mute opening bell':'Enable opening bell'}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>Sound {sound?'on':'off'}</span></button>;

 if(stage==='intro')return <main className="sator-intro" aria-label="Welcome to ŚATOR">
  <div className="intro-top"><span>INDEPENDENT BY DESIGN</span>{soundControl}</div>
  <div className="intro-center"><span className="intro-monogram" aria-hidden="true">Ś</span><h1 className="intro-wordmark">ŚATOR</h1><p className="intro-tagline">WEAR YOUR IMAGINATION</p><div className="intro-progress" aria-hidden="true"><span/></div><div className="intro-loading" role="status"><LoaderCircle size={14}/><span>Opening your world</span></div></div>
  <div className="intro-bottom"><span>FASHION. CREATED BY YOU.</span><button onClick={()=>{bell();setStage('welcome');}}>{sound?'Enter with sound':'Skip intro'}<ArrowRight size={15}/></button></div>
 </main>;

 return <main className={'sator-entry '+(stage==='auth'?'auth-is-open':'')}>
  <header className="entry-header"><button className="entry-logo" aria-label="ŚATOR welcome" onClick={()=>{setStage('welcome');setLocalError('');}}>ŚATOR<span>WEAR YOUR IMAGINATION</span></button><div className="entry-header-actions"><button className="entry-replay" aria-label="Replay opening intro" onClick={()=>{played.current=false;bell(true);setStage('intro');}}><RotateCcw size={15}/><span>Replay intro</span></button>{soundControl}</div></header>
  <div className="entry-layout">
   <section className="entry-visual" aria-label="Independent fashion inspiration"><div className="entry-artwork"><img src="/images/sator-editorial.png" alt="A collage of independent streetwear, cream sneakers, knit textures, and original fashion looks" fetchPriority="high"/><span className="editorial-caption">THE ŚATOR PERSPECTIVE — 01</span></div><div className="entry-art-copy"><span className="entry-kicker">STYLE HAS NO SINGLE POINT OF VIEW.</span><p>Yours is the one<br/>we haven’t seen.</p><span className="entry-art-index">DISCOVER / DESIGN / BELONG</span></div></section>
   <section className="entry-content" aria-label={stage==='auth'?'Account access':'Welcome'}>
    {stage==='welcome'?<div className="welcome-content"><span className="entry-kicker"><span className="entry-dot"/> A WORLD MADE BY YOU</span><h1>Wear your<br/><em>imagination.</em></h1><p className="entry-description">Find your people. Create your signature.<br/>Make fashion feel like you.</p><div className="entry-role-label">I’M HERE AS A</div><RolePicker value={selected} onChange={setSelected}/><p className="entry-role-description">{role.description}</p><div className="welcome-buttons"><button className="entry-button entry-primary" onClick={()=>openAuth('signup')}>Create your account<ArrowUpRight size={19}/></button><button className="entry-button entry-secondary" onClick={()=>openAuth('login')}>Log in<ArrowRight size={18}/></button></div><button className="entry-guest" onClick={()=>{bell();onEnter('customer',true);}}>Just looking? Explore the collection<ArrowRight size={14}/></button><div className="entry-trust"><ShieldCheck size={15}/><span>Secure sign-in. A space that’s yours.</span></div></div>:
    <div className="entry-auth-content"><div className="auth-top"><button className="entry-back" onClick={()=>{setStage('welcome');setLocalError('');}}><ArrowLeft size={17}/>Back</button><span>{role.name.toUpperCase()} PORTAL</span><button className="entry-close" aria-label="Close account access" onClick={()=>setStage('welcome')}><X size={20}/></button></div><div className="entry-auth-tabs" aria-label="Account action"><button className={mode==='login'?'active':''} aria-pressed={mode==='login'} onClick={()=>{setMode('login');setLocalError('');}}>Log in</button><button className={mode==='signup'?'active':''} aria-pressed={mode==='signup'} onClick={()=>{setMode('signup');setLocalError('');}}>Sign up</button></div><h1 ref={heading} tabIndex={-1}>{mode==='login'?'Your world awaits.':user?'Make it yours.':'A little more you.'}</h1><p className="auth-description">{mode==='login'?'Pick up where your inspiration left off.':user?'Tell us a little about yourself to complete your profile.':'One account. A world of creative possibilities.'}</p><RolePicker value={selected} onChange={r=>{setSelected(r);setLocalError('');}} compact/>
     {loading?<div className="auth-loading" role="status"><LoaderCircle className="spin" size={21}/>Checking your secure session…</div>:error?<div className="auth-connection-error" role="alert"><p>{error}</p><button className="entry-button entry-secondary" onClick={onRetry}>Retry connection<RotateCcw size={17}/></button></div>:!user?<div className="entry-auth-connect"><div className="secure-account-symbol"><ShieldCheck size={27}/></div><h2>{mode==='login'?'Welcome back to ŚATOR.':'Your next chapter starts here.'}</h2><p>{mode==='login'?'Sign in securely to open your '+role.name.toLowerCase()+' workspace.':'Start with secure sign-in, then create your '+role.name.toLowerCase()+' profile.'}</p><a className="entry-button entry-primary" target="_top" href={'/signin-with-chatgpt?return_to='+encodeURIComponent('/?portal='+selected+'&mode='+mode)} onClick={()=>bell()}>Continue with ChatGPT<ArrowUpRight size={19}/></a><p className="auth-provider-note"><ShieldCheck size={13}/>Authentication and account recovery are handled by ChatGPT.</p><details className="auth-help"><summary>Need help signing in?</summary><p>Use the account you used when joining ŚATOR. If you can’t access it, use the recovery options on the ChatGPT sign-in page. Your ŚATOR profiles stay linked to that account.</p></details></div>:mode==='login'&&account?<div className="entry-returning"><div className="entry-avatar">{(account.details.brandName||account.details.name).slice(0,1)}</div><span className="session-verified"><Check size={12}/>SIGNED IN</span><h2>{account.details.brandName||account.details.name}</h2><p>Your {role.name.toLowerCase()} workspace is ready.</p><button className="entry-button entry-primary" onClick={enter}>Enter {role.name} portal<ArrowRight size={18}/></button><button className="entry-text-button" onClick={()=>setMode('signup')}>Edit my profile</button><a className="entry-switch-account" target="_top" href="/signout-with-chatgpt?return_to=/"><LogOut size={13}/>Use a different account</a></div>:<form key={selected} className="entry-profile-form" onSubmit={save}>
      {mode==='login'&&!account&&<p className="auth-first-visit">You’re signed in. Create your {role.name.toLowerCase()} profile to enter this portal.</p>}
      <div className="entry-fields-two"><label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="Your name" defaultValue={account?.details.name||user.name||''}/></label><label>City<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} placeholder="Where you’re based" defaultValue={account?.details.city||''}/></label></div>
      <label>Contact email<input type="email" name="email" autoComplete="email" required maxLength={120} placeholder="you@example.com" defaultValue={account?.details.email||user.email||''}/><small>For your profile and order contact. Changing this won’t change your sign-in account.</small></label>
      {selected==='brand'&&<><label>Startup / brand name<input name="brandName" autoComplete="organization" required minLength={2} maxLength={80} placeholder="Your independent label" defaultValue={account?.details.brandName||''}/></label><label>Brand website <span>Optional</span><input type="url" name="website" maxLength={250} placeholder="https://your-brand.com" defaultValue={account?.details.website||''}/></label></>}
      {selected==='creator'&&<><label>Creative specialty<select name="specialty" defaultValue={account?.details.specialty||'Graphic & print design'}><option>Graphic & print design</option><option>Typography</option><option>Illustration</option><option>Streetwear</option><option>Fashion design</option></select></label><label>Portfolio <span>Optional</span><input type="url" name="website" maxLength={250} placeholder="https://your-portfolio.com" defaultValue={account?.details.website||''}/></label></>}
      {selected==='customer'&&<label>Styles you love <span>Optional</span><input name="interests" maxLength={200} placeholder="Streetwear, minimal, oversized…" defaultValue={account?.details.interests||''}/></label>}
      <label>{selected==='brand'?'Your brand story':selected==='creator'?'Your creative story':'A little about you'} <span>Optional</span><textarea name="bio" rows={2} maxLength={300} placeholder="Tell your story in a few words." defaultValue={account?.details.bio||''}/></label>
      {localError&&<p className="entry-error" role="alert">{localError}</p>}
      <button className="entry-button entry-primary" disabled={busy} type="submit">{busy?<><LoaderCircle size={18} className="spin"/>Saving your profile…</>:<>Save & enter {role.name} portal<ArrowRight size={18}/></>}</button><p className="auth-data-note">Your name and bio may appear with your posts. Your contact email stays private to your account and relevant orders.</p><a className="entry-switch-account" target="_top" href="/signout-with-chatgpt?return_to=/"><LogOut size={13}/>Use a different account</a>
     </form>}
    </div>}
   </section>
  </div>
  <footer className="entry-footer"><span>ŚATOR © {new Date().getFullYear()}</span><span>INDEPENDENT MINDS. ORIGINAL FINDS.</span><span>MADE TO BE YOURS <span aria-hidden="true">↗</span></span></footer>
 </main>;
}

function RolePicker({value,onChange,compact=false}:{value:PortalRole;onChange:(v:PortalRole)=>void;compact?:boolean}){
 return <div className={'entry-role-picker '+(compact?'compact':'')} aria-label="Choose your portal">{roles.map(r=><button type="button" key={r.id} aria-pressed={r.id===value} className={r.id===value?'selected':''} onClick={()=>onChange(r.id)}><r.icon size={18}/><span>{r.name}</span>{r.id===value&&<Check size={12} className="role-check"/>}</button>)}</div>;
}
