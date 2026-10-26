import {baseMarkup,garmentPath} from '../studio-graphics';
import {templates,studioWorkspaces,type StudioDocument,type StudioView} from '../studio-model';
import {loadScript,loadFabric,fabricLayer} from '../components/StudioCanvas';
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function pngOf(d:StudioDocument,view:StudioView,artOnly=false){const f=await loadFabric();const element=document.createElement('canvas');const c=new f.StaticCanvas(element,{width:600,height:640,enableRetinaScaling:false});try{if(!artOnly){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="640">'+baseMarkup(d,view,'export-base')+'</svg>';const bg=await f.FabricImage.fromURL('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));bg.set({left:0,top:0,originX:'left',originY:'top'});c.add(bg);}for(const layer of d.views[view])c.add(await fabricLayer(f,layer));if(!artOnly)c.clipPath=new f.Path(garmentPath(d,view),{absolutePositioned:true,fillRule:'evenodd'});c.renderAll();return c.toDataURL({format:'png',multiplier:3});}finally{c.cancelRequestedRender();await c.dispose();}}
export async function exportPNG(d:StudioDocument,view:StudioView,art=false){const data=await pngOf(d,view,art);downloadBlob(await(await fetch(data)).blob(),'sator-'+view.replaceAll(' ','-')+(art?'-artwork':'-mockup')+'.png');}
let pdfPromise:Promise<void>|undefined;
export async function exportConceptSheet(d:StudioDocument,title:string,onProgress:(message:string)=>void=()=>{}){
 onProgress('Preparing PDF tools…');
 if(!pdfPromise)pdfPromise=loadScript('/vendor/jspdf-3.0.4.min.js').catch(e=>{pdfPromise=undefined;throw e;});
 await pdfPromise;
 const JsPDF=(window as unknown as {jspdf:{jsPDF:new(...args:any[])=>any}}).jspdf.jsPDF;
 const pdf=new JsPDF({unit:'mm',format:'a4'}),t=templates.find(t=>t.id===d.templateId)!;
 pdf.setFontSize(22);pdf.text('SATOR / CONCEPT SHEET',15,22);
 const head=document.createElement('canvas');head.width=1200;head.height=80;
 const ctx=head.getContext('2d')!;ctx.fillStyle='#222';ctx.font='bold 36px Arial';ctx.fillText(title,0,48,1180);
 pdf.addImage(head.toDataURL(),'PNG',15,28,175,12);
 pdf.setFontSize(11);pdf.text([t.audience+' / '+t.name,'Fit: '+d.fit+' | Length: '+d.length+' | Fabric preview: '+d.fabric,'Body: '+d.color+' | Accent: '+d.accent+' | Pattern: '+d.pattern],15,50);
 for(const [i,v] of (['front','back'] as const).entries()){
  onProgress('Rendering '+v+' for the PDF…');pdf.text(v.toUpperCase(),i?112:18,78);
  pdf.addImage(await pngOf(d,v),'PNG',i?110:10,82,90,96);
 }
 pdf.text('Measurements (cm) - confirm on the physical sample',15,195);
 pdf.text(t.shape==='pants'||t.shape==='shorts'||t.shape==='skirt'?['Waist: __________  Hips: __________','Inseam: _________  Outseam: ________  Hem: ________']:['Chest: __________  Waist: __________  Hips: __________','Length: _________  Shoulder: ________  Sleeve: ________'],15,207);
 pdf.text('Artwork size: __________  Print placement: __________',15,222);
 pdf.setFontSize(9);pdf.text('Concept illustration. Not a cutting pattern or production approval.',15,240);
 pdf.text('Colors, fabric, fit, sizing and print technique require physical sampling.',15,246);
 pdf.addPage();pdf.setFontSize(18);pdf.text('Artwork details / material notes',15,22);
 const details=studioWorkspaces(d).filter(w=>w.illustrative);
 if(details.length){
  for(const [i,w] of details.entries()){
   onProgress('Rendering '+w.label+' for the PDF…');pdf.setFontSize(10);pdf.text(w.label.toUpperCase(),i?112:18,40);
   pdf.addImage(await pngOf(d,w.view),'PNG',i?110:10,45,90,96);
  }
  pdf.setFontSize(9);pdf.text('Illustrative artwork workspaces. Verify placement and construction on a sample.',15,149);
 }else{pdf.setFontSize(10);pdf.text('No sleeve workspace applies to this garment.',15,45);pdf.text('Front and back artwork are shown on page 1.',15,53);}
 pdf.setFontSize(10);
 const used=[...new Set(Object.values(d.views).flat().filter(l=>l.kind==='text').map(l=>l.font))];
 const summary=used.slice(0,8).join(', ')+(used.length>8?' (+'+(used.length-8)+' more)':'');
 pdf.text(pdf.splitTextToSize('Fonts: '+(summary||'No text layers'),180),15,165);
 pdf.text(['Fabric / composition: _________________________________','Print method / color matching: _________________________','Construction / finishing: ______________________________','_____________________________________________________','Sample reviewed by / date: _____________________________'],15,205);
 pdf.setFontSize(9);pdf.text('This sheet communicates an idea; it is not a manufacturing-ready tech pack.',15,260);
 return pdf.output('blob') as Blob;
}
