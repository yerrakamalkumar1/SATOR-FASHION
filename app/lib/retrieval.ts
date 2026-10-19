import {dbRaw,publicContentSQL,publicPeopleSQL,type PublicContent,type PublicPerson} from './community';

// Deterministic lexical retrieval, not a claim that an LLM is connected.
const stop=new Set('a an and the for me my i am m want need find show looking please some with of to buy under below budget less than in rs inr rupees would could like can get'.split(' '));
const synonyms=[['tee','tees','tshirt','tshirts','t-shirt'],['hoodie','hoodies','sweatshirt','sweatshirts'],['pants','trousers','trouser'],['sneakers','trainers'],['minimal','minimalist'],['formal','formals','officewear'],['oversized','baggy'],['saree','sari']];
function rawTerms(query:string){return [...new Set(query.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}\p{M}]+/gu)||[])].slice(0,8);}
export function searchTerms(query:string){return rawTerms(query.replace(/(?:under|below|less than|budget(?: of)?)\s*(?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?\s*k?\b/gi,' ').replace(/t-shirts?/gi,'tshirt')).filter(t=>!stop.has(t)&&!/^\d+$/.test(t));}
export function budgetFrom(query:string){const m=query.match(/(?:under|below|less than|budget(?: of)?)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)\s*(k\b)?/i);if(!m)return null;const n=Math.round(Number(m[1].replaceAll(',',''))*(m[2]?1000:1)*100);return Number.isSafeInteger(n)&&n>=0?n:null;}
function expanded(term:string){return synonyms.find(group=>group.includes(term))||[term];}
function expression(groups:string[][]){return groups.map(group=>'('+group.map(t=>'"'+t.replaceAll('"','""')+'"*').join(' OR ')+')').join(' AND ');}
function oneEdit(a:string,b:string){if(Math.abs(a.length-b.length)>1||a===b)return a===b;let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return a.length===b.length?(a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2))):a.length>b.length?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);}
export async function searchExpression(query:string,expand=true){
 const terms=expand?searchTerms(query):rawTerms(query),groups=terms.map(t=>expand?expanded(t):[t]);
 // Correction uses only words actually present in the public catalog. Bounded reads.
 for(let i=0;i<terms.length;i++){
  const t=terms[i];if(t.length<4||t.length>32)continue;
  const known=await dbRaw().prepare('SELECT 1 FROM search_vocab WHERE term>=? AND term<? LIMIT 1').bind(t,t+'\uffff').first();if(known)continue;
  const rows=await dbRaw().prepare('SELECT term FROM search_vocab WHERE term>=? AND term<? AND length(term) BETWEEN ? AND ? ORDER BY doc DESC,term LIMIT 100').bind(t[0],t[0]+'\uffff',t.length-1,t.length+1).all<{term:string}>();
  groups[i]=[...new Set([...groups[i],...rows.results.filter(r=>oneEdit(t,r.term)).slice(0,3).map(r=>r.term)])];
 }
 return groups.length?expression(groups):null;
}
export type ContentSearchOptions={where?:string;owner?:string;offset?:number;limit?:number;budget?:number|null;trending?:boolean};
export async function searchContent(query:string,options:ContentSearchOptions={}){
 const {where='1=1',owner='',offset=0,limit=25,trending=false}=options,budget=options.budget??budgetFrom(query),match=await searchExpression(query);
 // SQL fragments originate only in server code; query values are always bound.
 const join=match?' JOIN search_index si ON si.id=c.id AND si.kind=c.type ':'';
 if(query.trim()&&!match&&budget===null)return [];
 const phrase=query.trim().toLowerCase();
 const sql=`SELECT c.* FROM (${publicContentSQL}) c ${join} WHERE (${where}) AND (?='' OR c.userId=?) AND (? IS NULL OR c.price IS NULL OR c.price<=?) ${match?'AND search_index MATCH ?':''} ORDER BY ${match?'CASE WHEN instr(lower(c.title),?)>0 THEN 0 ELSE 1 END,bm25(search_index,0,0,0,7,1,3,5),':''}${trending?'(SELECT count(*) FROM likes l WHERE l.product_id=c.id) DESC,':''}c.createdAt DESC,c.id DESC LIMIT ? OFFSET ?`;
 return (await dbRaw().prepare(sql).bind(owner,owner,budget,budget,...(match?[match,phrase]:[]),Math.min(100,limit),offset).all<PublicContent>()).results;
}
export async function searchPeople(query:string,where='1=1',offset=0){
 // Keep name searches literal: garment synonyms must never invent people.
 const match=await searchExpression(query,false);if(query.trim()&&!match)return [];
 return (await dbRaw().prepare(`SELECT p.* FROM (${publicPeopleSQL}) p ${match?"JOIN search_index si ON si.id=p.userId AND si.kind='person'":''} WHERE discoverable=1 AND (${where}) ${match?'AND search_index MATCH ?':''} ORDER BY ${match?'CASE WHEN lower(p.name)=? OR lower(p.brandName)=? THEN 0 ELSE 1 END,bm25(search_index,0,0,0,8,1,2,4),':''}p.name COLLATE NOCASE,p.userId LIMIT 25 OFFSET ?`).bind(...(match?[match,query.toLowerCase(),query.toLowerCase()]:[]),offset).all<PublicPerson>()).results;
}
