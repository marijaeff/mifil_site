/**
 * MiFiL A-frame viewer: a dependency-free glTF 2.0 / GLB WebGL renderer.
 * Loads the actual named meshes and textures from the project's .glb file.
 * Built specifically for the exported MiFiL model: triangles, PNG textures,
 * metallic-roughness base colors and alpha blending. No CDN required.
 */
(() => {
  'use strict';

  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mul = (a,b) => {const r = new Float32Array(16); for(let c=0;c<4;c++)for(let k=0;k<4;k++)for(let row=0;row<4;row++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;};
  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const perspective = (fovy,aspect,near,far)=>{const f=1/Math.tan(fovy/2), n=1/(near-far); return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*n,-1,0,0,2*near*far*n,0]);};
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=(v)=>{let len=Math.hypot(...v)||1;return v.map(a=>a/len);};
  const view=(eye,at)=>{let z=norm(sub(eye,at)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);};
  const turn=(angle)=>{let c=Math.cos(angle),s=Math.sin(angle);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);};
  const translate=(x,y,z)=>{let m=identity();m[12]=x;m[13]=y;m[14]=z;return m;};
  const scale=(s)=>{let m=identity();m[0]=m[5]=m[10]=s;return m;};
  const transform=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]];
  const shortest=(from,to)=>((to-from+PI)%TAU+TAU)%TAU-PI;
  const smooth=t=>t*t*(3-2*t);
  const ids=['livemo','our-quest','feel','playable-letter'];
  const angles={livemo:0,'our-quest':-PI/2,feel:PI,'playable-letter':PI/2};
  const vertexSource=`
    attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
    uniform mat4 model; uniform mat4 mvp;
    varying vec3 nrm; varying vec3 world; varying vec2 tex;
    void main(){ vec4 p = model*vec4(position,1.); world=p.xyz; nrm=mat3(model)*normal; tex=uv; gl_Position=mvp*vec4(position,1.); }
  `;
  const fragmentSource=`
    precision mediump float;
    varying vec3 nrm; varying vec3 world; varying vec2 tex;
    uniform vec4 baseColor; uniform vec3 emissive; uniform float usesTexture; uniform sampler2D diffuse; uniform float glow;
    uniform float curtain; uniform vec2 curtainUvRange;
    void main(){
      vec4 color=baseColor;
      if(usesTexture>.5)color*=texture2D(diffuse,tex);
      vec3 n=normalize(nrm);
      float moon=max(dot(n,normalize(vec3(-.52,.83,.48))),0.);
      float sky=max(dot(n,normalize(vec3(.58,.45,-.58))),0.);
      vec3 light=vec3(.66,.68,.73)+moon*vec3(.24,.26,.28)+sky*vec3(.08,.10,.14);
      float d=length(world-vec3(0.,2.05,0.6));
      light += vec3(.24,.135,.048)/(1.+d*d*.22);
      vec3 rgb=color.rgb*light+emissive;
      // Warm reflected light from the selected released window.
      // Glass is lit more strongly; its timber frame receives only a small lift.
      rgb += glow * vec3(.34, .21, .085);
      rgb = mix(rgb, vec3(1.0, .79, .53), glow * .16);
      color.a = min(1.0, color.a + glow * .11);
      // Two gentle linen curtain panels glide inwards only for an unreleased project.
      // UV normalized per pane, so the effect also works on the sloped roof glass.
      if (curtain > 0.001) {
        float u = clamp((tex.x-curtainUvRange.x)/max(.001, curtainUvRange.y-curtainUvRange.x),0.0,1.0);
        float v = tex.y;
        float halfCover = curtain * .52;
        float left = 1.0-smoothstep(halfCover-.03,halfCover+.015,u);
        float right = smoothstep(1.0-halfCover-.015,1.0-halfCover+.03,u);
        float cover = clamp(left+right, 0.0, 1.0);
        float folds = .92 + .065*cos(u*59.0+sin(v*17.0)*.5);
        float bottom = .96-.045*smoothstep(.0,1.,v);
        vec3 linen = vec3(.91,.81,.66)*folds*bottom;
        rgb = mix(rgb, linen, cover);
        color.a = mix(color.a, .985, cover);
      }
      gl_FragColor=vec4(clamp(rgb,0.,1.),color.a);
    }
  `;
  function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function makeProgram(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vertexSource));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
  const types={5120:['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]};
  const numbers={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  async function loadGLB(url){
    // HTTP hosting uses the real GLB file. For opening index.html via file://,
    // a lazy embedded copy avoids the browser's prohibition on local fetch().
    let file;
    try {
      const resp=await fetch(url,{cache:'no-store'});
      if(!resp.ok)throw new Error(`GLB request failed: ${resp.status} ${url}`);
      file=await resp.arrayBuffer();
    } catch (fetchError) {
      if(!window.MiFiLEmbeddedGLB){
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='assets/house-data-v11.js?v=11';
          script.onload=resolve;
          script.onerror=()=>reject(new Error('Neither GLB nor embedded house data could load'));
          document.head.append(script);
        });
      }
      const base64=window.MiFiLEmbeddedGLB;
      if(!base64)throw fetchError;
      const decoded=atob(base64),array=new Uint8Array(decoded.length);
      for(let i=0;i<decoded.length;i++)array[i]=decoded.charCodeAt(i);
      file=array.buffer;
      delete window.MiFiLEmbeddedGLB; // release the extra base64 copy
    }
    const header=new DataView(file);
    if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2)throw new Error('Not a glTF 2.0 binary');
    let json,bin,offset=12;
    while(offset<file.byteLength){
      const len=header.getUint32(offset,true),tag=header.getUint32(offset+4,true);offset+=8;
      if(tag===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(file,offset,len)));
      if(tag===0x004e4942)bin=file.slice(offset,offset+len);
      offset+=len;
    }
    if(!json||!bin)throw new Error('Missing GLB JSON or geometry');
    return {json,bin};
  }
  function readAccessor(gltf,idx){
    const {json,bin}=gltf,a=json.accessors[idx],v=json.bufferViews[a.bufferView];
    const [getter,bytes]=types[a.componentType],count=numbers[a.type];
    if(!getter||!count)throw new Error('Unsupported GLB accessor type');
    const step=v.byteStride||bytes*count,begin=(v.byteOffset||0)+(a.byteOffset||0),reader=new DataView(bin);
    const out=new (a.componentType===5126?Float32Array:Uint32Array)(a.count*count);
    for(let i=0;i<a.count;i++)for(let j=0;j<count;j++)out[i*count+j]=reader[getter](begin+i*step+j*bytes,bytes>1);
    return out;
  }
  function getCenterBounds(json){
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const m of json.meshes)for(const p of m.primitives){const a=json.accessors[p.attributes.POSITION];
      if(a.min&&a.max)for(let k=0;k<3;k++){min[k]=Math.min(min[k],a.min[k]);max[k]=Math.max(max[k],a.max[k]);}
    }
    return {min,max,center:[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2],size:max.map((v,k)=>v-min[k])};
  }
  class House {
    constructor(canvas,opts={}){
      this.canvas=canvas;this.opt=opts;this.active=true;this.ready=false;this.angle=Number.isFinite(opts.angle)?opts.angle:.31;
      this.highlight=null;this.entering=false;this.motion=null;this.drag=null;this.hoverId=null;
      this.curtainValues={livemo:0,'our-quest':0,feel:0};this.litWindowLevel=0;this.lastCurtainFrame=0;this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.windows=new Map();this.projectBounds=new Map();this.lastRendered=null;this.pixelRatio=1;this.dirty=true;this.lastFrame=0;
      this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,preserveDrawingBuffer:false});
      if(!this.gl)throw new Error('WebGL unavailable');
      this.program=makeProgram(this.gl);this.gl.useProgram(this.program);
      this.loc={};for(const n of ['position','normal','uv'])this.loc[n]=this.gl.getAttribLocation(this.program,n);
      for(const n of ['model','mvp','baseColor','emissive','usesTexture','diffuse','glow','curtain','curtainUvRange'])this.loc[n]=this.gl.getUniformLocation(this.program,n);
      this.gl.uniform1i(this.loc.diffuse,0);
      this.geometry=[];this.textureCache=new Map();this.viewTarget=[0,2.14,0];this.zoom=1;
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
      this.addEvents();this.resize();
      this.load();
      this.loop=this.loop.bind(this);this.raf=requestAnimationFrame(this.loop);
    }
    async load(){try{
      const gltf=await loadGLB('assets/MiFiL_Aframe_Dream_House_v11.glb?v=11');if(!this.active)return;
      this.gltf=gltf;this.bounds=getCenterBounds(gltf.json);
      // Slightly smaller framing so the house breathes inside the watercolor scene.
      this.modelScale=4.2/Math.max(...this.bounds.size);
      this.buildGeometry(gltf);
      this.ready=true;this.canvas.dataset.renderer='glb-webgl';this.opt.onReady?.();
    }catch(e){console.error('MiFiL GLB:',e);this.ready=false;this.opt.onLost?.(e);}}
    buildGeometry(gltf){
      const gl=this.gl,{json,bin}=gltf;
      const materials=json.materials||[];
      this.materials=materials.map(m=>{
        const p=m.pbrMetallicRoughness||{};
        return {name:m.name||'',color:p.baseColorFactor||[1,1,1,1],emissive:m.emissiveFactor||[0,0,0],transparent:m.alphaMode==='BLEND'||((p.baseColorFactor||[])[3]||1)<.99,texture:(p.baseColorTexture&&p.baseColorTexture.index)||null};
      });
      this.materials.forEach((mat,i)=>{const m=materials[i],p=m.pbrMetallicRoughness||{};mat.texture=p.baseColorTexture?.index??null;});
      const texturePromises=[];
      const bufferViews=json.bufferViews;
      for(let i=0;i<(json.images||[]).length;i++){
        const im=json.images[i];if(im.bufferView===undefined)continue;
        const bv=bufferViews[im.bufferView],chunk=bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
        const uri=URL.createObjectURL(new Blob([chunk],{type:im.mimeType||'image/png'}));
        const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
        this.textureCache.set(i,texture);
        const image=new Image();
        texturePromises.push(new Promise(resolve=>{
          image.onload=()=>{if(!this.active){URL.revokeObjectURL(uri);resolve();return;}
            gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
            gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);this.dirty=true;URL.revokeObjectURL(uri);resolve();};
          image.onerror=()=>{URL.revokeObjectURL(uri);resolve();};
          image.src=uri;
        }));
      }
      this.textures=json.textures||[];
      json.meshes.forEach((mesh,i)=>{
        const node=(json.nodes||[]).find(n=>n.mesh===i);
        const name=node?.name||mesh.name||`mesh_${i}`;
        // Decorative loft railing intentionally omitted; new porch plant is part of the GLB.
      // Remove pre-existing static fabric in the website viewer; the new curtains
      // are a reversible glass overlay shown only on coming-soon preview.
      if(name.startsWith('loft_rail__') || name.startsWith('curtains__') ||
         name.startsWith('curtain_ties__') || name.startsWith('back_curtains__')) return;
      for(const primitive of mesh.primitives){
          if(primitive.mode!==undefined&&primitive.mode!==4)continue;
          const pos=readAccessor(gltf,primitive.attributes.POSITION),uv=primitive.attributes.TEXCOORD_0!==undefined?readAccessor(gltf,primitive.attributes.TEXCOORD_0):null;
          const indices=primitive.indices!==undefined?readAccessor(gltf,primitive.indices):Uint32Array.from({length:pos.length/3},(_,j)=>j);
          // The Trimesh GLB omits vertex normals; reconstruct smooth vertex normals in one pass.
          const normals=new Float32Array(pos.length);
          for(let j=0;j<indices.length;j+=3){const a=indices[j],b=indices[j+1],c=indices[j+2],ax=pos[a*3],ay=pos[a*3+1],az=pos[a*3+2],
            bx=pos[b*3],by=pos[b*3+1],bz=pos[b*3+2],cx=pos[c*3],cy=pos[c*3+1],cz=pos[c*3+2];
            const e1=[bx-ax,by-ay,bz-az],e2=[cx-ax,cy-ay,cz-az],n=cross(e1,e2);
            for(const index of [a,b,c])for(let k=0;k<3;k++)normals[index*3+k]+=n[k];
          }
          for(let j=0;j<normals.length;j+=3){let n=norm([normals[j],normals[j+1],normals[j+2]]);normals[j]=n[0];normals[j+1]=n[1];normals[j+2]=n[2];}
          // Interleaved and non-indexed is compatible with WebGL 1 on mobile.
          const packed=new Float32Array(indices.length*8);
          for(let j=0;j<indices.length;j++){
            const v=indices[j],t=j*8;
            packed[t]=pos[v*3];packed[t+1]=pos[v*3+1];packed[t+2]=pos[v*3+2];
            packed[t+3]=normals[v*3];packed[t+4]=normals[v*3+1];packed[t+5]=normals[v*3+2];
            packed[t+6]=uv?uv[v*2]:0;packed[t+7]=uv?uv[v*2+1]:0;
          }
          const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,packed,gl.STATIC_DRAW);
          const mat=this.materials[primitive.material]||this.materials[0];
          const curtainMatch=name.match(/^PROJECT_(.+?)_glass__/);
          const curtainId=curtainMatch?.[1]?.replace(/_/g,'-')||null;
          let uMin=0,uMax=1;
          if(uv?.length){uMin=Infinity;uMax=-Infinity;for(let k=0;k<uv.length;k+=2){uMin=Math.min(uMin,uv[k]);uMax=Math.max(uMax,uv[k]);}}
          this.geometry.push({name,buffer,count:indices.length,material:mat,curtainId,uvRange:[uMin,uMax]});
          const match=name.match(/^PROJECT_(.+?)_(?:glass|frame|mullions|sill)__/);
          if(match){const id=match[1].replace(/_/g,'-');if(ids.includes(id)){
            const a=json.accessors[primitive.attributes.POSITION];if(!this.projectBounds.has(id))this.projectBounds.set(id,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],glass:null});
            const box=this.projectBounds.get(id);
            for(let k=0;k<3;k++){box.min[k]=Math.min(box.min[k],a.min[k]);box.max[k]=Math.max(box.max[k],a.max[k]);}
            if(name.includes('_glass__'))box.glass={min:a.min,max:a.max};
          }}
        }
      });
      for(const id of ids){const b=this.projectBounds.get(id);if(!b)continue;const rect=b.glass||b;
        this.windows.set(id,{id,angle:angles[id],center:rect.min.map((v,k)=>(v+rect.max[k])/2),bounds:rect});}
      this.geometry.sort((a,b)=>Number(a.material.transparent)-Number(b.material.transparent));
      Promise.all(texturePromises).then(()=>{this.texturesReady=true;this.dirty=true;});
    }
    resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
      this.pixelRatio=Math.min(window.devicePixelRatio||1,1.7);const w=Math.max(2,Math.round(r.width*this.pixelRatio)),h=Math.max(2,Math.round(r.height*this.pixelRatio));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.dirty=true;}
      this.gl.viewport(0,0,w,h);
    }
    getMatrices(){const w=this.canvas.width,h=this.canvas.height;
      const model=mul(mul(turn(this.angle),scale(this.modelScale)),translate(...this.bounds.center.map(v=>-v)));
      const dist=8.35*Math.max(1,1.02/(w/h))*this.zoom;
      const eye=[0,2.46,dist],target=this.viewTarget;
      const proj=perspective(PI/4.35,w/h,0.10,90);
      const camera=view(eye,target);
      const mvp=mul(mul(proj,camera),model);
      return {model,mvp,eye};
    }
    screen(p){if(!this.lastRendered)return {x:0,y:0,z:2};
      const q=transform(this.lastRendered.mvp,p);const r=this.canvas.getBoundingClientRect();
      return {x:(q[0]/q[3]+1)*r.width/2,y:(1-q[1]/q[3])*r.height/2,z:q[2]/q[3]};
    }
    visibleWindows(){if(!this.ready)return [];
      const r=this.canvas.getBoundingClientRect(),vis=[];
      for(const w of this.windows.values()){
        const d=Math.abs(shortest(this.angle,w.angle));if(d>1.12)continue;
        const p=this.screen(w.center);if(p.z>1||p.z<-.9||p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
        vis.push({id:w.id,x:p.x,y:p.y,facing:1-d/PI,score:d});
      }
      return vis.sort((a,b)=>a.score-b.score);
    }
    // A forgiving, stable target around the whole projected glass pane.
    // The displayed label doesn't intercept pointer events (see CSS).  A small
    // amount of hysteresis keeps a curtain from flickering near its frame.
    hit(x,y){if(!this.ready)return null;
      const touch=matchMedia('(pointer: coarse)').matches;
      const minPad=touch?15:10;
      const maxPad=touch?32:24;
      let found=null,score=Infinity;
      for(const w of this.windows.values()){
        // At oblique angles the pane is still visible well beyond 66 degrees.
        if(Math.abs(shortest(this.angle,w.angle))>1.44)continue;
        const b=w.bounds,pts=[];
        for(const xx of [b.min[0],b.max[0]])
          for(const yy of [b.min[1],b.max[1]])
            for(const zz of [b.min[2],b.max[2]])pts.push(this.screen([xx,yy,zz]));
        if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
        const minx=Math.min(...pts.map(p=>p.x)),maxx=Math.max(...pts.map(p=>p.x));
        const miny=Math.min(...pts.map(p=>p.y)),maxy=Math.max(...pts.map(p=>p.y));
        // Include the timber frame, with extra tolerance only for the pane
        // already being hovered. This avoids opening the curtains mid-hover.
        const sticky=this.hoverId===w.id?16:0;
        const padX=clamp((maxx-minx)*.10,minPad,maxPad)+sticky;
        const padY=clamp((maxy-miny)*.10,minPad,maxPad)+sticky;
        if(x<minx-padX||x>maxx+padX||y<miny-padY||y>maxy+padY)continue;
        const distance=Math.hypot(
          (x-(minx+maxx)/2)/Math.max(1,maxx-minx+padX*2),
          (y-(miny+maxy)/2)/Math.max(1,maxy-miny+padY*2));
        // Prefer the current pane if two expanded hit areas overlap.
        const priority=distance-(this.hoverId===w.id ? .12 : 0);
        if(priority<score){score=priority;found=w;}
      }
      return found;
    }
    hover(w){const id=w?.id||null;if(this.hoverId===id)return;this.hoverId=id;this.dirty=true;this.canvas.classList.toggle('window-hover',!!id);
      if(id){const p=this.screen(w.center);this.opt.onHover?.(id,{x:p.x,y:p.y});}
      else this.opt.onHover?.(null);
    }
    setHighlight(id){this.highlight=id||null;this.dirty=true;}
    rotate(delta){if(this.entering)return;this.hover(null);this.rotateToAngle(this.angle+delta,520);}
    rotateTo(id){if(this.entering)return false;const w=this.windows.get(id);if(!w)return false;this.rotateToAngle(this.angle+shortest(this.angle,w.angle),this.reduce?1:760);this.highlight=id;return true;}
    rotateToAngle(to,duration){this.motion={from:this.angle,to,start:performance.now(),duration,enter:false};this.dirty=true;}
    enter(id,done){if(id!=='playable-letter')return false;const w=this.windows.get(id);if(!w)return false;
      if(this.reduce){done?.();return true;}this.entering=true;this.hover(null);
      this.motion={from:this.angle,to:this.angle+shortest(this.angle,w.angle),start:performance.now(),duration:1180,enter:true,done};return true;}
    addEvents(){const canvas=this.canvas;
      canvas.addEventListener('pointerdown',e=>{if(e.button!==0||this.entering)return;this.motion=null;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,last:e.clientX,moved:false};});
      canvas.addEventListener('pointermove',e=>{if(this.entering)return;const d=this.drag;
        if(d&&d.id===e.pointerId){if(!d.moved&&Math.abs(e.clientX-d.x)>7&&Math.abs(e.clientX-d.x)>Math.abs(e.clientY-d.y)){d.moved=true;canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');}
          if(d.moved){this.angle-=(e.clientX-d.last)*.009;this.highlight=null;this.dirty=true;this.hover(null);}
          d.last=e.clientX;
        }
        if(!d||!d.moved){const rect=canvas.getBoundingClientRect();this.hover(this.hit(e.clientX-rect.left,e.clientY-rect.top));}
      });
      canvas.addEventListener('pointerup',e=>{const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;canvas.classList.remove('dragging');
        if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<10){const r=canvas.getBoundingClientRect(),w=this.hit(e.clientX-r.left,e.clientY-r.top);if(w)this.opt.onSelect?.(w.id);}
      });
      const clear=()=>{this.drag=null;canvas.classList.remove('dragging');this.hover(null);};
      canvas.addEventListener('pointercancel',clear);
      canvas.addEventListener('pointerleave',()=>{if(!this.drag?.moved)this.hover(null);});
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.active=false;this.opt.onLost?.(new Error('WebGL context lost'));});
    }
    render(){if(!this.ready)return;
      const gl=this.gl;const {model,mvp}=this.getMatrices();this.lastRendered={model,mvp};
      gl.viewport(0,0,this.canvas.width,this.canvas.height);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
      gl.useProgram(this.program);gl.uniformMatrix4fv(this.loc.model,false,model);gl.uniformMatrix4fv(this.loc.mvp,false,mvp);
      gl.activeTexture(gl.TEXTURE0);
      let blending=false;
      for(const mesh of this.geometry){const mat=mesh.material;
        if(mat.transparent!==blending){blending=mat.transparent;if(blending){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}}
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
        gl.enableVertexAttribArray(this.loc.position);gl.vertexAttribPointer(this.loc.position,3,gl.FLOAT,false,32,0);
        gl.enableVertexAttribArray(this.loc.normal);gl.vertexAttribPointer(this.loc.normal,3,gl.FLOAT,false,32,12);
        gl.enableVertexAttribArray(this.loc.uv);gl.vertexAttribPointer(this.loc.uv,2,gl.FLOAT,false,32,24);
        gl.uniform4fv(this.loc.baseColor,mat.color);gl.uniform3fv(this.loc.emissive,mat.emissive);
        const tid=mat.texture!==null?this.textures[mat.texture]?.source:null;
        const texture=tid!==undefined&&tid!==null?this.textureCache.get(tid):null;
        gl.uniform1f(this.loc.usesTexture,texture?1:0);
        if(texture)gl.bindTexture(gl.TEXTURE_2D,texture);
        const chosen=this.hoverId||this.highlight;
        const releasedWindow = chosen === 'playable-letter' && mesh.name.startsWith('PROJECT_playable_letter_');
        const glass = mesh.name.startsWith('PROJECT_playable_letter_glass__');
        // Light up only the live project. Closed projects retain their curtains.
        gl.uniform1f(this.loc.glow, releasedWindow ? this.litWindowLevel * (glass ? .95 : .18) : 0);
        const curtainValue=mesh.curtainId ? (this.curtainValues[mesh.curtainId]||0) : 0;
        gl.uniform1f(this.loc.curtain,curtainValue);
        gl.uniform2fv(this.loc.curtainUvRange,mesh.uvRange);
        gl.drawArrays(gl.TRIANGLES,0,mesh.count);
      }
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    loop(now){if(!this.active)return;
      let curtainsMoving=false;
      const dt=Math.min(0.10,Math.max(0,(now-(this.lastCurtainFrame||now))/1000));
      this.lastCurtainFrame=now;
      const curtainTarget=this.hoverId||this.highlight;
      const lightGoal = curtainTarget === 'playable-letter' && !this.entering ? 1 : 0;
      const oldLight = this.litWindowLevel;
      const lightNext = this.reduce ? lightGoal : oldLight + (lightGoal - oldLight) * Math.min(1, dt * 5.5);
      this.litWindowLevel = Math.abs(lightNext - lightGoal) < .004 ? lightGoal : lightNext;
      const glowMoving = Math.abs(this.litWindowLevel - oldLight) > .002;
      if (glowMoving) this.dirty = true;
      for(const id of Object.keys(this.curtainValues)){
        const goal=curtainTarget===id && !this.entering?1:0;
        const old=this.curtainValues[id];
        const next=old+(goal-old)*Math.min(1,dt*5.2);
        this.curtainValues[id]=Math.abs(next-goal)<.004?goal:next;
        if(Math.abs(old-this.curtainValues[id])>.002){curtainsMoving=true;this.dirty=true;}
      }
      if(this.motion){const m=this.motion,t=clamp((now-m.start)/m.duration,0,1);this.angle=m.from+(m.to-m.from)*smooth(t);
        if(m.enter){this.zoom=1-.36*smooth(clamp((t-.35)/.65,0,1));if(t>.77&&!m.notified){m.notified=true;this.opt.onEnter?.();}}
        if(t>=1){this.motion=null;if(m.enter)m.done?.();}
      }
      // Redraw at most about 30 fps while moving, then idle. Keep mobile GPUs cool.
      const activeMotion=!!this.motion||!!this.drag?.moved||curtainsMoving||glowMoving;
      if(this.ready&&(this.dirty||((activeMotion||this.entering)&&now-this.lastFrame>33)||now-this.lastFrame>1500)){
        this.render();this.opt.onVisibleWindows?.(this.visibleWindows());
        this.lastFrame=now;this.dirty=false;
      }
      this.raf=requestAnimationFrame(this.loop);
    }
    destroy(){this.active=false;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();for(const mesh of this.geometry)this.gl.deleteBuffer(mesh.buffer);
      for(const tex of this.textureCache.values())this.gl.deleteTexture(tex);this.gl.deleteProgram(this.program);}
  }
  window.MiFiLHouse=House;
})();
