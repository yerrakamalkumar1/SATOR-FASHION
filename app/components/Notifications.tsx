'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,Heart,MessageCircle,UserPlus,Palette,CheckCheck,ArrowUpRight,X,RefreshCw} from 'lucide-react';
import {notificationVerbs,type ActivityNotification,type NotificationPage} from '../notification-model';
const empty:NotificationPage={items:[],unread:0,latestId:0,hasMore:false,nextBefore:null};
export default function Notifications({onOpen}:{onOpen:(item:ActivityNotification)=>Promise<void>}){
 const [open,setOpen]=useState(false),[data,setData]=useState(empty),[unreadOnly,setUnreadOnly]=useState(false),[cursors,setCursors]=useState<number[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),bell=useRef<HTMLButtonElement>(null),before=cursors.at(-1)||0;
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 useEffect(()=>{
  let active=true,working=false;const controller=new AbortController();setLoading(true);
  async function sync(){if(working||document.visibilityState!=='visible')return;working=true;try{
   const r=await fetch('/api/notifications?'+new URLSearchParams({before:String(before),unread:unreadOnly?'1':'0'}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
   const d=await r.json() as NotificationPage&{error?:string};if(!r.ok)throw new Error(d.error||'Notifications unavailable.');if(active){setData(d);setError('');}
  }catch(e){if(active)setError(e instanceof Error?e.message:'Notifications could not load.');}finally{working=false;if(active)setLoading(false);}}
  void sync();const timer=setInterval(sync,5000);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);};
 },[before,unreadOnly,version]);
 async function mark(payload:Record<string,unknown>){const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)}),d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error||'Please retry.');}
 function close(){setOpen(false);bell.current?.focus();}
 async function choose(n:ActivityNotification){if(busy)return;setBusy(true);try{await mark({action:'read',id:n.id});setVersion(v=>v+1);await onOpen(n);close();}catch(e){setError(e instanceof Error?e.message:'Could not open this activity.');}finally{setBusy(false);}}
 return <>
  <button ref={bell} className="icon-button notification-bell" aria-label={'Notifications'+(data.unread?', '+data.unread+' unread':'')} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setCursors([]);setVersion(v=>v+1);setOpen(true);}}><Bell size={21}/>{data.unread>0&&<span className="notification-count">{data.unread>99?'99+':data.unread}</span>}</button>
  <dialog ref={dialog} className="notification-panel" aria-labelledby="notifications-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
   <header><div><span className="eyebrow">YOUR ŚATOR ACTIVITY</span><h2 id="notifications-title">Notifications <span>{data.unread>0?data.unread:''}</span></h2></div><button className="icon-button" aria-label="Close notifications" onClick={close}><X size={20}/></button></header>
   <div className="notification-tools"><div className="notification-tabs" aria-label="Filter notifications">{[false,true].map(v=><button key={String(v)} aria-pressed={unreadOnly===v} className={unreadOnly===v?'selected':''} onClick={()=>{setUnreadOnly(v);setCursors([]);}}>{v?'Unread':'All'}</button>)}</div><button className="text-button" disabled={busy||!data.unread||loading} onClick={async()=>{setBusy(true);try{await mark({action:'readAll',through:data.latestId});setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}}><CheckCheck size={15}/>Mark all read</button></div>
   {error&&<div className="notification-error" role="alert">{error}<button className="text-button" onClick={()=>setVersion(v=>v+1)}><RefreshCw size={14}/>Retry</button></div>}
   <div className="notification-list" aria-busy={loading||busy}>
    {loading&&!data.items.length?<p role="status" className="notification-empty">Loading your activity…</p>:!data.items.length&&!error?<div className="notification-empty"><Bell size={30}/><h3>{unreadOnly?'You’re all caught up.':'Your next connection starts here.'}</h3><p>{unreadOnly?'New activity will appear here.':'Likes, comments, messages and design-request updates will appear as people interact with you.'}</p></div>:null}
    {data.items.map(n=>{const Icon=n.kind==='like'?Heart:['message','comment','connection'].includes(n.kind)?MessageCircle:n.kind==='follow'?UserPlus:Palette;return <button key={n.id} className={'notification-row '+(!n.readAt?'is-unread':'')} disabled={busy||loading} onClick={()=>void choose(n)}><span className={'notification-symbol '+n.kind}><Icon size={18}/></span><span className="notification-copy"><span><strong>{n.actorName}</strong> {notificationVerbs[n.kind]||'updated your activity'}.</span>{n.title&&<small>{n.title}</small>}<time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></span>{!n.readAt?<span className="unread-dot" aria-label="Unread"/>:<ArrowUpRight size={14}/>}</button>;})}
   </div>
   {(cursors.length>0||data.hasMore)&&<nav className="notification-pagination" aria-label="Notification pages"><button className="text-button" disabled={!cursors.length||loading} onClick={()=>setCursors(c=>c.slice(0,-1))}>Newer</button><span>Page {cursors.length+1}</span><button className="text-button" disabled={!data.hasMore||loading} onClick={()=>{if(data.nextBefore)setCursors(c=>[...c,data.nextBefore!]);}}>Older</button></nav>}
   <footer><span className="notification-live-dot"/>Updates every 5 seconds while the app is active</footer>
  </dialog>
 </>;
}
