import {styleOptions,categoryTags,type StyleWeights} from '../style-model';
import {dbRaw,publicContentSQL,type PublicContent} from './community';

export function cosine(a:StyleWeights,b:StyleWeights){let dot=0,aa=0,bb=0;for(const {id} of styleOptions){const x=Math.max(0,Number(a[id])||0),y=Math.max(0,Number(b[id])||0);dot+=x*y;aa+=x*x;bb+=y*y;}return aa&&bb?Math.round(dot/Math.sqrt(aa*bb)*10000)/100:0;}
export async function recommendationScores(uid:string,weights:StyleWeights,designers:{userId:string;weights:string}[],specs:{itemId:string;styles:string}[]){
 const [catalog,blocks]=await Promise.all([
  dbRaw().prepare(`SELECT id,userId,category,createdAt FROM (${publicContentSQL}) ORDER BY createdAt DESC,id DESC LIMIT 1000`).all<Pick<PublicContent,'id'|'userId'|'category'|'createdAt'>>(),
  dbRaw().prepare('SELECT CASE WHEN user_id=? THEN target_id ELSE user_id END AS id FROM member_blocks WHERE user_id=? OR target_id=?').bind(uid,uid,uid).all<{id:string}>()
 ]);
 const excluded=new Set(blocks.results.map(b=>b.id));
 const creatorWeights=new Map(designers.map(d=>[d.userId,JSON.parse(d.weights) as StyleWeights]));
 const explicit=new Map(specs.map(s=>[s.itemId,JSON.parse(s.styles) as string[]]));
 const itemScores:Record<string,number>={},designerScores:Record<string,number>={};
 for(const d of designers)if(d.userId!==uid&&!excluded.has(d.userId))designerScores[d.userId]=cosine(weights,creatorWeights.get(d.userId)||{});
 for(const item of catalog.results){
  if(excluded.has(item.userId)){itemScores[item.id]=-1;continue;}
  const ownTags=explicit.get(item.id),creator=creatorWeights.get(item.userId)||{};
  const tags=ownTags?.length?ownTags:Object.keys(creator).filter(k=>Number(creator[k as keyof StyleWeights])>0);
  const resolved=tags.length?tags:categoryTags(item.category);
  itemScores[item.id]=cosine(weights,Object.fromEntries(resolved.map(t=>[t,1])));
 }
 return {version:'content-cosine-v1',itemScores,designerScores,excludedOwners:[...excluded]};
}
