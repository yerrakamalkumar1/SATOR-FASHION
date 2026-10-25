import {blankStudio,templates,type StudioDocument} from './studio-model';
import {defaultConfig,type Product} from './model';
import {styleName,type StyleId} from './style-model';

type Collection='Menswear'|'Womenswear';
type Edit={style:StyleId;men:[string,string,string];women:[string,string,string];colors:[string,string,string];fabric:StudioDocument['fabric'];note:string};
const edits:Edit[]=[
 {style:'old-money',men:['Linen shirt','Pleated trousers','Navy blazer'],women:['Silk blouse with midi skirt','Pearl-button cardigan','Camel coat'],colors:['#eae1ce','#ad9c7d','#263b4b'],fabric:'linen',note:'Soft neutrals, considered proportions and restrained detail.'},
 {style:'streetwear',men:['Graphic oversized tee','Baggy jeans','Boxy hoodie'],women:['Oversized tee','Baggy jeans','Cargo pants'],colors:['#dedccf','#46566b','#343d34'],fabric:'cotton',note:'Roomy silhouettes, practical layers and space for original graphics.'},
 {style:'formals',men:['Formal shirt','Pleated trousers','Blazer'],women:['Blazer','Tailored trousers','Pencil skirt'],colors:['#e7e8e3','#45464b','#283d4a'],fabric:'tweed',note:'Clean lines and coordinated separates for a considered formal wardrobe.'},
 {style:'casuals',men:['Polo','Chinos','Casual shirt'],women:['Shirt dress','Wide leg jeans','Cardigan'],colors:['#9aab94','#ccb99b','#acbec4'],fabric:'cotton',note:'Comfortable daily pieces that mix easily with your wardrobe.'},
 {style:'vintage',men:['Cable knit sweater','Varsity jacket','Straight jeans'],women:['Flared jeans','Midi dress','Tweed jacket set'],colors:['#aa754d','#556653','#9c6f77'],fabric:'corduroy',note:'Retro proportions, warm tones and texture with a personal twist.'},
 {style:'tailoring',men:['Bandhgala','Waistcoat','Kurta pajama set'],women:['Saree','Anarkali','Kurti with palazzo'],colors:['#8f494f','#c8a86a','#496a62'],fabric:'silk',note:'Explore formal and Indian silhouettes; add your construction brief before sampling.'},
 {style:'minimal',men:['T-shirt','Linen shirt','Tailored overcoat'],women:['Slip dress','Boat-neck knit top','Linen co-ord'],colors:['#eeeae0','#adb2a4','#4b514d'],fabric:'linen',note:'Uncluttered surfaces, useful shapes and a quiet color palette.'},
 {style:'experimental',men:['Parachute pants','Bomber jacket','Angavastram'],women:['Jumpsuit','Cape','Indo-western gown'],colors:['#b4c6a0','#bca0c7','#d38f68'],fabric:'cotton',note:'Unexpected volume, bold color and open-ended surface exploration.'},
];
export type StudioConcept={id:string;title:string;style:StyleId;audience:Collection;note:string;document:StudioDocument};
// Stable, original concept data. No scraped artwork, fake creators or inventory.
export const studioConcepts:StudioConcept[]=edits.flatMap(edit=>(['Menswear','Womenswear'] as const).flatMap(audience=>(audience==='Menswear'?edit.men:edit.women).map((name,i)=>{
 const template=templates.find(t=>t.audience===audience&&t.name===name);
 if(!template)throw new Error('Missing studio concept garment: '+audience+' / '+name);
 const document=blankStudio(template);
 document.color=edit.colors[i];document.accent='#283c33';document.fabric=/jeans/i.test(name)?'denim':/knit|sweater|cardigan/i.test(name)?'knit':/silk|saree|anarkali/i.test(name)?'silk':edit.fabric;
 if(edit.style==='streetwear')document.fit='oversized';
 if(edit.style==='formals'&&template.shape==='shirt'){document.fabric='cotton';document.sleeves='long';}
 if(edit.style==='vintage'&&template.shape==='dress')document.pattern='polka dots';
 if(edit.style==='tailoring'&&template.shape==='drape')document.pattern='paisley';
 return {id:`concept-${audience.toLowerCase()}-${edit.style}-${i}`,title:name,style:edit.style,audience,note:edit.note,document};
})));
export function conceptProduct(concept:StudioConcept):Product{return {id:concept.id,title:concept.title,creator:'ŚATOR Studio',description:styleName(concept.style)+' concept. '+concept.note,category:styleName(concept.style),kind:'creator',sample:true,config:{...defaultConfig,text:'',subtext:'',graphic:'none',color:concept.document.color,ink:concept.document.accent,studio:structuredClone(concept.document)}};}
