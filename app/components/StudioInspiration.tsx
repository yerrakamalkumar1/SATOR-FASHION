'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {studioConcepts,conceptProduct} from '../studio-inspiration';
import {styleOptions,type StyleId,type StyleWeights} from '../style-model';
import {studioSvg} from '../studio-graphics';
import type {Product} from '../model';

type Props={weights?:StyleWeights;initialAudience?:'Menswear'|'Womenswear';onDesign:(p:Product)=>void};
export default function StudioInspiration({weights={},initialAudience='Menswear',onDesign}:Props){
 const preferred=[...styleOptions].sort((a,b)=>(weights[b.id]||0)-(weights[a.id]||0))[0].id;
 const [style,setStyle]=useState<StyleId>(preferred),[audience,setAudience]=useState(initialAudience);
 useEffect(()=>{setStyle(preferred);},[preferred]);
 const concepts=studioConcepts.filter(c=>c.style===style&&c.audience===audience);
 return <section className="studio-inspiration" aria-label="Editable outfit samples">
  <div className="section-heading"><div><span className="eyebrow">YOUR NEXT DESIGN STARTS HERE</span><h2>Find your silhouette.</h2><p>48 original starting points across eight styles. Open any piece to customize it.</p></div><span className="inspiration-label">STUDIO CONCEPTS</span></div>
  <div className="atelier-segments" aria-label="Sample collections">{(['Menswear','Womenswear'] as const).map(a=><button key={a} aria-pressed={a===audience} onClick={()=>setAudience(a)}>{a==='Menswear'?'Men’s':'Women’s'}</button>)}</div>
  <div className="inspiration-styles" aria-label="Sample styles">{styleOptions.map(s=><button key={s.id} aria-pressed={style===s.id} onClick={()=>setStyle(s.id)}>{s.name}{!!weights[s.id]&&<small>{weights[s.id]}% of your mix</small>}</button>)}</div>
  <div className="inspiration-grid">{concepts.map((c,i)=><article key={c.id}><button className="inspiration-preview" aria-label={'Customize '+c.title} onClick={()=>onDesign(conceptProduct(c))}><div style={{background:['#e8e3d7','#dce3db','#e3dce1'][i]}} dangerouslySetInnerHTML={{__html:studioSvg(c.document,'front',false,c.id)}}/><span>0{i+1} / {c.audience==='Menswear'?'MEN’S':'WOMEN’S'}</span><ArrowUpRight size={20}/></button><div className="inspiration-description"><h3>{c.title}</h3><p>{c.note}</p><button className="text-button" onClick={()=>onDesign(conceptProduct(c))}>Customize this piece<ArrowUpRight size={15}/></button></div></article>)}</div>
  <p className="inspiration-footnote">Editable fashion concepts. Final fit, pattern cutting and construction require sampling.</p>
 </section>;
}
