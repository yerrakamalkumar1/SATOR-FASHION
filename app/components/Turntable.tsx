'use client';
import {useEffect,useRef,useState} from 'react';
import {RotateCcw,MoveHorizontal} from 'lucide-react';
import Garment from './Garment';
import type {DesignConfig} from '../model';

// A thin, extruded garment silhouette, lit and rotated in real WebGL space.
// This is a design concept viewer, not cloth simulation or a production pattern.
type Point=[number,number];
function triangles(points:Point[]):number[]{
 const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 let ids=points.map((_,i)=>i);const area=points.reduce((n,p,i)=>n+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0);if(area<0)ids.reverse();
 const output:number[]=[];let attempts=0;
 while(ids.length>3&&attempts++<300){let cut=false;for(let i=0;i<ids.length;i++){const a=ids[(i+ids.length-1)%ids.length],b=ids[i],c=ids[(i+1)%ids.length];if(cross(points[a],points[b],points[c])<=0)continue;const inside=ids.some(j=>j!==a&&j!==b&&j!==c&&cross(points[a],points[b],points[j])>=0&&cross(points[b],points[c],points[j])>=0&&cross(points[c],points[a],points[j])>=0);if(inside)continue;output.push(a,b,c);ids.splice(i,1);cut=true;break;}if(!cut)break;}
 if(ids.length===3)output.push(...ids);return output;
}
export default function Turntable({config}:{config:DesignConfig}){
 const canvas=useRef<HTMLCanvasElement>(null),front=useRef<HTMLDivElement>(null),back=useRef<HTMLDivElement>(null),drawRef=useRef<(angle:number)=>void>(()=>{}),angleRef=useRef(0),drag=useRef<number|null>(null);
 const [angle,setAngle]=useState(0),[error,setError]=useState('');
 useEffect(()=>{
  const c=canvas.current;if(!c)return;const gl=c.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false});if(!gl){setError('3D preview is unavailable on this device. Use the front and back views in the design studio.');return;}
  let disposed=false;const textures:WebGLTexture[]=[],buffers:WebGLBuffer[]=[];
  function shader(type:number,source:string){const s=gl!.createShader(type)!;gl!.shaderSource(s,source);gl!.compileShader(s);if(!gl!.getShaderParameter(s,gl!.COMPILE_STATUS))throw new Error('Shader could not compile');return s;}
  const vertex=shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 normal;attribute vec2 uv;uniform float angle;uniform float aspect;varying vec2 tex;varying float light;void main(){float a=cos(angle),b=sin(angle);vec3 p=vec3(position.x*a+position.z*b,position.y,-position.x*b+position.z*a);vec3 n=vec3(normal.x*a+normal.z*b,normal.y,-normal.x*b+normal.z*a);float perspective=3.5/(3.5-p.z);gl_Position=vec4(p.x*perspective/aspect,p.y*perspective,0.1*p.z,1.0);tex=uv;light=0.66+0.34*abs(dot(normalize(n),normalize(vec3(-0.4,0.6,1.0))));}');
  const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D texture;uniform vec3 base;uniform bool textured;varying vec2 tex;varying float light;void main(){vec4 sampleColor=texture2D(texture,tex);vec3 color=textured&&sampleColor.a>0.15?sampleColor.rgb:base;gl_FragColor=vec4(color*light,1.0);}');
  const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){setError('This device could not initialize the 3D preview.');return;}
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.945,.945,.92,1);
  const outline:Point[]=config.garment==='tee'?[[143,66],[165,82],[200,86],[235,82],[257,66],[311,90],[348,164],[298,191],[271,149],[277,366],[240,375],[200,379],[160,375],[123,366],[129,149],[102,191],[52,164],[89,90]]:[[143,73],[150,48],[175,31],[200,29],[225,31],[250,48],[257,73],[285,86],[339,231],[294,250],[269,169],[274,370],[200,384],[126,370],[131,169],[106,250],[61,231],[115,86]];
  const points=outline.map(([x,y])=>[(x-200)/210,(210-y)/210] as Point),indices=triangles(points),z=.065;
  const fronts:number[]=[],backs:number[]=[],sides:number[]=[];
  function add(out:number[],i:number,depth:number,nx:number,ny:number,nz:number){const [x,y]=points[i];out.push(x,y,depth,nx,ny,nz,nz<0?1-outline[i][0]/400:outline[i][0]/400,outline[i][1]/420);}
  for(let i=0;i<indices.length;i+=3){for(const n of indices.slice(i,i+3))add(fronts,n,z,0,0,1);for(const n of indices.slice(i,i+3).reverse())add(backs,n,-z,0,0,-1);}
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length,dx=points[j][0]-points[i][0],dy=points[j][1]-points[i][1],len=Math.hypot(dx,dy);for(const [n,d]of [[i,z],[j,z],[j,-z],[i,z],[j,-z],[i,-z]])add(sides,n,d,dy/len,-dx/len,0);}
  const geometries=[fronts,backs,sides].map(vertices=>{const b=gl.createBuffer()!;buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);return {buffer:b,count:vertices.length/8};});
  const position=gl.getAttribLocation(program,'position'),normal=gl.getAttribLocation(program,'normal'),uv=gl.getAttribLocation(program,'uv');
  gl.uniform3f(gl.getUniformLocation(program,'base'),parseInt(config.color.slice(1,3),16)/255,parseInt(config.color.slice(3,5),16)/255,parseInt(config.color.slice(5,7),16)/255);
  const paint=(degree:number)=>{if(disposed)return;const width=c!.clientWidth||600,height=c!.clientHeight||520,dpr=Math.min(window.devicePixelRatio||1,2);if(c!.width!==width*dpr||c!.height!==height*dpr){c!.width=width*dpr;c!.height=height*dpr;}gl.viewport(0,0,c!.width,c!.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(gl.getUniformLocation(program,'angle'),degree*Math.PI/180);gl.uniform1f(gl.getUniformLocation(program,'aspect'),width/height);geometries.forEach((g,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);[[position,3,0],[normal,3,12],[uv,2,24]].forEach(([loc,size,offset])=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);});gl.uniform1i(gl.getUniformLocation(program,'textured'),i<2&&textures[i]?1:0);if(textures[i])gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.drawArrays(gl.TRIANGLES,0,g.count);});};
  drawRef.current=paint;paint(angleRef.current);const resize=new ResizeObserver(()=>paint(angleRef.current));resize.observe(c);
  async function loadTexture(element:HTMLDivElement|null,index:number){try{const svg=element?.querySelector('svg')?.cloneNode(true) as SVGSVGElement|undefined;if(!svg)return;svg.setAttribute('width','800');svg.setAttribute('height','840');for(const image of Array.from(svg.querySelectorAll('image'))){const url=image.getAttribute('href');if(url){const response=await fetch(url);if(!response.ok)continue;const blob=await response.blob();const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});image.setAttribute('href',encoded);}}
   const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);if(disposed)return;const t=gl!.createTexture()!;textures[index]=t;gl!.bindTexture(gl!.TEXTURE_2D,t);gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,gl!.RGBA,gl!.UNSIGNED_BYTE,img);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_S,gl!.CLAMP_TO_EDGE);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_T,gl!.CLAMP_TO_EDGE);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MIN_FILTER,gl!.LINEAR);paint(angleRef.current);};img.onerror=()=>URL.revokeObjectURL(url);img.src=url;
  }catch{setError('Some artwork could not load; the garment shape is still available.');}}
  void loadTexture(front.current,0);void loadTexture(back.current,1);
  return()=>{disposed=true;resize.disconnect();textures.forEach(t=>gl.deleteTexture(t));buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);};
 },[config]);
 function rotate(v:number){setAngle(v);angleRef.current=v;drawRef.current(v);}
 return <div className="turntable"><div className="turntable-stage"><canvas ref={canvas} aria-label="Rotatable 3D garment concept" onPointerDown={e=>{drag.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current===null)return;rotate((angleRef.current+(e.clientX-drag.current)*.7+360)%360);drag.current=e.clientX;}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/><span><MoveHorizontal size={15}/>Drag to rotate</span></div><div hidden ref={front}><Garment config={config} flat/></div><div hidden ref={back}><Garment config={config} back flat/></div><div className="turntable-controls"><label>Rotate your concept<span>{Math.round(angle)}°</span><input type="range" min="0" max="360" value={angle} onChange={e=>rotate(+e.target.value)}/></label><button className="button secondary" onClick={()=>rotate(0)}><RotateCcw size={15}/>Front</button><button className="button secondary" onClick={()=>rotate(180)}>Back</button></div>{error&&<p className="inline-error" role="alert">{error}</p>}<p className="small-note">A 3D extruded concept model with your front and back artwork. This is not a fabric drape simulation, fit assessment, or production-ready pattern.</p></div>;
}
