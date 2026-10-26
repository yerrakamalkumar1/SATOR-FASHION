import {blankStudio,templates,type Template,type StudioDocument} from './studio-model';

export type Collection='Menswear'|'Womenswear';
export const wardrobeGroups=['All garments','Formals','Baggy / Streetwear','Casuals','Shirts & tops','Hoodies & knitwear','Jeans & trousers','Dresses','Skirts','Co-ords & jumpsuits','Outerwear','Indian & fusion','Activewear','Loungewear','Accessories'] as const;
export type WardrobeGroup=typeof wardrobeGroups[number];
export function inWardrobeGroup(t:Template,group:WardrobeGroup){
 const n=t.name.toLowerCase();
 switch(group){
 case 'All garments':return true;
 case 'Formals':return /formal shirt|pleated trousers|tailored trousers|blazer|waistcoat|pencil skirt|silk blouse|bandhgala/.test(n);
 case 'Baggy / Streetwear':return /baggy|oversized|boxy|cargo|parachute|distressed|hoodie|tracksuit|denim jacket|varsity/.test(n);
 case 'Casuals':return /t-shirt|\btee\b|polo|casual shirt|linen shirt|chinos|jeans|shorts|cardigan|sundress|shirt dress/.test(n);
 case 'Shirts & tops':return ['tee','shirt','crop','tank'].includes(t.shape);
 case 'Hoodies & knitwear':return ['hoodie','sweater'].includes(t.shape)||/cardigan|knit/.test(n);
 case 'Jeans & trousers':return ['pants','shorts'].includes(t.shape);
 case 'Dresses':return t.shape==='dress';
 case 'Skirts':return t.shape==='skirt';
 case 'Co-ords & jumpsuits':return ['set','jumpsuit'].includes(t.shape);
 case 'Outerwear':return t.category==='Outerwear'||/overcoat|camel coat|navy blazer/.test(n);
 case 'Indian & fusion':return /ethnic/i.test(t.category)||/kurta|kurti|dhoti|anarkali|saree/.test(n);
 case 'Activewear':return t.category==='Activewear';
 case 'Loungewear':return t.category==='Loungewear'||/pajama|jogger|sweatshirt/.test(n);
 case 'Accessories':return t.category==='Accessories';
 }
}
const featured:Record<Collection,string[]>={
 Menswear:['Formal shirt','Pleated trousers','Baggy jeans','Hoodie','Casual shirt','T-shirt','Blazer','Cargo pants','Polo','Linen shirt','Shorts','Kurta'],
 Womenswear:['Midi dress','Tailored trousers','Blouse','Baggy jeans','Pleated skirt','Saree','Hoodie','Shirt','Jumpsuit','Crop top','Blazer','Palazzo pants'],
};
export function collectionTemplates(audience:Collection){
 // Shared essentials appear in either collection without duplicate named cards.
 const own=templates.filter(t=>t.audience===audience);
 const combined=[...own,...templates.filter(t=>t.audience==='Unisex'&&!own.some(o=>o.name===t.name))];
 return combined.sort((a,b)=>{const rank=(t:Template)=>{const i=featured[audience].indexOf(t.name);return i<0?100:i;};return rank(a)-rank(b);});
}
export function wardrobeTemplates(audience:Collection,group:WardrobeGroup='All garments',query=''){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return collectionTemplates(audience).filter(t=>inWardrobeGroup(t,group)&&words.every(word=>{
  const tags=wardrobeGroups.filter(g=>inWardrobeGroup(t,g)).join(' ');
  return `${t.name} ${t.category} ${tags} ${t.shape==='pants'?'pants trousers bottoms':''}`.toLowerCase().includes(word);
 }));
}
export function garmentSample(t:Template):StudioDocument{
 const d=blankStudio(t),n=t.name.toLowerCase();
 if(/jeans|denim/.test(n)){d.color='#516e8a';d.fabric='denim';d.accent='#c0a177';}
 else if(/linen/.test(n)){d.color='#e4d6b9';d.fabric='linen';}
 else if(/leather/.test(n)){d.color='#624b3e';d.fabric='leather';}
 else if(/knit|sweater|cardigan|hoodie/.test(n)){d.color='#6c8270';d.fabric='knit';}
 else if(/saree|gown|silk|sherwani|anarkali/.test(n)){d.color='#9f4b58';d.fabric='silk';d.accent='#cfb67d';}
 else if(/kurta|kurti|tunic|robe/.test(n)){d.color='#d8ccb1';d.fabric='cotton';}
 else if(t.shape==='pants'){d.color=/cargo/.test(n)?'#7d8464':'#535c62';d.fabric=/trousers/.test(n)?'tweed':'cotton';}
 else if(t.shape==='dress'){d.color='#c38b78';d.fabric='linen';}
 else if(t.shape==='skirt'){d.color='#bba17d';d.fabric='tweed';}
 else if(t.shape==='jacket'||t.shape==='coat'){d.color='#344d5b';d.fabric='tweed';}
 else if(t.shape==='tee'){d.color='#d9d7c8';}
 return d;
}
