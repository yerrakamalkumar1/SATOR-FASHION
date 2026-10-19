import {dbRaw,blocked} from './community';
import {ownAsset} from './security';
export async function creativeProject(id:string,uid:string){
 const p=await dbRaw().prepare('SELECT * FROM design_projects WHERE id=? AND (owner_id=? OR collaborator_id=?)').bind(id,uid,uid).first<Record<string,unknown>>();
 if(!p||p.collaborator_id&&await blocked(String(p.owner_id),String(p.collaborator_id)))return null;
 return p;
}
export async function creativeImage(path:string,uid:string,projectId?:string){
 if(!path||await ownAsset(path,uid))return true;
 const db=dbRaw();
 if(await db.prepare('SELECT id FROM designs WHERE published=1 AND json_extract(config,\'$.image\')=? LIMIT 1').bind(path).first())return true;
 if(projectId&&await creativeProject(projectId,uid))return !!await db.prepare('SELECT id FROM project_revisions WHERE project_id=? AND json_extract(config,\'$.image\')=? LIMIT 1').bind(projectId,path).first();
 return false;
}
