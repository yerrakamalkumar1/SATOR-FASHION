'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,ArrowUpRight,Check,Copy,Eye,EyeOff,KeyRound,LoaderCircle,LockKeyhole,LogOut,X} from 'lucide-react';
import {rememberOpeningForSignIn} from './OpeningExperience';

type Mode='signin'|'signup'|'recover';
export default function AccountAccess({onAuthenticated}:{onAuthenticated:()=>void}){
 const [mode,setMode]=useState<Mode|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [showPassword,setShowPassword]=useState(false),[recoveryKey,setRecoveryKey]=useState(''),[copied,setCopied]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(mode){dialog.current?.showModal();}else dialog.current?.close();},[mode]);
 function choose(next:Mode){setError('');setShowPassword(false);setMode(next);}
 function close(){if(busy)return;if(recoveryKey){setRecoveryKey('');setMode(null);onAuthenticated();}else setMode(null);}
 async function ensureSession(){
  const response=await fetch('/api/session',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});
  const data=await response.json() as {user:{id:string}|null};
  if(!response.ok||!data.user?.id?.startsWith('email_'))throw new Error('Your browser did not keep the sign-in session. Open ŚATOR in its own tab and allow cookies, then sign in again.');
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!mode)return;setBusy(true);setError('');
  const fields=new FormData(event.currentTarget);
  try{
   const response=await fetch('/api/auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,name:fields.get('name'),email:fields.get('email'),password:fields.get('password'),phone:fields.get('phone')||'',recoveryKey:fields.get('recoveryKey')}),signal:AbortSignal.timeout(20000)});
   const result=await response.json() as {error?:string;recoveryKey?:string};if(!response.ok)throw new Error(result.error||'Please try again.');
   if(result.recoveryKey){setRecoveryKey(result.recoveryKey);setCopied(false);}
   else{await ensureSession();setMode(null);onAuthenticated();}
  }catch(error){setError(error instanceof Error?error.message:'Unable to connect. Please try again.');}finally{setBusy(false);}
 }
 async function continueToPortals(){setBusy(true);setError('');try{await ensureSession();setRecoveryKey('');setMode(null);onAuthenticated();}catch(error){setError(error instanceof Error?error.message:'Please retry signing in.');}finally{setBusy(false);}}
 return <>
  <div className="account-welcome-actions"><button className="entry-button entry-primary" type="button" onClick={()=>choose('signup')}>Sign up<ArrowRight size={18}/></button><button className="entry-button entry-secondary" type="button" onClick={()=>choose('signin')}>Sign in<ArrowRight size={18}/></button></div>
  <p className="account-welcome-note"><LockKeyhole size={13}/>Your email. Your password. Your world.</p>
  <dialog ref={dialog} className="account-dialog" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
   {mode&&<div className="account-dialog-inner"><header><span>ŚATOR</span><button type="button" onClick={close} disabled={busy} aria-label="Close account form"><X size={21}/></button></header>
    {recoveryKey?<section className="account-recovery-success"><div className="account-key-icon"><KeyRound size={25}/></div><span className="entry-kicker">{mode==='signup'?'YOUR ACCOUNT IS READY':'YOUR PASSWORD IS UPDATED'}</span><h2>Keep a way<br/>back in.</h2><p>Save this private recovery key in your password manager. You can use it to reset your password if you forget it.</p><code>{recoveryKey}</code><button type="button" className="entry-button entry-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(recoveryKey);setCopied(true);}catch{setError('Select and copy the key above to save it.');}}}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Recovery key copied':'Copy recovery key'}</button><small>{mode==='recover'?'This replaces your old key. ':''}This key is shown only once. Keep it private.</small>{error&&<p className="account-error" role="alert">{error}</p>}<button type="button" className="entry-button entry-primary" disabled={busy} onClick={continueToPortals}>{busy?<LoaderCircle size={17} className="spin"/>:<>Continue to Buy / Design<ArrowRight size={18}/></>}</button></section>:<>
    <div className="account-form-title"><span className="entry-kicker">{mode==='signup'?'YOUR NEXT CHAPTER':'A SPACE THAT’S YOURS'}</span><h2>{mode==='signup'?'Make yourself at home.':mode==='recover'?'Find your way back.':'Welcome back.'}</h2><p>{mode==='signup'?'Create your account, then choose Buy or Design.':mode==='recover'?'Use the recovery key you saved when creating your account.':'Sign in with your ŚATOR email and password.'}</p></div>
    <form key={mode} className="account-form" onSubmit={submit}>
     {mode==='signup'&&<label>Your name<input autoFocus name="name" autoComplete="name" required minLength={2} maxLength={60} placeholder="What should we call you?" disabled={busy}/></label>}
     <label>Email<input autoFocus={mode!=='signup'} name="email" type="email" autoComplete="username" inputMode="email" required maxLength={254} placeholder="you@example.com" disabled={busy}/></label>
     {mode==='recover'&&<label>Recovery key<input name="recoveryKey" autoComplete="off" spellCheck={false} required minLength={64} maxLength={64} placeholder="Your 64-character recovery key" disabled={busy}/></label>}
     <label>{mode==='recover'?'New password':'Password'}<span className="account-password"><input name="password" type={showPassword?'text':'password'} autoComplete={mode==='signin'?'current-password':'new-password'} required minLength={mode==='signin'?1:12} maxLength={128} placeholder={mode==='signin'?'Enter your password':'At least 12 characters'} aria-describedby={mode!=='signin'?'password-hint':undefined} disabled={busy}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>
     {mode!=='signin'&&<small id="password-hint">A few memorable words make a strong password.</small>}
     {mode==='signup'&&<label>Phone number <span className="account-optional">Optional</span><input name="phone" type="tel" autoComplete="tel" maxLength={25} placeholder="+91 98765 43210" disabled={busy}/><small>For your contact details. No OTP is needed to join.</small></label>}
     {mode==='signin'&&<button className="account-forgot" type="button" disabled={busy} onClick={()=>choose('recover')}>Forgot your password?</button>}
     {error&&<p className="account-error" role="alert">{error}</p>}
     <button type="submit" className="entry-button entry-primary" disabled={busy}>{busy?<><LoaderCircle size={17} className="spin"/>{mode==='signup'?'Creating your account…':'Please wait…'}</>:<>{mode==='signup'?'Create account':mode==='recover'?'Reset password':'Sign in'}<ArrowRight size={18}/></>}</button>
    </form>
    {mode==='signin'&&process.env.NEXT_PUBLIC_SATOR_SELF_HOSTED!=='true'&&<><div className="account-divider"><span>OR</span></div><a className="account-provider" href="/signin-with-chatgpt?return_to=/" target="_top" onClick={rememberOpeningForSignIn}>Continue with ChatGPT<ArrowUpRight size={16}/></a><p className="account-provider-help">For members who joined with ChatGPT.</p></>}
    {mode==='recover'&&<p className="account-recovery-help">Use your saved recovery key. Email and SMS recovery aren’t available yet.</p>}
    <p className="account-switch">{mode==='signup'?'Already have an account?':mode==='signin'?'New to ŚATOR?':'Remember your password?'} <button type="button" disabled={busy} onClick={()=>choose(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Sign up':'Sign in'}</button></p>
    </>}
   </div>}
  </dialog>
 </>;
}

export function SignOutButton({className='',icon=false}:{className?:string;icon?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function signOut(){if(busy)return;setBusy(true);setError('');try{
  const r=await fetch('/api/auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Sign-out failed. Please retry.');
  const result=await r.json() as {providerSignOut?:boolean};
  if(result.providerSignOut){const link=document.createElement('a');link.href='/signout-with-chatgpt?return_to=/';link.target='_top';document.body.appendChild(link);link.click();link.remove();}
  else window.location.assign('/');
 }catch(error){setError(error instanceof Error?error.message:'Please retry signing out.');setBusy(false);}}
 return <span className={'account-signout '+className}><button type="button" disabled={busy} onClick={signOut}>{busy?<LoaderCircle size={15} className="spin"/>:icon?<LogOut size={15}/>:null}{busy?'Signing out…':'Sign out'}</button>{error&&<span role="alert">{error}</span>}</span>;
}
