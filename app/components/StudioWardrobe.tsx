'use client';
import {useState} from 'react';
import {ArrowUpRight,ArrowLeft,Search,Sparkles} from 'lucide-react';
import {collectionTemplates,garmentSample,wardrobeGroups,wardrobeTemplates,inWardrobeGroup,type Collection,type WardrobeGroup} from '../studio-wardrobe';
import {studioSvg} from '../studio-graphics';
import type {StudioDocument} from '../studio-model';

export function StudioCollections({onChoose}:{onChoose:(audience:Collection)=>void}){
 return <div className="wardrobe-collections" aria-label="Choose a collection">{(['Menswear','Womenswear'] as const).map(a=>{
  const garments=collectionTemplates(a),cover=garments.slice(0,3);
  return <button className="wardrobe-collection" key={a} onClick={()=>onChoose(a)} aria-label={'Choose '+(a==='Menswear'?'Men’s':'Women’s')+' collection'}>
   <div className="wardrobe-collection-art" aria-hidden="true">{cover.map(t=><div key={t.id} dangerouslySetInnerHTML={{__html:studioSvg(garmentSample(t),'front',false,'collection-'+t.id)}}/>)}</div>
   <div className="wardrobe-collection-copy"><span className="eyebrow">{garments.length} EDITABLE GARMENTS</span><h2>{a==='Menswear'?'Men’s':'Women’s'}<ArrowUpRight size={30}/></h2><p>{a==='Menswear'?'Formal trousers, baggy jeans, shirts, hoodies, tailoring and more.':'Dresses, skirts, trousers, tops, sarees, co-ords and more.'}</p><span className="wardrobe-collection-cta">Explore garments <ArrowUpRight size={17}/></span></div>
  </button>;
 })}</div>;
}

export default function StudioWardrobe({audience,onAudience,onCollections,onIdeas,onDesign}:{audience:Collection;onAudience:(audience:Collection)=>void;onCollections:()=>void;onIdeas:()=>void;onDesign:(design:StudioDocument,title:string)=>void}){
 const [group,setGroup]=useState<WardrobeGroup>('All garments'),[query,setQuery]=useState('');
 const collection=collectionTemplates(audience),items=wardrobeTemplates(audience,group,query);
 function changeAudience(a:Collection){setGroup('All garments');setQuery('');onAudience(a);}
 return <section className="wardrobe-browser" aria-label="Visual garment catalogue">
  <div className="wardrobe-navigation"><button onClick={onCollections}><ArrowLeft size={16}/>Collections</button><span>01 Collection <b>/ 02 Garment</b> / 03 Canvas</span><button onClick={onIdeas}><Sparkles size={16}/>Start with an idea</button></div>
  <div className="wardrobe-intro"><div><span className="eyebrow">THE GARMENT LIBRARY</span><h2>{audience==='Menswear'?'Men’s':'Women’s'} wardrobe.</h2><p>Choose a sample. Make its colours, fabric, text and artwork your own.</p></div><div className="atelier-segments" aria-label="Garment collections">{(['Menswear','Womenswear'] as const).map(a=><button key={a} aria-pressed={audience===a} onClick={()=>changeAudience(a)}>{a==='Menswear'?'Men’s':'Women’s'}</button>)}</div></div>
  <div className="wardrobe-filterbar"><label><Search size={17}/><input aria-label="Search garments" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search formal pants, baggy jeans, dresses…"/></label><span role="status">{items.length} editable {items.length===1?'garment':'garments'}</span></div>
  <div className="wardrobe-categories" aria-label="Garment categories">{wardrobeGroups.filter(g=>collection.some(t=>inWardrobeGroup(t,g))).map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
  <div className="wardrobe-grid">{items.map((t,i)=>{const sample=garmentSample(t);return <button key={t.id} className="wardrobe-garment" aria-label={'Customize '+t.name} onClick={()=>onDesign(sample,t.name+' / my design')}>
   <div className={'wardrobe-garment-art tone-'+i%4}><span>EDITABLE SAMPLE</span><div dangerouslySetInnerHTML={{__html:studioSvg(sample,'front',false,'wardrobe-'+t.id)}}/><i><ArrowUpRight size={18}/></i></div>
   <div className="wardrobe-garment-copy"><small>{t.category} · {sample.fabric}</small><h3>{t.name}</h3><span>Customize garment <ArrowUpRight size={14}/></span></div>
  </button>;})}</div>
  {!items.length&&<div className="wardrobe-empty"><h3>No garments match this search.</h3><p>Try another name, or clear your filters to see the full collection.</p><button className="button secondary" onClick={()=>{setQuery('');setGroup('All garments');}}>Show all garments</button></div>}
  <p className="wardrobe-footnote">Original, editable concept illustrations. These are design starting points; final fit and construction require garment sampling.</p>
 </section>;
}
