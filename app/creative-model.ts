import type {DesignConfig} from './model';
export const wardrobeCategories=['top','bottom','onepiece','layer','shoes','accessory'] as const;
export const occasions=['everyday','work','evening','active'] as const;
export type Occasion=typeof occasions[number];
export type WardrobeItem={id:string;title:string;category:typeof wardrobeCategories[number];color:string;image:string;occasions:Occasion[];season:'all'|'summer'|'winter';notes:string;createdAt:string};
export type Outfit={id:string;name:string;occasion:Occasion;items:string[];createdAt:string};
export type InspirationPin={id:string;lookbookId:string;title:string;note:string;image:string;createdAt:string};
export type DesignProject={id:string;ownerId:string;collaboratorId:string|null;collaboratorName:string|null;reviewerId:string;commissionId:string|null;title:string;brief:string;reference:string;config:DesignConfig;status:'active'|'approved'|'changes_requested'|'archived';version:number;updatedAt:string};
export type ProjectRevision={id:string;authorId:string;authorName:string;version:number;config:DesignConfig;note:string;createdAt:string};
export type ProjectEvent={id:string;authorId:string;authorName:string;kind:string;body:string;version:number;createdAt:string};
export type CreativeData={wardrobe:WardrobeItem[];outfits:Outfit[];pins:InspirationPin[];projects:DesignProject[]};
export const emptyCreative:CreativeData={wardrobe:[],outfits:[],pins:[],projects:[]};
export const label=(s:string)=>s==='onepiece'?'Dress / one-piece':s.charAt(0).toUpperCase()+s.slice(1).replaceAll('_',' ');
function neutral(hex:string){const rgb=hex.match(/[a-f0-9]{2}/gi)?.map(v=>parseInt(v,16))||[0,0,0];return Math.max(...rgb)-Math.min(...rgb)<45;}
export function outfitSuggestions(items:WardrobeItem[],occasion:Occasion,season='all'){
 const available=items.filter(i=>season==='all'||i.season==='all'||i.season===season);
 const by=(category:WardrobeItem['category'])=>available.filter(i=>i.category===category).sort((a,b)=>Number(b.occasions.includes(occasion))-Number(a.occasions.includes(occasion))||a.id.localeCompare(b.id)).slice(0,12);
 const bases=[...by('top').flatMap(t=>by('bottom').map(b=>[t,b])),...by('onepiece').map(d=>[d])];
 const looks=bases.map(base=>{
  const shoes=by('shoes').sort((a,b)=>Number(b.occasions.includes(occasion))*3+Number(neutral(b.color))-Number(a.occasions.includes(occasion))*3-Number(neutral(a.color)))[0];
  const layer=season==='winter'?by('layer')[0]:undefined;
  const pieces=[...base,...(shoes?[shoes]:[]),...(layer?[layer]:[])];
  const matched=pieces.filter(p=>p.occasions.includes(occasion)).length;
  return {items:pieces.map(p=>p.id),score:matched*3+pieces.filter(p=>neutral(p.color)).length,reason:`${matched} of ${pieces.length} pieces tagged for ${label(occasion).toLowerCase()}. ${pieces.some(p=>neutral(p.color))?'Includes a neutral color.':'A colorful combination.'}`};
 });
 return looks.sort((a,b)=>b.score-a.score||a.items.join().localeCompare(b.items.join())).slice(0,6);
}
