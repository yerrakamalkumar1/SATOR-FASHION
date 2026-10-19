export const styleOptions=[
 {id:'old-money',name:'Old Money',note:'Quiet tailoring, linen, timeless neutrals',color:'#d8cfbb',symbol:'01'},
 {id:'streetwear',name:'Baggy / Streetwear',note:'Oversized shapes, graphics, urban energy',color:'#c3c8b3',symbol:'02'},
 {id:'formals',name:'Formals',note:'Sharp suits and considered structure',color:'#bec9cc',symbol:'03'},
 {id:'casuals',name:'Casuals',note:'Easy essentials for everyday living',color:'#e4c9ae',symbol:'04'},
 {id:'vintage',name:'Vintage',note:'Nostalgic shapes with a new point of view',color:'#cfc1cf',symbol:'05'},
 {id:'tailoring',name:'Custom Tailoring',note:'Personal details, made to your brief',color:'#cfcea9',symbol:'06'},
 {id:'minimal',name:'Minimal',note:'Clean lines. Less, beautifully done.',color:'#d9ded4',symbol:'07'},
 {id:'experimental',name:'Experimental',note:'Unexpected materials and bold ideas',color:'#dbb8a6',symbol:'08'},
] as const;
export type StyleId=typeof styleOptions[number]['id'];
export type StyleWeights=Partial<Record<StyleId,number>>;
export type JourneyMode='buy'|'design';
export function normalizeWeights(input:StyleWeights):StyleWeights{
 const rows=styleOptions.map(s=>({id:s.id,value:Math.max(0,Number(input[s.id])||0)})).filter(r=>r.value>0);
 const total=rows.reduce((n,r)=>n+r.value,0);if(!total)return {};
 const result:StyleWeights={};let used=0;
 const fractions=rows.map(r=>{const n=r.value/total*100;result[r.id]=Math.floor(n);used+=Math.floor(n);return {...r,fraction:n-Math.floor(n)};}).sort((a,b)=>b.fraction-a.fraction);
 for(let i=0;i<100-used;i++)result[fractions[i%fractions.length].id]=(result[fractions[i%fractions.length].id]||0)+1;
 return result;
}
export const styleName=(id:string)=>styleOptions.find(s=>s.id===id)?.name||id;
export const styleScore=(weights:StyleWeights,tags:string[])=>[...new Set(tags)].reduce((n,t)=>n+(weights[t as StyleId]||0),0);
export function categoryTags(category:string):StyleId[]{return category==='Streetwear'?['streetwear','casuals']:category==='Minimal'?['minimal','casuals']:category==='Typography'?['streetwear','experimental']:category==='Graphic'?['experimental','casuals']:[];}
export type StyleProfile={mode:JourneyMode;weights:StyleWeights;name:string;bio:string;city:string;portfolio:string;sellReadyMade:boolean;updatedAt:string};
export type DesignerMatch={userId:string;name:string;bio:string;city:string;portfolio:string;weights:StyleWeights;creationCount:number};
export type Measurements={unit:'cm';chest?:number;waist?:number;hips?:number;inseam?:number;shoulder?:number;sleeve?:number;height?:number;notes:string;updatedAt?:string};
export type Lookbook={id:string;name:string;items:string[];createdAt:string};
export type RequestBrief={id:string;buyerId:string;buyerName:string;title:string;brief:string;budget:number;styles:StyleId[];deadline:string;status:string;createdAt:string};
export type Bid={id:string;requestId:string;designerId:string;designerName:string;quote:number;days:number;message:string;sketch:string;createdAt:string};
export type Conversation={id:string;buyerId:string;designerId:string;context:string;itemId:string;buyerName:string;designerName:string;updatedAt:string};
export type ChatMessage={id:string;conversationId:string;senderId:string;body:string;createdAt:string};
export type ItemSpec={itemId:string;userId:string;styles:StyleId[];fabric:string;gsm:number|null;stitch:string;care:string;textureMedia:string;certificate:string;updatedAt:string};
export type Drop={id:string;designerId:string;designerName:string;itemId:string;title:string;target:number;price:number;deadline:string;note:string;createdAt:string;pledges:number;joined:boolean};
export type Commission={id:string;requestId:string;buyerId:string;designerId:string;bidId:string;title:string;amount:number;status:string;createdAt:string};
export type Evidence={id:string;commissionId:string;designerId:string;stage:'materials'|'dispatch';asset:string;note:string;review:'submitted'|'approved'|'changes_requested';feedback:string;createdAt:string};
export type JourneyData={recommendations?:{version:string;itemScores:Record<string,number>;designerScores:Record<string,number>;excludedOwners:string[]};profiles:StyleProfile[];designers:DesignerMatch[];measurements:Measurements|null;lookbooks:Lookbook[];requests:RequestBrief[];bids:Bid[];conversations:Conversation[];messages:ChatMessage[];specs:ItemSpec[];drops:Drop[];commissions:Commission[];evidence:Evidence[]};
export const emptyJourney:JourneyData={profiles:[],designers:[],measurements:null,lookbooks:[],requests:[],bids:[],conversations:[],messages:[],specs:[],drops:[],commissions:[],evidence:[]};
