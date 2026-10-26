import {searchContent,searchPeople} from '../../lib/retrieval';
import {getAppUser} from '../../auth';
import {dbRaw,noStore,publicPeopleSQL,publicContentSQL,publicPerson,type PublicPerson,type PublicContent} from '../../lib/community';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await getAppUser();if(!user)return noStore({error:'Sign in to explore.'},401);
 const params=new URL(request.url).searchParams,q=(params.get('q')||'').trim().toLowerCase().slice(0,120),owner=params.get('profile')||'',page=Math.max(0,Math.min(10000,Number(params.get('page'))||0)),offset=Math.floor(page)*24;
 const kind=params.get('kind')||'all',trending=params.get('sort')==='trending';
 const kindWhere=kind==='people'&&!owner?'0=1':kind==='creators'?"type IN ('design','post')":kind==='startups'?"type='listing'":kind==='reels'?"mediaType='video'":kind==='posts'?"type='post' AND mediaType<>'video'":kind==='designs'?"type='design'":kind==='products'?"type='listing'":'1=1';
 const peopleWhere=kind==='startups'?"instr(coalesce(roles,''),'brand')>0":kind==='creators'?"instr(coalesce(roles,''),'creator')>0":kind==='buyers'?"coalesce(roles,'customer') NOT LIKE '%creator%' AND coalesce(roles,'customer') NOT LIKE '%brand%'":kind==='reels'?'0=1':'1=1';
 const db=dbRaw(),profile=owner?await publicPerson(owner):null;
 const itemId=params.get('item');
 if(itemId){const item=await db.prepare(`SELECT * FROM (${publicContentSQL}) WHERE id=?`).bind(itemId).first<PublicContent>();return item?noStore({item}):noStore({error:'This published piece is no longer available.'},404);}
 if(owner&&!profile)return noStore({error:'This public profile is not available.'},404);
 const viewerBlocked=owner?!!await db.prepare('SELECT 1 FROM member_blocks WHERE user_id=? AND target_id=?').bind(user.userId,owner).first():false;
 const [people,items]=await Promise.all([
  owner?Promise.resolve([profile!]):searchPeople(q,peopleWhere,offset),
  searchContent(q,{where:kindWhere,owner,offset,trending})
 ]);
 return noStore({profile,viewerBlocked,people:people.slice(0,24),peopleMore:people.length>24,items:items.slice(0,24),itemsMore:items.length>24,page});
 }catch{return noStore({error:'Discovery is temporarily unavailable. Please retry.'},503);}}
