import {env} from 'cloudflare:workers';
import {getAppUser} from '../../auth';
import {allowWrite} from '../../lib/security';
export async function POST(request:Request){
const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
const user=await getAppUser();if(!user)return Response.json({error:'Sign in to upload artwork.'},{status:401});if(!await allowWrite(user.userId,'uploads',15))return Response.json({error:'Please wait before uploading more files.'},{status:429});if(!env.BUCKET)return Response.json({error:'Uploads unavailable'},{status:503});
if(Number(request.headers.get('content-length')||0)>20_000_000)return Response.json({error:'Media must be under 20 MB.'},{status:413});
const data=await request.arrayBuffer();if(data.byteLength>20_000_000||data.byteLength<12)return Response.json({error:'Use a supported image or MP4 under its size limit.'},{status:400});
const b=new Uint8Array(data),png=b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,jpg=b[0]===255&&b[1]===216&&b[2]===255,webp=String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
const mp4=String.fromCharCode(...b.slice(4,8))==='ftyp'&&request.headers.get('content-type')==='video/mp4';const type=png?'image/png':jpg?'image/jpeg':webp?'image/webp':mp4?'video/mp4':'';if(!mp4&&data.byteLength>5_000_000)return Response.json({error:'Images must be under 5 MB.'},{status:413});if(!type)return Response.json({error:'Use PNG, JPEG, WebP or MP4 media.'},{status:400});
const id=crypto.randomUUID();await env.BUCKET.put(id,data,{httpMetadata:{contentType:type},customMetadata:{owner:user.userId}});return Response.json({url:'/api/assets/'+id});}
