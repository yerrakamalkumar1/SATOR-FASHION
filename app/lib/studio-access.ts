import type {DesignConfig} from '../model';
import {ownAsset} from './security';
import {dbRaw} from './community';
export function artworkSQL(column='config'){return `(json_extract(${column},'$.image')=? OR EXISTS(SELECT 1 FROM json_each(${column},'$.studio.views') sv,json_each(sv.value) sl WHERE json_extract(sl.value,'$.kind')='image' AND json_extract(sl.value,'$.value')=?))`;}
export function artworkPaths(config:DesignConfig){return [...new Set([config.image,...(config.studio?Object.values(config.studio.views).flat().filter(l=>l.kind==='image').map(l=>l.value):[])].filter(Boolean))];}
export async function canUseArtwork(config:DesignConfig,uid:string){for(const path of artworkPaths(config)){if(await ownAsset(path,uid))continue;const found=await dbRaw().prepare(`SELECT id FROM designs WHERE published=1 AND ${artworkSQL()} UNION ALL SELECT id FROM posts WHERE media_url=? UNION ALL SELECT id FROM listings WHERE published=1 AND image=? LIMIT 1`).bind(path,path,path,path).first();if(!found)return false;}return true;}
