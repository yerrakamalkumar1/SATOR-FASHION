import {env} from 'cloudflare:workers';

// Render terminates HTTPS before forwarding to the internal Node listener.
// Use deployment configuration, never client-controlled Host/forwarded headers.
function publicOrigin(request:Request):string|null {
 const config=env as unknown as {SATOR_PUBLIC_ORIGIN?:string;RENDER_EXTERNAL_URL?:string};
 const configured=config.SATOR_PUBLIC_ORIGIN||config.RENDER_EXTERNAL_URL;
 if(!configured)return new URL(request.url).origin;
 try {
  const url=new URL(configured);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  return url.origin;
 } catch {return null;}
}

export function originOK(request:Request,requireOrigin=false):boolean {
 if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 const origin=request.headers.get('origin');
 if(origin===null)return !requireOrigin;
 return origin===publicOrigin(request);
}
