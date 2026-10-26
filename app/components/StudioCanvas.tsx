'use client';
import {useEffect,useRef,useState} from 'react';
import {baseMarkup,garmentPath,shapePaths} from '../studio-graphics';
import {newLayer,type StudioDocument,type StudioView,type Layer} from '../studio-model';

// Fabric's pinned browser bundle is self-hosted with its MIT licence.
type FabricAPI=Record<string,any>; // The boundary is converted to the validated Layer model below.
let fabricPromise:Promise<FabricAPI>|undefined;
export function loadScript(src:string){return new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve();s.onerror=()=>{s.remove();reject(new Error('The design tools could not load. Reload to retry.'));};document.head.appendChild(s);});}
export function loadFabric(){if(!fabricPromise)fabricPromise=loadScript('/vendor/fabric-7.4.0.min.js').then(()=>(window as unknown as {fabric:FabricAPI}).fabric).catch(e=>{fabricPromise=undefined;throw e;});return fabricPromise;}
export async function loadFont(font:string){if(['Arial','Georgia','Verdana','Trebuchet MS','Courier New','Times New Roman','Impact','Palatino','Garamond','Tahoma','Helvetica','monospace'].includes(font))return;const id='sator-font-'+font.replaceAll(' ','-');if(!document.getElementById(id)){const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(font)+':wght@400;700&display=swap';document.head.appendChild(link);await new Promise<void>(resolve=>{link.onload=()=>resolve();link.onerror=()=>resolve();setTimeout(resolve,2500);});}await document.fonts.load('700 30px "'+font+'"').catch(()=>{});}
export default function StudioCanvas({design,view,selected,onSelect,onLayers,draw,color,zoom,grid}:{design:StudioDocument;view:StudioView;selected:string;onSelect:(id:string)=>void;onLayers:(layers:Layer[])=>void;draw:boolean;color:string;zoom:number;grid:boolean}){
 const element=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),canvas=useRef<any>(null),api=useRef<FabricAPI>(null),generation=useRef(0),latest=useRef({design,view,selected,onSelect,onLayers,grid}),[ready,setReady]=useState(false),[error,setError]=useState('');
 latest.current={design,view,selected,onSelect,onLayers,grid};
 useEffect(()=>{let alive=true;loadFabric().then(f=>{if(!alive||!element.current)return;api.current=f;const c=new f.Canvas(element.current,{width:600,height:640,preserveObjectStacking:true,selection:false,backgroundColor:'transparent'});canvas.current=c;
  const selection=()=>latest.current.onSelect(c.getActiveObject()?.satorId||'');c.on('selection:created',selection);c.on('selection:updated',selection);c.on('selection:cleared',selection);
  c.on('object:moving',({target:o}:any)=>{if(latest.current.grid){o.set({left:Math.round(o.left/10)*10,top:Math.round(o.top/10)*10});}});
  c.on('object:modified',({target:o}:any)=>{if(!o?.satorId)return;const {design:d,view:v}=latest.current;const n=d.views[v].map(l=>l.id===o.satorId?{...l,x:Math.max(-600,Math.min(1200,o.left)),y:Math.max(-640,Math.min(1280,o.top)),scaleX:Math.max(.05,Math.min(10,o.scaleX/(o.satorBaseScale||1))),scaleY:Math.max(.05,Math.min(10,o.scaleY/(o.satorBaseScale||1))),rotation:o.angle%360,flipX:!!o.flipX}:l);latest.current.onLayers(n);});
  c.on('path:created',({path:p}:any)=>{const {design:d,view:v}=latest.current;if(d.views[v].length>=60){c.remove(p);return;}const offset=p.pathOffset;const value=p.path.map((segment:any[])=>segment.map((n:any,i:number)=>i===0?n:Number((n-(i%2?offset.x:offset.y)).toFixed(2))).join(' ')).join(' ');if(value.length>8000){c.remove(p);setError('That stroke is too long. Draw several shorter strokes.');return;}const center=p.getCenterPoint();latest.current.onLayers([...d.views[v],{...newLayer('path',value,p.stroke),x:center.x,y:center.y,strokeWidth:p.strokeWidth}]);});
  setReady(true);
 }).catch(e=>setError(e.message));return()=>{alive=false;generation.current++;if(canvas.current){void canvas.current.dispose();canvas.current=null;}};},[]);
 useEffect(()=>{const c=canvas.current;if(!ready||!c)return;c.isDrawingMode=draw;if(draw){c.freeDrawingBrush=new api.current!.PencilBrush(c);c.freeDrawingBrush.color=color;c.freeDrawingBrush.width=4;}},[ready,draw,color]);
 useEffect(()=>{const c=canvas.current;if(!ready||!c)return;const resize=()=>{const available=Math.max(1,(container.current?.parentElement?.clientWidth||616)-16);const w=Math.min(600,available)*zoom/100;c.setDimensions({width:w,height:w*640/600});c.setZoom(w/600);};resize();const observer=new ResizeObserver(resize);if(container.current)observer.observe(container.current);return()=>observer.disconnect();},[ready,zoom]);
 useEffect(()=>{if(!ready||!canvas.current||!api.current)return;const c=canvas.current,f=api.current,seq=++generation.current;let stopped=false;
  async function render(){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="640">${baseMarkup(design,view,'fabric-base')}</svg>`;const bg=await f.FabricImage.fromURL('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));bg.set({left:0,top:0,originX:'left',originY:'top',selectable:false,evented:false});const objects=[];
   for(const l of design.views[view])objects.push(await fabricLayer(f,l));
   if(stopped||seq!==generation.current)return;c.off('selection:cleared');c.clear();c.backgroundColor='transparent';c.add(bg,...objects);// Keep overflowing artwork selectable; mockups clip it to the garment.
   const active=objects.find(o=>o.satorId===latest.current.selected);if(active&&!active.locked)c.setActiveObject(active);c.requestRenderAll();c.on('selection:cleared',()=>latest.current.onSelect(''));setError('');
  }void render().catch(()=>setError('An artwork or font could not load. Check your connection, then change views to retry.'));return()=>{stopped=true;};
 },[ready,design,view]);
 useEffect(()=>{const c=canvas.current;if(!ready||!c)return;const o=c.getObjects().find((o:any)=>o.satorId===selected);if(o)c.setActiveObject(o);else c.discardActiveObject();c.requestRenderAll();},[selected,ready]);
 return <><div className={'atelier-canvas-scroll '+(grid?'with-grid':'')}><div ref={container} className="atelier-canvas-inner" style={{width:zoom+'%',minWidth:zoom>100?zoom+'%':undefined}}><canvas ref={element} aria-label={view+' garment design canvas'}/></div></div>{!ready&&<p role="status">Loading your design tools…</p>}{error&&<p role="alert" className="inline-error">{error}</p>}</>;
}

export async function fabricLayer(f:FabricAPI,l:Layer){let o:any;await loadFont(l.font);if(l.kind==='text'){o=new f.FabricText(l.value,{fontFamily:l.font+", Arial, sans-serif",fontSize:l.fontSize,fontWeight:700,charSpacing:l.spacing*1000/l.fontSize,...(l.curve?{path:new f.Path('M -180 30 Q 0 -100 180 30',{fill:'',stroke:''}),pathAlign:'center',pathSide:'left'}:{})});}
    else if(l.kind==='image'){o=await f.FabricImage.fromURL(l.value);const sx=140/o.width,sy=140/o.height;o.set({width:o.width,height:o.height});o.satorImageScale=Math.min(sx,sy);}
    else if(l.kind==='path')o=new f.Path(l.value,{fill:'',strokeLineCap:'round'});
    else if(l.value==='circle')o=new f.Circle({radius:40});else if(l.value==='square')o=new f.Rect({width:80,height:80,rx:5,ry:5});else o=new f.Path(shapePaths[l.value]||shapePaths.star);
    const imageScale=o.satorImageScale||1;o.set({left:l.x,top:l.y,originX:'center',originY:'center',scaleX:l.scaleX*imageScale,scaleY:l.scaleY*imageScale,angle:l.rotation,fill:l.kind==='path'?'':l.fill,stroke:l.stroke,strokeWidth:l.strokeWidth,opacity:l.hidden?0:l.opacity,fontFamily:l.font+", Arial, sans-serif",flipX:l.flipX,visible:!l.hidden,selectable:!l.locked,evented:!l.locked,lockScalingFlip:true,cornerColor:'#1b5f49',borderColor:'#1b5f49',transparentCorners:false,cornerSize:10,strokeDashArray:l.effect==='stitch'?[2,2]:undefined,shadow:l.effect==='shadow'?new f.Shadow({color:'#00000055',blur:8,offsetX:3,offsetY:4}):null});o.satorId=l.id;
    // Object transforms store image dimensions in document units, not source pixels.
    if(l.kind==='image'){o.on('modified',()=>{});o.satorBaseScale=imageScale;}
return o;
}
