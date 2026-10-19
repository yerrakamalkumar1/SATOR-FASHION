import {env} from 'cloudflare:workers';

// Only administrator-configured services are accepted. User requests never
// supply model URLs. Private-network HTTP is an explicit Node-only setting.
export function serviceURL(value:string|undefined){
 const settings=env as typeof env&{SATOR_RUNTIME?:string;SATOR_ALLOW_PRIVATE_AI?:string};
 if(!value)return null;
 try{
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash)return null;
  const privateAllowed=settings.SATOR_RUNTIME==='node'&&settings.SATOR_ALLOW_PRIVATE_AI==='true';
  if(!privateAllowed&&(url.protocol!=='https:'||(url.port&&url.port!=='443')||!url.hostname.includes('.')||/[\[\]:]/.test(url.hostname)||/^[\d.]+$/.test(url.hostname)||/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)))return null;
  if(!['http:','https:'].includes(url.protocol))return null;
  return {url:url.href.replace(/\/$/,''),privateAllowed};
 }catch{return null;}
}
